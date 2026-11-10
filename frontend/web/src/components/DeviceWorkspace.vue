<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppIcon from "./AppIcon.vue";
import DeviceAppManager from "./DeviceAppManager.vue";
import DeviceCastViewport from "./DeviceCastViewport.vue";
import DeviceControlLeaseButton from "./DeviceControlLeaseButton.vue";
import DeviceFileExplorer from "./DeviceFileExplorer.vue";
import DeviceTerminal from "./DeviceTerminal.vue";
import DeviceWorkspaceToolbar from "./DeviceWorkspaceToolbar.vue";
import DeviceWorkspaceLeftPanel from "./DeviceWorkspaceLeftPanel.vue";
import MultiAppDesktop from "./multi-app/MultiAppDesktop.vue";
import MirrorSearchableSelect from "./mirror/MirrorSearchableSelect.vue";
import { useDeviceWorkspaceToolbar } from "../composables/useDeviceWorkspaceToolbar.js";
import { getDeviceStateLabel } from "../utils/device-format.js";
import {
  buildCastPayloadFromCameraSettings,
  buildCastPayloadFromMirrorSettings,
} from "../utils/build-cast-payload.js";
import { buildCastOptionsForDevice } from "../utils/harmony-cast-options.js";
import { startDeviceCast, stopDeviceCast } from "../utils/cast-api.js";
import { openScrcpyServerSetup } from "../utils/scrcpy-server-setup-state.js";
import {
  formatVirtualDisplayUserMessage,
  isVirtualDisplayError,
} from "../utils/cast-error-message.js";
import { createDefaultMirrorSettings } from "../utils/mirror-cast-defaults.js";
import { DEFAULT_CAST_MODE, DEVICE_CAST_MODES } from "../utils/device-cast-modes.js";
import { getErrorMessage } from "../utils/api.js";
import { logDebug, logError, logInfo, logWarn } from "../utils/app-event-logger.js";
import { useAccessRole } from "../composables/useAccessRole.js";
import { useAppFeedback } from "../composables/useAppFeedback.js";
import { WsScrcpyAnnexBPlayer } from "../utils/ws-scrcpy-annexb-player.js";
import { WsScrcpyAudioCanvas } from "../utils/ws-scrcpy-audio-canvas.js";

