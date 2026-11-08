<script setup>
import { computed, reactive, ref, watch } from "vue";
import { NButton, NCollapse, NCollapseItem, NForm, NInputNumber, NSpin, NSwitch, NText } from "naive-ui";

import { useAppFeedback } from "../../composables/useAppFeedback.js";
import { useCameraCastOptions } from "../../composables/useCameraCastOptions.js";
import PanelAlert from "../ui/PanelAlert.vue";
import {
  CAMERA_AR_OPTIONS,
  CAMERA_FACING_OPTIONS,
  CAMERA_MIN_SDK,
  createDefaultCameraSettings,
} from "../../utils/camera-cast-defaults.js";
import { MIRROR_AUDIO_SOURCES } from "../../utils/mirror-audio-constants.js";
import { MIRROR_RESOLUTIONS } from "../../utils/mirror-cast-constants.js";
import { applyVideoEncoderSelection, formatCodecPrefix } from "../../utils/mirror-encoder-utils.js";
import { useVideoEncoderOptions } from "../../composables/useVideoEncoderOptions.js";
import MirrorCastAudioSection from "./MirrorCastAudioSection.vue";
import MirrorSearchableSelect from "./MirrorSearchableSelect.vue";
import MirrorSettingRow from "./MirrorSettingRow.vue";

