<script setup>
import { computed, reactive, ref, watch } from "vue";
import { NCollapse, NSpin, NText } from "naive-ui";

import { useAppFeedback } from "../../composables/useAppFeedback.js";
import { useMirrorCastOptions } from "../../composables/useMirrorCastOptions.js";
import { createDefaultMirrorSettings } from "../../utils/mirror-cast-defaults.js";
import { nextPreviewRotationDeg } from "../../utils/canvas-rotation.js";
import {
  applyAudioCodeSelection,
  ensureDefaultAudioCode,
} from "../../utils/mirror-audio-utils.js";
import { isAudioDupSupported } from "../../utils/mirror-audio-platform.js";
import { applyVideoEncoderSelection, formatCodecPrefix } from "../../utils/mirror-encoder-utils.js";
import { useVideoEncoderOptions } from "../../composables/useVideoEncoderOptions.js";
import MirrorCastAudioSection from "./MirrorCastAudioSection.vue";
import MirrorCastDeviceSection from "./MirrorCastDeviceSection.vue";
import MirrorCastScreenSection from "./MirrorCastScreenSection.vue";
import MirrorCastVideoSection from "./MirrorCastVideoSection.vue";

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

const emit = defineEmits(["settings-change"]);

const settings = reactive(createDefaultMirrorSettings());
const expandedPanels = ref(["video", "audio", "device", "screen"]);

const {
  loading,
  encodersLoading,
  error,
  encodersError,
  videoEncoders,
  audioCodeOptions,
  audioSources,
  displays,
  apps,
} = useMirrorCastOptions(() => props.serial);
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

watch(
  displays,
  (items) => {
    if (!settings.screen.displayId && items.length) {
      settings.screen.displayId = items[0].value;
    }
  },
  { immediate: true },
);

const { options: encoderOptions } = useVideoEncoderOptions(
  computed(() => videoEncoders.value),
  () => settings,
  ({ from, to }) => {
    feedback.warning(
      to
        ? `当前浏览器无法解码 ${formatCodecPrefix(from.codec)}，已自动回退 ${formatCodecPrefix(to.codec)}（${to.value}）。`
        : `当前浏览器无法解码 ${formatCodecPrefix(from.codec)}，且设备未提供其它编码器，投屏会黑屏。`,
    );
  },
);

watch(
  () => settings.video.encoder,
  (encoder) => {
    const option = encoderOptions.value.find((item) => item.value === encoder);

    if (option) {
      applyVideoEncoderSelection(settings, option);
    }
  },
);

watch(
  () => settings.video.disabled,
  (disabled) => {
    if (disabled) {
      settings.audio.disabled = false;
    }
  },
);

watch(
  () => props.deviceSdk,
  () => {
    if (!isAudioDupSupported(props.deviceSdk)) {
      settings.audio.audioDup = false;
    }
  },
  { immediate: true },
);

watch(
  audioCodeOptions,
  (options) => {
    ensureDefaultAudioCode(settings, options);
  },
  { immediate: true },
);

watch(
  () => settings.audio.audioCode,
  (audioCode) => {
    const option = audioCodeOptions.value.find((item) => item.value === audioCode);

    if (option) {
      applyAudioCodeSelection(settings, option);
    }
  },
);

watch(
  settings,
  () => {
    if (!props.casting) {
      emit("settings-change", settings);
    }
  },
  { deep: true },
);

function getSettings() {
  return settings;
}

/** Toolbar「旋转」: same field as「预览旋转 (°)」. */
function stepPreviewRotationDeg() {
  settings.video.rotationDeg = nextPreviewRotationDeg(settings.video.rotationDeg);
  return settings.video.rotationDeg;
}

defineExpose({ getSettings, stepPreviewRotationDeg });
</script>

<template>
  <div class="mirror-settings">
    <NSpin :show="loading">
      <template v-if="!error">
        <div class="mirror-settings__body">
          <NCollapse v-model:expanded-names="expandedPanels">
            <MirrorCastVideoSection
              :video="settings.video"
              :video-encoders="videoEncoders"
              :encoders-loading="encodersLoading"
              :encoders-error="encodersError"
            />
            <MirrorCastAudioSection
              :audio="settings.audio"
              :audio-code-options="audioCodeOptions"
              :audio-sources="audioSources"
              :device-sdk="deviceSdk"
              :video-disabled="settings.video.disabled"
              :encoders-loading="encodersLoading"
            />
            <MirrorCastDeviceSection :device-options="settings.device" />
            <MirrorCastScreenSection
              :screen="settings.screen"
              :displays="displays"
              :apps="apps"
            />
          </NCollapse>

          <div v-if="casting" class="mirror-settings__lock">
            <NText strong>投屏进行中，参数已锁定</NText>
            <NText depth="3">停止投屏后可修改</NText>
          </div>
        </div>
      </template>
    </NSpin>
  </div>
</template>