const props = defineProps({
  device: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const feedback = useAppFeedback();
const { t } = useI18n();
// 只读分享访问：画面能看、截图能存，其余写入口一律置灰
const { readOnly } = useAccessRole();

const isCasting = ref(false);
const castBusy = ref(false);
const castHint = ref("");
const castOptions = ref(buildCastPayloadFromMirrorSettings(createDefaultMirrorSettings()));
const castViewportRef = ref(null);
const leftPanelRef = ref(null);
const filesExplorerOpen = ref(false);
const filesExplorerPath = ref(null);
const appsManagerOpen = ref(false);
const terminalOpen = ref(false);
const mobileCastOptionsOpen = ref(false);
const isMobileLayout = ref(false);
const mobileCastOptionsInitialized = ref(false);
const workspaceCastMode = ref(DEFAULT_CAST_MODE);
const isMultiAppMode = computed(() => workspaceCastMode.value === "multiApp");
const castModeOptions = computed(() =>
  DEVICE_CAST_MODES.map((mode) => ({ label: mode.label, value: mode.id })),
);
const isViewportFullscreen = ref(false);
const fullscreenLayoutMode = ref("portrait");
const fullscreenAutoRotationDeg = ref(0);
const screenLongHorizontal = ref(window.innerWidth >= window.innerHeight);
const fullscreenMobileToolbarActionIds = new Set([
  "recents",
  "home",
  "back",
  "screen-off",
  "power",
  "volume",
  "screenshot",
  "record",
]);

const {
  actions,
  volumeSubActions,
  volumeMenuOpen,
  isVolumeMenuAction,
  actionLabel,
  actionIcon,
  actionTitle,
  isActionDisabled,
  usesPressHold,
  isActionPressed,
  isActionRecording,
  onToolbarPointerDown,
  onToolbarPointerUp,
  handleToolbarClick,
  handleVolumeSubAction,
} = useDeviceWorkspaceToolbar({
  device: props.device,
  isCasting,
  castViewportRef,
  castOptions,
  mirrorSettingsRef: leftPanelRef,
  onHint: (message) => {
    if (message) {
      feedback.info(message);
    }
  },
  onOpenFiles: () => {
    filesExplorerPath.value = null;
    filesExplorerOpen.value = true;
    logInfo("ui", "modal.files.open", "打开文件管理器", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
  },
  onOpenApps: () => {
    appsManagerOpen.value = true;
    logInfo("ui", "modal.apps.open", "打开应用管理器", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
  },
  onOpenTerminal: () => {
    terminalOpen.value = true;
    logInfo("ui", "modal.terminal.open", "打开终端", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
  },
});

watch(castHint, (message) => {
  if (!message) {
    return;
  }

  feedback.error(message);
});

// 控制权租约（T-422）放在 DeviceControlLeaseButton 里自治：这里只接收「是否只读」
// 与持有者名字，用于把向设备发控制消息的按键置灰并给出 title。
const controlReadonly = ref(false);
const controlHolderName = ref("");

// 只读时置灰的是「真的往设备发控制消息」的那几个键：导航/音量/旋转。
// 截屏、录屏、文件、应用、终端仍可用——看画面和翻文件不该被别人的租约挡住。
const CONTROL_MESSAGE_ACTION_IDS = new Set([
  "recents",
  "home",
  "back",
  "screen-off",
  "power",
  "rotate",
  "volume",
]);

// viewer 除了「往设备发指令」，还拿不到安装/上传/终端入口：
// 这些弹窗里的每个动作都是写操作，服务端会 403，不如在入口处就说清楚
const VIEWER_BLOCKED_ACTION_IDS = new Set([...CONTROL_MESSAGE_ACTION_IDS, "files", "apps", "terminal"]);

function handleControlReadonlyChange(value) {
  controlReadonly.value = Boolean(value);
}

function handleControlHolderChange(value) {
  controlHolderName.value = String(value ?? "");
}

function toolbarActionDisabled(action) {
  if (readOnly.value && VIEWER_BLOCKED_ACTION_IDS.has(action.id)) {
    return true;
  }

  if (controlReadonly.value && CONTROL_MESSAGE_ACTION_IDS.has(action.id)) {
    return true;
  }

  return isActionDisabled(action);
}

function toolbarActionTitle(action) {
  if (readOnly.value && VIEWER_BLOCKED_ACTION_IDS.has(action.id)) {
    return t("access.readOnlyAction");
  }

  if (controlReadonly.value && CONTROL_MESSAGE_ACTION_IDS.has(action.id)) {
    return t("devices.control.readonlyHint", {
      name: controlHolderName.value || t("devices.control.anonymousHolder"),
    });
  }

  return actionTitle(action);
}

const stateLabel = computed(() => getDeviceStateLabel(props.device.state));
const toolbarActions = computed(() => {
  if (!(isMobileLayout.value && isViewportFullscreen.value)) {
    return actions;
  }

  return actions.filter((action) => fullscreenMobileToolbarActionIds.has(action.id));
});

function handleCameraControl(payload) {
  castViewportRef.value?.sendCameraControl?.(payload);
}

async function startCast(options) {
  castHint.value = "";

  if (!props.device?.serial) {
    castHint.value = "设备序列号无效。";
    logWarn("cast", "cast.start.invalid", "开始投屏失败：设备序列号无效");
    return;
  }

  if (!props.device.connected) {
    castHint.value = "设备未在线，无法开始投屏。";
    logWarn("cast", "cast.start.offline", "开始投屏失败：设备未在线", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
    return;
  }

  const isJpegCast = props.device?.platform === "harmony" || props.device?.platform === "ios";
  const isHarmonyCast = props.device?.platform === "harmony";
  const isCameraCast = options?.castMode === "camera";
  const audioOnly = !isJpegCast && !isCameraCast && options?.mirror?.video?.disabled === true;

  if (isCameraCast && Number(props.device.sdkVersion) > 0 && Number(props.device.sdkVersion) < 31) {
    castHint.value = "摄像头投屏需要 Android 12（API 31）及以上。";
    logWarn("cast", "cast.start.unsupported", "开始投屏失败：摄像头模式需要 Android 12+", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
      details: { sdkVersion: props.device.sdkVersion },
    });
    return;
  }

  if (!isJpegCast) {
    if (audioOnly) {
      if (!WsScrcpyAudioCanvas.isSupported()) {
        castHint.value = "当前浏览器不支持 Web Audio，无法使用仅音频模式。";
        logWarn("cast", "cast.start.unsupported", "开始投屏失败：浏览器不支持 Web Audio");
        return;
      }
    } else if (!WsScrcpyAnnexBPlayer.isSupported()) {
      castHint.value = "当前浏览器不支持 WebCodecs，请使用 Chrome 或 Edge。";
      logWarn("cast", "cast.start.unsupported", "开始投屏失败：浏览器不支持 WebCodecs");
      return;
    }
  }

  if (options) {
    castOptions.value = options;
  }

  logInfo("cast", "cast.start.request", "点击开始投屏", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: {
      platform: props.device.platform,
      castMode: options?.castMode ?? castOptions.value?.castMode ?? "mirror",
      options: castOptions.value,
    },
  });

  castBusy.value = true;

  let castPayload = null;
  const isHarmonyDevice = props.device?.platform === "harmony";
  const isIosDevice = props.device?.platform === "ios";
  const isJpegDevice = isHarmonyDevice || isIosDevice;

  try {
    castPayload = await startDeviceCast(
      props.device.serial,
      buildCastOptionsForDevice(props.device, castOptions.value),
    );

    if (castPayload?.error === "scrcpy_server_missing") {
      castHint.value = castPayload.message ?? "设备端 scrcpy-server 未安装";
      openScrcpyServerSetup({
        reason: "投屏启动时未找到设备端 scrcpy-server",
        detail: castPayload.install ?? null,
      });
      castBusy.value = false;
      return;
    }

    const isJpegSession =
      isJpegDevice ||
      castPayload?.castProtocol === "harmony-jpeg" ||
      castPayload?.castProtocol === "ios-mjpeg";
    isCasting.value = true;
    await nextTick();
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const viewport = castViewportRef.value;

    if (!viewport?.beginCast) {
      throw new Error("投屏画面组件未就绪，请刷新页面后重试。");
    }

    await viewport.beginCast(castPayload);
    logInfo("cast", "cast.start.success", "投屏已启动", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
      details: {
        castProtocol: castPayload?.castProtocol,
        session: castPayload,
      },
    });
    if (isMobileLayout.value) {
      mobileCastOptionsOpen.value = false;
      await nextTick();
      window.dispatchEvent(new Event("resize"));
    }
  } catch (error) {
    const isJpegSession =
      isJpegDevice ||
      castPayload?.castProtocol === "harmony-jpeg" ||
      castPayload?.castProtocol === "ios-mjpeg";
    castHint.value = getErrorMessage(error, "投屏启动失败");
    logError("cast", "cast.start.failed", `投屏启动失败：${castHint.value}`, {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
      details: {
        error: getErrorMessage(error, "投屏启动失败"),
      },
    });
    isCasting.value = false;

    try {
      if (isJpegSession && castPayload) {
        // Backend JPEG pipe keeps running (ECHO-style); only tear down the browser WS layer.
        await castViewportRef.value?.stopCast?.({ backend: false });
      } else {
        await castViewportRef.value?.stopCast?.({ backend: true });
        if (props.device?.serial) {
          await stopDeviceCast(props.device.serial);
        }
      }
    } catch {
      if (props.device?.serial && !(isJpegSession && castPayload)) {
        await stopDeviceCast(props.device.serial).catch(() => {});
      }
    }
  } finally {
    castBusy.value = false;
  }
}

function updateCastOptions(options) {
  const previous = castOptions.value;
  castOptions.value = options;

  logDebug("cast", "cast.options.update", "投屏参数已更新", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: {
      previous,
      next: options,
    },
  });
}

async function stopCast() {
  castHint.value = "";
  castBusy.value = true;

  logInfo("cast", "cast.stop.request", "请求停止投屏", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
  });

  try {
    await castViewportRef.value?.stopCast?.({ backend: false });

    if (props.device?.serial) {
      await stopDeviceCast(props.device.serial);
    }
  } catch (error) {
    castHint.value = getErrorMessage(error, "停止投屏失败");
    logError("cast", "cast.stop.failed", `停止投屏失败：${castHint.value}`, {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
  } finally {
    isCasting.value = false;
    castBusy.value = false;
    logInfo("cast", "cast.stop.done", "投屏已停止", {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
    });
  }
}

function handleCastFailed() {
  if (!isCasting.value) {
    return;
  }

  const viewport = castViewportRef.value;
  const message = viewport?.errorMessage?.value ?? viewport?.errorMessage;

  if (typeof message === "string" && message) {
    castHint.value = isVirtualDisplayError(message)
      ? formatVirtualDisplayUserMessage(message)
      : message;
    if (isVirtualDisplayError(message)) {
      feedback.error(castHint.value);
    }
  }

  logError("stream", "cast.stream.failed", `串流失败：${message || "未知错误"}`, {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: { message },
  });

  const isJpegSession =
    props.device?.platform === "harmony" ||
    props.device?.platform === "ios" ||
    viewport?.activeCastMode?.value === "harmony" ||
    viewport?.activeCastMode?.value === "ios";

  if (isJpegSession) {
    isCasting.value = false;
    void viewport?.stopCast?.({ backend: false });
    return;
  }

  void stopCast();
}

async function handleClose() {
  logInfo("navigation", "workspace.back", "点击返回设备列表", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: { casting: isCasting.value },
  });
  await stopCast();
  emit("close");
}

function updateMobileLayoutState() {
  screenLongHorizontal.value = window.innerWidth >= window.innerHeight;
  isMobileLayout.value = window.innerWidth <= 560;

  if (isMobileLayout.value && !mobileCastOptionsInitialized.value) {
    mobileCastOptionsOpen.value = true;
    mobileCastOptionsInitialized.value = true;
  }

  if (!isMobileLayout.value) {
    mobileCastOptionsOpen.value = true;
  }
}

function updateFullscreenLayoutMode() {
  const fullscreenEl = document.fullscreenElement;
  const fullscreenWidth = fullscreenEl?.clientWidth ?? 0;
  const fullscreenHeight = fullscreenEl?.clientHeight ?? 0;
  const currentWidth =
    fullscreenWidth > 0 ? fullscreenWidth : (window.visualViewport?.width ?? window.innerWidth);
  const currentHeight =
    fullscreenHeight > 0 ? fullscreenHeight : (window.visualViewport?.height ?? window.innerHeight);
  const currentLongHorizontal = currentWidth >= currentHeight;
  fullscreenLayoutMode.value = currentLongHorizontal ? "landscape" : "portrait";

  // Mobile fullscreen: rotate preview (0/90) to minimize black bars (maximize scale).
  if (!(isMobileLayout.value && isViewportFullscreen.value)) {
    fullscreenAutoRotationDeg.value = 0;
    return;
  }

  const targetSize = castViewportRef.value?.getEffectiveScreenSize?.() ?? { width: 0, height: 0 };
  const targetW = Math.max(0, Number(targetSize.width) || 0);
  const targetH = Math.max(0, Number(targetSize.height) || 0);
  if (!targetW || !targetH || !currentWidth || !currentHeight) {
    fullscreenAutoRotationDeg.value = 0;
    return;
  }

  const scale0 = Math.min(currentWidth / targetW, currentHeight / targetH);
  const scale90 = Math.min(currentWidth / targetH, currentHeight / targetW);
  fullscreenAutoRotationDeg.value = scale90 > scale0 ? 90 : 0;
  castViewportRef.value?.applyPreviewRotation?.(fullscreenAutoRotationDeg.value);
}

async function toggleMobileCastOptions() {
  mobileCastOptionsOpen.value = !mobileCastOptionsOpen.value;
  if (!mobileCastOptionsOpen.value) {
    await nextTick();
    window.dispatchEvent(new Event("resize"));
  }
}

onMounted(() => {
  updateMobileLayoutState();
  updateFullscreenLayoutMode();
  window.addEventListener("resize", updateMobileLayoutState);
  window.addEventListener("resize", updateFullscreenLayoutMode);
  window.addEventListener("orientationchange", updateFullscreenLayoutMode);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateMobileLayoutState);
  window.removeEventListener("resize", updateFullscreenLayoutMode);
  window.removeEventListener("orientationchange", updateFullscreenLayoutMode);
  logInfo("navigation", "workspace.unmount", "设备工作区页面卸载", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: { casting: isCasting.value },
  });
  void stopCast();
});

