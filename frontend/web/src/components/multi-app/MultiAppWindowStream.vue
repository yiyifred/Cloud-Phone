<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, unref, watch } from "vue";

import MultiAppVdErrorDialog from "./MultiAppVdErrorDialog.vue";
import { useAppExitWatch } from "../../composables/useAppExitWatch.js";
import { useDeviceCast } from "../../composables/useDeviceCast.js";
import { startDeviceCast, stopDeviceCast } from "../../utils/cast-api.js";
import {
  formatVirtualDisplayUserMessage,
  isVirtualDisplayError,
} from "../../utils/cast-error-message.js";
import {
  buildMultiAppCastOptions,
  resolveMultiAppMaxFps,
  vdOptionsFromContent,
} from "../../utils/multi-app-cast-options.js";
import { withTimeout } from "../../utils/with-timeout.js";

const props = defineProps({
  device: { type: Object, required: true },
  window: { type: Object, required: true },
  contentWidth: { type: Number, required: true },
  contentHeight: { type: Number, required: true },
  focused: { type: Boolean, default: false },
});

const emit = defineEmits(["close-window", "switch-mirror"]);

const canvasRef = ref(null);
const viewportRef = ref(null);
const rotatorRef = ref(null);
/** @type {number | null} */
let appliedMaxFps = null;

function currentMaxFps() {
  return resolveMultiAppMaxFps({
    focused: props.focused,
    minimized: Boolean(props.window?.minimized),
  });
}

function buildOptionsFromWindow() {
  const vd = vdOptionsFromContent(props.contentWidth, props.contentHeight);
  const win = props.window || {};
  return buildMultiAppCastOptions({
    width: win.vdWidth || vd.width,
    height: win.vdHeight || vd.height,
    dpi: win.vdDpi || vd.dpi,
    packageName: win.packageName,
    deviceSdk: props.device?.sdkVersion,
    orientation: win.orientation,
    maxFps: currentMaxFps(),
  });
}

const castOptions = ref(buildOptionsFromWindow());
const cast = useDeviceCast(
  toRef(props, "device"),
  canvasRef,
  castOptions,
  rotatorRef,
  viewportRef,
);

const starting = ref(false);
const errorMessage = ref("");
const ready = ref(false);
const showVdError = ref(false);
const vdErrorDetail = ref("");
let resizeTimer = null;
let reconnectTimer = null;
let started = false;
let resizeReadyAt = 0;
let backendConsumerHeld = false;
let backendPayload = null;
let unmounted = false;
let reconnectAttempts = 0;
/** Last VD size actually sent to scrcpy (do not compare against window.vd* — that is updated earlier). */
let lastSentVd = { width: 0, height: 0 };

const statusText = computed(() => {
  if (starting.value) return "正在创建虚拟屏…";
  if (errorMessage.value) return errorMessage.value;
  if (!ready.value) return "等待画面…";
  return "";
});

const exitWatch = useAppExitWatch({
  getSerial: () => String(props.device?.serial || ""),
  getPackageName: () => String(props.window?.packageName || ""),
  enabled: () => Boolean(ready.value && started && !showVdError.value && !starting.value),
  onExit: () => emit("close-window"),
  graceMs: 15_000,
  missLimit: 4,
});

function presentError(raw) {
  const text = raw instanceof Error ? raw.message : String(raw || "");
  if (isVirtualDisplayError(text)) {
    const friendly = formatVirtualDisplayUserMessage(text);
    errorMessage.value = friendly;
    vdErrorDetail.value = friendly;
    showVdError.value = true;
    return;
  }
  errorMessage.value = text || "投屏启动失败";
}

async function releaseBackendConsumer() {
  if (!backendConsumerHeld) return;
  backendConsumerHeld = false;
  backendPayload = null;
  const serial = props.device?.serial;
  if (!serial) return;
  try {
    await stopDeviceCast(serial);
  } catch {
    // ignore
  }
}

async function startWindowCast({ force = false, keepBackend = false } = {}) {
  if (unmounted) return;
  if ((!force && started) || starting.value) return;

  const serial = props.device?.serial;
  if (!serial) {
    presentError("设备序列号无效");
    return;
  }
  if (props.device?.platform && props.device.platform !== "android") {
    presentError("多应用窗口投屏目前仅支持 Android 设备");
    return;
  }

  // force reconnect: tear down client WS; keepBackend reuses scrcpy-server + VD
  // (same idea as keeping one `scrcpy --new-display --start-app` process alive).
  if (force && (started || backendConsumerHeld)) {
    await stopWindowCast({ releaseBackend: !keepBackend });
  }

  starting.value = true;
  errorMessage.value = "";
  showVdError.value = false;
  ready.value = false;
  appliedMaxFps = null;
  exitWatch.bumpGrace(12_000);
  castOptions.value = buildOptionsFromWindow();

  try {
    await nextTick();
    if (!canvasRef.value) await nextTick();
    if (!canvasRef.value) throw new Error("投屏画布未就绪");

    let payload = null;
    if (keepBackend && backendConsumerHeld && backendPayload?.success) {
      payload = backendPayload;
    } else {
      // cast/start pushes server; VD + start_app apply on type-101 after WS connect
      payload = await withTimeout(
        startDeviceCast(serial, castOptions.value),
        45_000,
        "创建虚拟屏超时（cast/start），请重试",
      );
      backendPayload = payload;
    }
    if (unmounted) {
      backendConsumerHeld = true;
      await releaseBackendConsumer();
      return;
    }
    backendConsumerHeld = true;
    starting.value = false;
    started = true;
    resizeReadyAt = Date.now() + 1500;

    await cast.beginCast(payload);
    ready.value = true;
    appliedMaxFps = currentMaxFps();
    reconnectAttempts = 0;
    lastSentVd = {
      width: Number(props.window?.vdWidth) || 0,
      height: Number(props.window?.vdHeight) || 0,
    };
    exitWatch.bumpGrace(10_000);
  } catch (error) {
    ready.value = false;
    started = false;
    try {
      await cast.stopCast?.({ backend: false });
    } catch {
      // ignore
    }
    await releaseBackendConsumer();
    presentError(error);
  } finally {
    starting.value = false;
  }
}