const props = defineProps({
  serial: {
    type: String,
    required: true,
  },
  deviceSdk: {
    type: [Number, String],
    default: 0,
  },
  casting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["settings-change", "camera-control"]);

const settings = reactive(createDefaultCameraSettings());
const expandedPanels = ref(["camera", "video", "audio"]);

const {
  loading,
  encodersLoading,
  error,
  encodersError,
  cameras,
  videoEncoders,
  audioCodeOptions,
} = useCameraCastOptions(() => props.serial);
const feedback = useAppFeedback();

watch(error, (message) => {
  if (message) {
    feedback.error(message);
  }
});

watch(encodersError, (message) => {
  if (message) {
    feedback.warning(message);
  }
});

const sdkNumber = computed(() => Number(props.deviceSdk) || 0);
const sdkSupported = computed(() => sdkNumber.value >= CAMERA_MIN_SDK);
const locked = computed(() => props.casting);

const resolutionOptions = computed(() =>
  MIRROR_RESOLUTIONS.map((item) => ({ label: item.label, value: item.value })),
);

const cameraIdOptions = computed(() => {
  const items = cameras.value.map((camera) => ({
    value: camera.id,
    label: `${camera.id} (${camera.facing}, ${camera.sensorWidth}×${camera.sensorHeight})`,
  }));

  return [{ value: "", label: "按朝向自动选择" }, ...items];
});

const sizeOptions = computed(() => {
  const selectedId = settings.camera.cameraId;
  const facing = settings.camera.facing;
  const camera =
    cameras.value.find((item) => item.id === selectedId) ||
    cameras.value.find((item) => item.facing === facing) ||
    cameras.value[0];

  if (!camera?.sizes?.length) {
    return [{ value: "", label: "自动（由分辨率/宽高比决定）" }];
  }

  return [
    { value: "", label: "自动（由分辨率/宽高比决定）" },
    ...camera.sizes.map((size) => ({
      value: `${size.width}x${size.height}`,
      label: `${size.width}×${size.height}`,
    })),
  ];
});

const { options: encoderOptions } = useVideoEncoderOptions(
  computed(() => videoEncoders.value),
  () => ({ video: settings.camera }),
  ({ from, to }) => {
    feedback.warning(
      to
        ? `当前浏览器无法解码 ${formatCodecPrefix(from.codec)}，已回退 ${formatCodecPrefix(to.codec)}（${to.value}）。`
        : `当前浏览器无法解码 ${formatCodecPrefix(from.codec)}，且设备未提供其它编码器，投屏会黑屏。`,
    );
  },
);

const cameraAudioSources = computed(() =>
  MIRROR_AUDIO_SOURCES.filter((item) => ["mic", "output", "playback"].includes(item.value)),
);

watch(
  () => settings.camera.encoder,
  (encoder) => {
    const option = encoderOptions.value.find((item) => item.value === encoder);

    if (option) {
      applyVideoEncoderSelection({ video: settings.camera }, option);
    }
  },
);

watch(
  () => settings.camera.cameraId,
  () => {
    if (!sizeOptions.value.some((item) => item.value === settings.camera.size)) {
      settings.camera.size = "";
    }
  },
);

watch(settings, () => emit("settings-change"), { deep: true });

function getSettings() {
  return {
    camera: { ...settings.camera },
    audio: { ...settings.audio },
  };
}

function sendCameraControl(type, payload = {}) {
  emit("camera-control", { type, ...payload });
}

defineExpose({ getSettings });
</script>

<template>
  <div class="mirror-settings">
    <NSpin :show="loading">
      <PanelAlert
        v-if="!sdkSupported"
        type="warning"
        :message="`摄像头投屏需要 Android 12（API 31）及以上，当前设备 SDK ${sdkNumber || '未知'}。`"
      />

      <NCollapse v-else-if="!error" v-model:expanded-names="expandedPanels">
        <NCollapseItem title="摄像头" name="camera">
          <NForm size="small" :show-label="true" label-placement="left">
            <MirrorSettingRow
              label="摄像头"
              help="对应 scrcpy --camera-id；留空则按朝向选择首个匹配摄像头。"
            >
              <MirrorSearchableSelect
                v-model:value="settings.camera.cameraId"
                :options="cameraIdOptions"
                :disabled="locked"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="朝向" help="对应 --camera-facing，与摄像头 ID 互斥（指定 ID 时忽略）。">
              <MirrorSearchableSelect
                v-model:value="settings.camera.facing"
                :options="CAMERA_FACING_OPTIONS"
                :disabled="locked || Boolean(settings.camera.cameraId)"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="采集尺寸" help="对应 --camera-size；留空时由分辨率与宽高比自动选择。">
              <MirrorSearchableSelect
                v-model:value="settings.camera.size"
                :options="sizeOptions"
                :disabled="locked"
              />
            </MirrorSettingRow>

            <MirrorSettingRow
              label="宽高比"
              help="对应 --camera-ar；与显式尺寸互斥，用于在未指定尺寸时筛选分辨率。"
            >
              <MirrorSearchableSelect
                v-model:value="settings.camera.aspectRatio"
                :options="CAMERA_AR_OPTIONS"
                :disabled="locked || Boolean(settings.camera.size)"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="采集帧率" help="对应 --camera-fps，默认 30。">
              <NInputNumber
                v-model:value="settings.camera.fps"
                :min="1"
                :max="240"
                :disabled="locked"
                style="width: 100%"
              />
            </MirrorSettingRow>

            <MirrorSettingRow
              label="高速模式"
              help="对应 --camera-high-speed，需同时设置帧率且设备支持高速尺寸。"
              variant="checkbox"
            >
              <template #control>
                <NSwitch v-model:value="settings.camera.highSpeed" :disabled="locked" />
              </template>
            </MirrorSettingRow>

            <MirrorSettingRow label="启动时打开手电筒" help="对应 --camera-torch。" variant="checkbox">
              <template #control>
                <NSwitch v-model:value="settings.camera.torch" :disabled="locked" />
              </template>
            </MirrorSettingRow>

            <MirrorSettingRow label="初始变焦" help="对应 --camera-zoom，投屏中可用下方按钮调节。">
              <NInputNumber
                v-model:value="settings.camera.zoom"
                :min="1"
                :max="30"
                :step="0.1"
                :disabled="locked"
                style="width: 100%"
              />
            </MirrorSettingRow>

            <MirrorSettingRow v-if="casting" label="投屏中控制">
              <NSpace>
                <NButton size="small" @click="sendCameraControl('torch', { on: true })">手电开</NButton>
                <NButton size="small" @click="sendCameraControl('torch', { on: false })">手电关</NButton>
                <NButton size="small" @click="sendCameraControl('zoom-in')">变焦+</NButton>
                <NButton size="small" @click="sendCameraControl('zoom-out')">变焦−</NButton>
              </NSpace>
            </MirrorSettingRow>
          </NForm>
        </NCollapseItem>

        <NCollapseItem title="视频编码" name="video">
          <NForm size="small" :show-label="true" label-placement="left">
            <MirrorSettingRow label="长边上限" :help="'对应 scrcpy -m / max_size，在未指定 camera-size 时生效。'">
              <MirrorSearchableSelect
                v-model:value="settings.camera.resolution"
                :options="resolutionOptions"
                :disabled="locked || Boolean(settings.camera.size)"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="视频码率 (Mbps)" help="摄像头画面建议使用较高码率。">
              <NInputNumber
                v-model:value="settings.camera.bitRateMbps"
                :min="1"
                :max="100"
                :disabled="locked"
                style="width: 100%"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="编码帧率上限" help="对应 max_fps，与采集帧率取较小值生效。">
              <NInputNumber
                v-model:value="settings.camera.maxFps"
                :min="1"
                :max="120"
                :disabled="locked"
                style="width: 100%"
              />
            </MirrorSettingRow>

            <MirrorSettingRow label="视频编码器" :help="encodersError || '优先 H.264 硬件编码。'">
              <MirrorSearchableSelect
                v-model:value="settings.camera.encoder"
                :options="encoderOptions"
                :disabled="locked || encodersLoading || !encoderOptions.length"
                placeholder="选择编码器"
              />
            </MirrorSettingRow>
          </NForm>
        </NCollapseItem>

        <MirrorCastAudioSection
          :audio="settings.audio"
          :device-sdk="deviceSdk"
          :audio-code-options="audioCodeOptions"
          :audio-sources="cameraAudioSources"
          :encoders-loading="encodersLoading"
        />
      </NCollapse>

      <div v-if="casting" class="mirror-settings__lock">
        <NText strong>投屏进行中，参数已锁定</NText>
        <NText depth="3">停止投屏后可修改</NText>
      </div>
    </NSpin>
  </div>
</template>
