<script setup>
import { computed, ref, watch } from "vue";
import { NButton, NForm, NFormItem, NSpace, NText } from "naive-ui";

import CameraCastSettings from "./mirror/CameraCastSettings.vue";
import HarmonyCastSettings from "./mirror/HarmonyCastSettings.vue";
import MirrorCastSettings from "./mirror/MirrorCastSettings.vue";
import MirrorSearchableSelect from "./mirror/MirrorSearchableSelect.vue";
import HelpHint from "./ui/HelpHint.vue";
import PanelAlert from "./ui/PanelAlert.vue";
import {
  buildCastPayloadFromCameraSettings,
  buildCastPayloadFromMirrorSettings,
} from "../utils/build-cast-payload.js";
import { buildHarmonyCastOptions } from "../utils/harmony-cast-options.js";
import { createDefaultCameraSettings } from "../utils/camera-cast-defaults.js";
import { createDefaultMirrorSettings } from "../utils/mirror-cast-defaults.js";
import { DEFAULT_CAST_MODE, DEVICE_CAST_MODES } from "../utils/device-cast-modes.js";
import { logDebug, logInfo } from "../utils/app-event-logger.js";

const props = defineProps({
  device: {
    type: Object,
    required: true,
  },
  casting: {
    type: Boolean,
    required: true,
  },
  castBusy: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["start-cast", "stop-cast", "cast-options-change", "camera-control"]);

const castMode = defineModel("castMode", { default: DEFAULT_CAST_MODE });

const mirrorSettingsRef = ref(null);
const cameraSettingsRef = ref(null);
const harmonySettingsRef = ref(null);

const isHarmonyDevice = computed(() => props.device?.platform === "harmony");
const isIosDevice = computed(() => props.device?.platform === "ios");
const isJpegCastDevice = computed(() => isHarmonyDevice.value || isIosDevice.value);

const canStartCast = computed(() => {
  if (props.casting || props.castBusy) {
    return false;
  }

  return Boolean(props.device?.connected && props.device?.serial);
});

const startButtonLabel = computed(() => (props.castBusy ? "正在处理…" : "开始投屏"));

const castHelpText = computed(() => {
  if (!props.device.connected) {
    return "设备未在线，无法投屏。";
  }

  if (isHarmonyDevice.value) {
    return "请确认设备已通过 HDC 在线。";
  }

  if (isIosDevice.value) {
    return "通过 Mac 上的 WebDriverAgent 推送 MJPEG 画面；支持触控与主屏幕/电源/音量键。";
  }

  return "网页投屏只需 adb + scrcpy-server，无需双击 scrcpy.exe。";
});

const modeOptions = computed(() =>
  DEVICE_CAST_MODES.map((mode) => ({ label: mode.label, value: mode.id })),
);

watch(castMode, (nextMode, previousMode) => {
  if (previousMode && nextMode !== previousMode && !props.casting) {
    logInfo("cast", "cast.mode.change", `切换投屏模式：${previousMode} → ${nextMode}`, {
      deviceSerial: props.device.serial,
      deviceName: props.device.displayName ?? props.device.serial,
      details: { from: previousMode, to: nextMode },
    });
  }
});

function buildCastOptions() {
  if (isJpegCastDevice.value) {
    if (isHarmonyDevice.value) {
      return harmonySettingsRef.value?.getSettings?.() ?? buildHarmonyCastOptions(props.device);
    }

    return {};
  }

  if (castMode.value === "camera") {
    const settings = cameraSettingsRef.value?.getSettings?.() ?? createDefaultCameraSettings();
    return buildCastPayloadFromCameraSettings(settings, props.device.sdkVersion);
  }

  const settings = mirrorSettingsRef.value?.getSettings?.() ?? createDefaultMirrorSettings();
  return buildCastPayloadFromMirrorSettings(settings, props.device.sdkVersion);
}

function handleStartClick() {
  const options = buildCastOptions();
  logInfo("cast", "cast.start.click", "点击开始投屏按钮", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: { options },
  });
  emit("start-cast", options);
}

function handleStopClick() {
  logInfo("cast", "cast.stop.click", "点击取消投屏按钮", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
  });
  emit("stop-cast");
}

function handleSettingsChange(settings) {
  if (props.casting) {
    return;
  }

  const options = buildCastOptions();
  logDebug("cast", "cast.settings.change", "修改投屏参数", {
    deviceSerial: props.device.serial,
    deviceName: props.device.displayName ?? props.device.serial,
    details: {
      castMode: castMode.value,
      settings,
      options,
    },
  });
  emit("cast-options-change", options);
}

function stepPreviewRotationDeg() {
  return mirrorSettingsRef.value?.stepPreviewRotationDeg?.();
}

defineExpose({ stepPreviewRotationDeg });
</script>

<template>
  <aside class="workspace-left" aria-label="投屏设置">
    <div class="workspace-left__section workspace-left__top">
      <div class="workspace-left__top-row">
        <NForm v-if="!isJpegCastDevice" size="small" :show-feedback="false" style="flex: 1">
          <NFormItem label="投屏模式" label-placement="top">
            <MirrorSearchableSelect
              v-model:value="castMode"
              :options="modeOptions"
              :disabled="casting || castBusy"
            />
          </NFormItem>
        </NForm>
        <NText v-else depth="2" style="font-weight: 600">
          {{ isIosDevice ? "iOS MJPEG 投屏" : "鸿蒙 JPEG 投屏" }}
        </NText>
        <HelpHint :content="castHelpText" title="投屏说明" size="sm" />
      </div>
    </div>

    <div class="workspace-left__section workspace-left__middle">
      <HarmonyCastSettings
        v-if="isHarmonyDevice"
        ref="harmonySettingsRef"
        :device="device"
        :casting="casting"
        @settings-change="handleSettingsChange"
      />
      <div v-else-if="isIosDevice" class="workspace-left__placeholder">
        iOS 设备通过 WDA 推送 MJPEG 画面。
      </div>
      <MirrorCastSettings
        v-else-if="castMode === 'mirror'"
        ref="mirrorSettingsRef"
        :serial="device.serial"
        :device-sdk="device.sdkVersion"
        :casting="casting"
        @settings-change="handleSettingsChange"
      />
      <CameraCastSettings
        v-else-if="castMode === 'camera'"
        ref="cameraSettingsRef"
        :serial="device.serial"
        :device-sdk="device.sdkVersion"
        :casting="casting"
        @settings-change="handleSettingsChange"
        @camera-control="(payload) => emit('camera-control', payload)"
      />
      <div v-else-if="castMode === 'multiApp'" class="workspace-left__placeholder">
        多应用投屏将在右侧全屏桌面中打开，左侧设置栏会自动隐藏。
      </div>
      <p v-else class="workspace-left__placeholder">该模式的详细设置即将推出。</p>
    </div>

    <div class="workspace-left__section workspace-left__bottom">
      <NSpace vertical :size="10">
        <PanelAlert
          v-if="!device.connected"
          type="warning"
          :message="'设备未在线，无法投屏。'"
        />

        <NButton v-if="casting" block type="error" ghost :disabled="castBusy" @click="handleStopClick">
          取消投屏
        </NButton>
        <NButton
          v-else
          block
          type="primary"
          :disabled="!canStartCast || castBusy"
          :loading="castBusy"
          @click="handleStartClick"
        >
          {{ startButtonLabel }}
        </NButton>
      </NSpace>
    </div>
  </aside>
</template>
