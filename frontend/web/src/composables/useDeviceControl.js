import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import {
  acquireDeviceControl,
  fetchDeviceControl,
  fetchDeviceControlList,
  heartbeatDeviceControl,
  releaseDeviceControl,
  releaseDeviceControlOnUnload,
} from "../utils/device-control-api.js";
import { logInfo, logWarn } from "../utils/app-event-logger.js";

/** 后端 TTL 45 秒，20 秒续期：留一次丢包的余量，又不至于把设备锁死太久。 */
export const HEARTBEAT_INTERVAL_MS = 20_000;
/** 画廊角标只需要跟得上「别人开始/结束控制」，比租约粒度再快没意义。 */
export const POLL_INTERVAL_MS = 20_000;
const MAX_POLL_SERIALS = 24;

// 全应用共享的控制权快照（serial -> 快照）。画廊角标与工作区工具栏互斥渲染却描述同一份
// 租约，共享后抢占成功的瞬间画廊角标就跟着变。
const leases = reactive({});
const enforced = ref(false);
const inflight = new Set();

function applySnapshot(serial, snapshot, payloadEnforced) {
  if (!serial) return;
  if (typeof payloadEnforced === "boolean") enforced.value = payloadEnforced;
  if (!snapshot) {
    delete leases[serial];
    return;
  }
  leases[serial] = { ...snapshot, syncedAt: Date.now() };
}

function forgetSerial(serial) {
  if (serial) delete leases[serial];
}

/** 控制权事件统一走设备分类日志，调用点省掉四行 options 对象。 */
function leaseLog(level, event, message, serial, details) {
  const write = level === "warn" ? logWarn : logInfo;
  write("device", event, message, { deviceSerial: serial, details });
}

/**
 * 刷新画廊的控制权角标。
 *
 * 优先用一次性的列表接口：24 台设备逐个探测会变成 24 个加密请求，而画廊每 20 秒
 * 就要刷新一轮。列表接口不可用时（老后端 / 网络异常）再退回逐台串行探测，
 * 保证角标不会因为一次失败就整页空白。
 */