function scheduleReconnect(reason) {
  if (unmounted || reconnectTimer || starting.value || showVdError.value) return;
  if (reconnectAttempts >= 3) {
    presentError(reason || "画面中断，重连失败");
    return;
  }
  reconnectAttempts += 1;
  exitWatch.bumpGrace(15_000);
  errorMessage.value = "画面中断，正在重连…";
  ready.value = false;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    errorMessage.value = "";
    // keepBackend=true: 重连时不要释放后端 consumer，避免 scrcpy-server 被提前杀掉
    void startWindowCast({ force: true, keepBackend: true });
  }, 400);
}

function applyResizeNow() {
  if (unmounted || !started || !ready.value) {
    return;
  }
  const vd = vdOptionsFromContent(props.contentWidth, props.contentHeight);
  const prevW = lastSentVd.width || 0;
  const prevH = lastSentVd.height || 0;
  if (Math.abs(vd.width - prevW) < 24 && Math.abs(vd.height - prevH) < 24) {
    return;
  }
  // Pause exit-watch during encoder reset (dumpsys can flap).
  exitWatch.bumpGrace(12_000);
  if (props.window) {
    props.window.vdWidth = vd.width;
    props.window.vdHeight = vd.height;
    props.window.vdDpi = vd.dpi;
  }
  lastSentVd = { width: vd.width, height: vd.height };
  try {
    cast.sendResizeDisplay?.(vd.width, vd.height);
  } catch {
    scheduleReconnect("resize_send_failed");
  }
}

function scheduleResize() {
  if (!started || !ready.value) {
    return;
  }
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
  }
  // Defer until past startup grace, then debounce rapid drag-resizes.
  const untilReady = Math.max(0, resizeReadyAt - Date.now());
  const delay = untilReady > 0 ? untilReady + 40 : 350;
  resizeTimer = window.setTimeout(() => {
    resizeTimer = null;
    applyResizeNow();
  }, delay);
}

function sendBack() {
  cast.sendNavigation?.("back");
}

async function stopWindowCast({ releaseBackend = true } = {}) {
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const hadSession = started || backendConsumerHeld;
  started = false;
  ready.value = false;
  if (!hadSession) return;
  try {
    await cast.stopCast?.({ backend: false });
  } catch {
    // ignore
  }
  if (releaseBackend) {
    await releaseBackendConsumer();
  }
}

watch(() => [props.contentWidth, props.contentHeight], () => scheduleResize());

watch(
  () => [props.focused, props.window?.minimized],
  () => {
    applyMaxFpsNow();
  },
);

/**
 * Top window → 60fps; others → 30fps. Keep VD size in options so type-101
 * does not restart capture with a stale new_display size after resize.
 */
function applyMaxFpsNow() {
  if (unmounted || !started || !ready.value) {
    return;
  }
  const maxFps = currentMaxFps();
  if (appliedMaxFps === maxFps) {
    return;
  }
  const win = props.window || {};
  const opts = castOptions.value;
  if (!opts?.mirror?.video) {
    return;
  }
  castOptions.value = {
    ...opts,
    mirror: {
      ...opts.mirror,
      video: { ...opts.mirror.video, maxFps },
      screen: {
        ...opts.mirror.screen,
        newDisplayWidth: win.vdWidth || opts.mirror.screen?.newDisplayWidth,
        newDisplayHeight: win.vdHeight || opts.mirror.screen?.newDisplayHeight,
        newDisplayDpi: win.vdDpi || opts.mirror.screen?.newDisplayDpi,
      },
    },
  };
  if (cast.resendStreamParameters?.("max-fps")) {
    appliedMaxFps = maxFps;
  }
}

watch(
  () => props.window.packageName,
  (pkg, prev) => {
    if (!prev || pkg === prev) return;
    void startWindowCast({ force: true });
  },
);

watch(
  () => unref(cast.errorMessage),
  (message) => {
    const text = typeof message === "string" ? message : "";
    if (!text) return;
    if (isVirtualDisplayError(text)) {
      presentError(text);
      return;
    }
    if (started && !starting.value && !showVdError.value) {
      scheduleReconnect(text);
    }
  },
);

watch(
  () => unref(cast.status),
  (status) => {
    if (status === "error" && started && !starting.value && !showVdError.value) {
      scheduleReconnect("cast_status_error");
    }
  },
);

onMounted(() => {
  void startWindowCast();
});

onBeforeUnmount(() => {
  unmounted = true;
  void stopWindowCast();
});

defineExpose({ sendBack, stopWindowCast });
</script>

<template>
  <div ref="viewportRef" class="multi-app-window-stream">
    <canvas ref="canvasRef" class="multi-app-window-stream__canvas" />
    <div v-if="statusText" class="multi-app-window-stream__status">{{ statusText }}</div>
    <MultiAppVdErrorDialog
      v-model:show="showVdError"
      :detail="vdErrorDetail"
      @close-window="emit('close-window')"
      @switch-mirror="emit('switch-mirror')"
      @retry="startWindowCast({ force: true })"
    />
  </div>
</template>
