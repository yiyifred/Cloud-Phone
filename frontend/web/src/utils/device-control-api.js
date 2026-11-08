import { requestJson } from "./api.js";

/**
 * 设备控制权租约（control lease）HTTP 封装。
 *
 * 后端语义（见 backend/node/src/routes/device-control-routes.js）：
 * - GET  /api/devices/:serial/control            读当前快照，永远 200
 * - POST /api/devices/:serial/control/acquire    申请；被他人持有时 409 + holder
 * - POST /api/devices/:serial/control/release    释放（非持有者 409）
 * - POST /api/devices/:serial/control/heartbeat  续期（非持有者 409）
 *
 * 为什么全部走 allowFailure：409 是正常业务分支（「别人正在控制」），不是异常。
 * 交给 requestJson 抛错会把 holder 信息丢掉，UI 就只能显示一句「请求失败」。
 */

const CONTROL_PATH = "/api/devices";

function controlUrl(serial, action = "") {
  const base = `${CONTROL_PATH}/${encodeURIComponent(serial)}/control`;
  return action ? `${base}/${action}` : base;
}

/** 把后端返回的 control 快照归一化，避免 UI 到处写 `?? false`。 */
export function normalizeControlSnapshot(control) {
  if (!control || typeof control !== "object") {
    return null;
  }

  const holder = control.holder && typeof control.holder === "object" ? control.holder : null;

  return {
    held: Boolean(control.held),
    mine: Boolean(control.mine),
    holder: holder
      ? {
          reference: String(holder.reference ?? ""),
          label: String(holder.label ?? ""),
          acquiredAt: Number(holder.acquiredAt) || 0,
        }
      : null,
    expiresAt: Number(control.expiresAt) || 0,
    ttlMs: Number(control.ttlMs) || 0,
  };
}

function unwrap(payload) {
  if (payload?.success === false) {
    return {
      ok: false,
      code: String(payload.error ?? "control_lease_failed"),
      message: String(payload.message ?? ""),
      holder: payload.holder && typeof payload.holder === "object" ? payload.holder : null,
      enforced: Boolean(payload.enforced),
      control: null,
    };
  }

  return {
    ok: true,
    code: "",
    message: "",
    holder: null,
    enforced: Boolean(payload?.enforced),
    control: normalizeControlSnapshot(payload?.control),
  };
}

export async function fetchDeviceControl(serial, options = {}) {
  const payload = await requestJson(controlUrl(serial), {
    method: "GET",
    signal: options.signal,
    allowFailure: true,
  });

  return unwrap(payload);
}

async function postControl(serial, action, body, options = {}) {
  // body 统一带一个对象：空体会让 fetch 不设 X-Encrypted-Request，
  // 后端读不到 body 就只能当「无参数」处理，label / force 会被静默丢弃。
  const payload = await requestJson(controlUrl(serial, action), {
    method: "POST",
    body: body ?? {},
    signal: options.signal,
    allowFailure: true,
  });

  return unwrap(payload);
}

export function acquireDeviceControl(serial, { label = "", force = false } = {}) {
  return postControl(serial, "acquire", { label, force: force === true });
}

export function releaseDeviceControl(serial) {
  return postControl(serial, "release", {});
}

export function heartbeatDeviceControl(serial) {
  return postControl(serial, "heartbeat", {});
}

/**
 * 关闭标签页时尽力释放租约。
 *
 * 为什么用 sendBeacon：页面卸载阶段 requestJson 的 async 加密链跑不完，
 * 浏览器会直接丢掉请求。beacon 不保证送达，所以它只是「尽力而为」，
 * 真正的兜底是后端 45 秒 TTL + 心跳停发。
 */
export function releaseDeviceControlOnUnload(serial) {
  if (!serial || typeof navigator === "undefined" || !navigator.sendBeacon) {
    return false;
  }

  try {
    return navigator.sendBeacon(controlUrl(serial, "release"), new Blob([], { type: "application/json" }));
  } catch {
    return false;
  }
}