async function refreshSerials(serials) {
  const unique = [...new Set((serials ?? []).filter(Boolean))].slice(0, MAX_POLL_SERIALS);

  if (!unique.length) {
    return;
  }

  try {
    const list = await fetchDeviceControlList();

    if (list.ok) {
      const covered = new Set();

      for (const item of list.items) {
        if (!unique.includes(item.serial)) continue;
        covered.add(item.serial);
        applySnapshot(item.serial, item.control, list.enforced);
      }

      // 列表里没有的 = 当前空闲：清掉旧快照，否则角标会一直停在「控制中」
      for (const serial of unique) {
        if (!covered.has(serial)) applySnapshot(serial, null, list.enforced);
      }

      return;
    }

    leaseLog("warn", "control.list.failed", "控制权列表不可用，退回逐台探测", "", { code: list.code });
  } catch (error) {
    leaseLog("warn", "control.list.error", "控制权列表请求异常，退回逐台探测", "", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (const serial of unique) {
    if (inflight.has(serial)) continue;
    inflight.add(serial);
    try {
      const result = await fetchDeviceControl(serial);
      if (result.ok) applySnapshot(serial, result.control, result.enforced);
    } catch (error) {
      // 单台探测失败不该把整页打成错误态：保留旧快照，只留一条 warn
      leaseLog("warn", "control.poll.failed", "控制权探测失败：" + serial, serial, {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inflight.delete(serial);
    }
  }
}

export function useControlLeaseRegistry() {
  return { leases, enforced, refreshSerials, applySnapshot, forgetSerial };
}

const BROWSER_PATTERNS = [[/Edg\//, "Edge"], [/Firefox\//, "Firefox"], [/Chrome\//, "Chrome"], [/Safari\//, "Safari"]];

/** 会话之间互相认出的可读标识：设备名 · 浏览器（后端只保留 48 字符）。 */
export function buildControlLabel(deviceName) {
  const ua = typeof navigator === "undefined" ? "" : String(navigator.userAgent ?? "");
  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(ua));
  const name = String(deviceName ?? "").trim() || "Device";
  return `${name} · ${browser ? browser[1] : "Browser"}`;
}

/**
 * 工作区控制权生命周期：进入即申请、20 秒心跳、离开即释放；409 不算异常。
 * @param {{ getSerial?: () => string, getLabel?: () => string }} options
 */
export function useDeviceControl(options = {}) {
  const control = ref(null);
  const error = ref("");
  const busy = ref(false);
  const enforcedFlag = ref(false);

  const serial = computed(() => String(options.getSerial?.() ?? ""));
  const mine = computed(() => Boolean(control.value?.mine));
  const blocked = computed(() => Boolean(control.value?.held) && !control.value.mine);
  const holderLabel = computed(() => String(control.value?.holder?.label ?? ""));
  const label = computed(() => options.getLabel?.() ?? buildControlLabel(options.deviceName));

  let heartbeatTimer = null;
  let activeSerial = "";
  let disposed = false;

  function stopHeartbeat() {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // 成功写快照；失败（含 409）把 holder 顶进快照，返回 false 让调用方停心跳。
  function commit(result, target) {
    enforcedFlag.value = result.enforced;
    if (result.ok) {
      control.value = result.control;
      applySnapshot(target, result.control, result.enforced);
      return true;
    }
    if (result.holder) {
      control.value = { held: true, mine: false, holder: result.holder, expiresAt: 0, ttlMs: 0 };
      applySnapshot(target, control.value, result.enforced);
    }
    return false;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = window.setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
  }

  async function beat() {
    const target = activeSerial;
    if (!target || disposed || !mine.value) {
      stopHeartbeat();
      return;
    }
    try {
      // 续期走独立接口：409 才能区分「被抢占」还是「网络抖了一下」
      if (!commit(await heartbeatDeviceControl(target), target)) {
        stopHeartbeat();
        leaseLog("warn", "control.heartbeat.lost", "控制权已丢失（被其他会话抢占）", target);
      }
    } catch (err) {
      // 单次网络失败不清控制权，下一拍再试；真被抢占时后端会连续 409
      leaseLog("warn", "control.heartbeat.failed", "控制权心跳失败", target, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function acquire({ force = false, silent = false } = {}) {
    const target = serial.value;
    if (!target || busy.value) return false;

    busy.value = true;
    if (!silent) error.value = "";

    try {
      const result = await acquireDeviceControl(target, { label: label.value, force });

      if (commit(result, target)) {
        error.value = "";
        startHeartbeat();
        leaseLog(
          "info",
          force ? "control.acquire.force" : "control.acquire",
          force ? "强制取得控制权" : "取得控制权",
          target,
          { label: label.value, enforced: result.enforced },
        );
        return true;
      }

      stopHeartbeat();
      error.value = result.message;

      if (result.code === "control_lease_held") {
        leaseLog("info", "control.acquire.blocked", "控制权被占用", target, {
          holder: result.holder?.label ?? "",
        });
      } else {
        leaseLog("warn", "control.acquire.failed", "取得控制权失败", target, {
          code: result.code,
          message: result.message,
        });
      }
      return false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      leaseLog("warn", "control.acquire.error", "取得控制权异常", target, { error: error.value });
      return false;
    } finally {
      busy.value = false;
    }
  }

  function takeOver() {
    return acquire({ force: true });
  }

  async function release() {
    const target = serial.value || activeSerial;
    if (!target) return;

    stopHeartbeat();
    busy.value = true;

    try {
      const result = await releaseDeviceControl(target);
      if (result.ok) {
        control.value = result.control;
        applySnapshot(target, result.control, result.enforced);
        leaseLog("info", "control.release", "释放控制权", target);
      } else if (result.holder) {
        // 释放被拒通常说明我们本来就不是持有者（已被抢占），刷快照即可
        control.value = { held: true, mine: false, holder: result.holder, expiresAt: 0, ttlMs: 0 };
        applySnapshot(target, control.value, result.enforced);
      }
    } catch (err) {
      leaseLog("warn", "control.release.failed", "释放控制权失败", target, {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      busy.value = false;
    }
  }

  async function refresh() {
    const target = serial.value;
    if (!target) return;

    try {
      const result = await fetchDeviceControl(target);
      if (!result.ok) return;
      commit(result, target);
      if (mine.value) startHeartbeat();
    } catch (err) {
      leaseLog("warn", "control.refresh.failed", "刷新控制权状态失败", target, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 后台标签页的定时器会被节流到 1 分钟以上，可能让 45 秒 TTL 先过期；
  // 回到前台立刻重走「刷新 + 抢回」，避免界面停在已经失效的「我正在控制」。
  function handleResume() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void enter();
  }

  function handlePageHide() {
    if (mine.value && activeSerial) {
      releaseDeviceControlOnUnload(activeSerial);
      forgetSerial(activeSerial);
    }
  }

  async function enter() {
    const target = serial.value;
    if (!target) return;
    activeSerial = target;
    await refresh();
    // 已持有就不重复申请（切设备再切回来会命中），否则申请一次
    if (!mine.value) await acquire({ silent: true });
  }

  onMounted(() => {
    void enter();
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("focus", handleResume);
      document.addEventListener("visibilitychange", handleResume);
    }
  });

  watch(serial, async (next, previous) => {
    if (next === previous) return;
    if (previous) {
      stopHeartbeat();
      await release();
      forgetSerial(previous);
    }
    control.value = null;
    error.value = "";
    await enter();
  });

  onBeforeUnmount(() => {
    disposed = true;
    stopHeartbeat();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    }
    void release();
  });

  return { control, mine, blocked, holderLabel, enforced: enforcedFlag, busy, error, acquire, takeOver, release };
}