function handleFilesExplorerClose() {
  filesExplorerOpen.value = false;
  filesExplorerPath.value = null;
  logInfo("ui", "modal.files.close", "关闭文件管理器", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
  });
}

function handleOpenAppDataInFiles(devicePath) {
  appsManagerOpen.value = false;
  filesExplorerPath.value = devicePath;
  filesExplorerOpen.value = true;
}

async function handleViewportFullscreenChange(isFullscreen) {
  isViewportFullscreen.value = isFullscreen;
  logInfo("ui", isFullscreen ? "viewport.fullscreen.enter" : "viewport.fullscreen.exit", isFullscreen ? "进入全屏" : "退出全屏", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
  });
  updateFullscreenLayoutMode();
  if (isFullscreen && isMobileLayout.value) {
    mobileCastOptionsOpen.value = false;
  }
  if (!isFullscreen) {
    fullscreenAutoRotationDeg.value = 0;
    const restoreRotation = castOptions.value?.mirror?.video?.rotationDeg ?? 0;
    castViewportRef.value?.applyPreviewRotation?.(restoreRotation);
  }
  await nextTick();
  window.dispatchEvent(new Event("resize"));
}
</script>

<template>
  <section
    class="device-workspace"
    :class="{
      'device-workspace--fullscreen-landscape': isViewportFullscreen && fullscreenLayoutMode === 'landscape',
      'device-workspace--fullscreen-portrait': isViewportFullscreen && fullscreenLayoutMode === 'portrait',
    }"
  >
    <header class="device-workspace__header">
      <div class="device-workspace__intro">
        <button type="button" class="device-workspace__back" @click="handleClose">
          <AppIcon name="arrow-left" />
          <span>返回设备列表</span>
        </button>
        <div class="device-workspace__meta">
          <h2>{{ device.displayName }}</h2>
          <p>
            <span>{{ device.serial }}</span>
            <span class="device-workspace__dot">·</span>
            <span>{{ stateLabel }}</span>
          </p>
        </div>
      </div>

      <div v-if="isMultiAppMode" class="device-workspace__multi-app-mode">
        <MirrorSearchableSelect v-model:value="workspaceCastMode" :options="castModeOptions" />
      </div>

      <DeviceWorkspaceToolbar
        :actions="toolbarActions"
        :volume-sub-actions="volumeSubActions"
        :volume-menu-open="volumeMenuOpen"
        :is-volume-menu-action="isVolumeMenuAction"
        :action-label="actionLabel"
        :action-icon="actionIcon"
        :action-title="toolbarActionTitle"
        :is-action-disabled="toolbarActionDisabled"
        :uses-press-hold="usesPressHold"
        :is-action-pressed="isActionPressed"
        :is-action-recording="isActionRecording"
        :on-toolbar-pointer-down="onToolbarPointerDown"
        :on-toolbar-pointer-up="onToolbarPointerUp"
        :handle-toolbar-click="handleToolbarClick"
        :handle-volume-sub-action="handleVolumeSubAction"
        :long-horizontal="screenLongHorizontal"
        :floating="isViewportFullscreen"
      >
        <template v-if="!readOnly" #lease>
          <DeviceControlLeaseButton
            :device="device"
            @update:readonly="handleControlReadonlyChange"
            @update:holder="handleControlHolderChange"
          />
        </template>
      </DeviceWorkspaceToolbar>
    </header>

    <div
      class="device-workspace__split"
      :class="{
        'device-workspace__split--multi-app': isMultiAppMode,
        'device-workspace__split--mobile-options-open': isMobileLayout && mobileCastOptionsOpen,
        'device-workspace__split--mobile-options-collapsed': isMobileLayout && !mobileCastOptionsOpen,
      }"
    >
      <div v-if="isMobileLayout" class="device-workspace__mobile-cast-actions">
        <button
          type="button"
          class="device-workspace__mobile-cast-toggle"
          @click="toggleMobileCastOptions"
        >
          {{ mobileCastOptionsOpen ? "收起投屏选项" : "打开投屏选项" }}
        </button>
        <button
          v-if="!mobileCastOptionsOpen"
          type="button"
          class="device-workspace__mobile-cast-stop"
          :disabled="!isCasting || castBusy"
          @click="stopCast"
        >
          取消投屏
        </button>
      </div>
      <DeviceWorkspaceLeftPanel
        v-show="(!isMobileLayout || mobileCastOptionsOpen) && !isMultiAppMode"
        ref="leftPanelRef"
        v-model:cast-mode="workspaceCastMode"
        class="device-workspace__pane device-workspace__pane--left"
        :device="device"
        :casting="isCasting"
        :cast-busy="castBusy"
        @start-cast="startCast"
        @stop-cast="stopCast"
        @cast-options-change="updateCastOptions"
        @camera-control="handleCameraControl"
      />
      <MultiAppDesktop
        v-if="isMultiAppMode"
        class="device-workspace__pane device-workspace__pane--right device-workspace__pane--multi-app"
        :device="device"
        @switch-mirror="workspaceCastMode = 'mirror'"
        @fullscreen-change="handleViewportFullscreenChange"
      />
      <DeviceCastViewport
        v-show="!isMultiAppMode && (!isMobileLayout || !mobileCastOptionsOpen)"
        ref="castViewportRef"
        v-model:cast-options="castOptions"
        class="device-workspace__pane device-workspace__pane--right"
        :device="device"
        :casting="isCasting"
        @cast-failed="handleCastFailed"
        @fullscreen-change="handleViewportFullscreenChange"
        @screen-size-change="updateFullscreenLayoutMode"
      />
    </div>

    <DeviceFileExplorer
      v-if="!readOnly"
      :device="device"
      :open="filesExplorerOpen"
      :open-path="filesExplorerPath"
      @close="handleFilesExplorerClose"
    />
    <DeviceAppManager
      v-if="!readOnly"
      :device="device"
      :open="appsManagerOpen"
      @close="appsManagerOpen = false"
      @open-files="handleOpenAppDataInFiles"
    />
    <DeviceTerminal
      v-if="!readOnly"
      :device="device"
      :open="terminalOpen"
      @close="terminalOpen = false"
    />
  </section>
</template>
