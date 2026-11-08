<script setup>
import { computed } from "vue";
import { NCollapseItem, NForm, NInput, NInputNumber, NSwitch } from "naive-ui";

import { MIRROR_CAPTURE_ORIENTATIONS, MIRROR_RESOLUTIONS } from "../../utils/mirror-cast-constants.js";
import { useVideoEncoderOptions } from "../../composables/useVideoEncoderOptions.js";
import MirrorSearchableSelect from "./MirrorSearchableSelect.vue";
import MirrorSettingRow from "./MirrorSettingRow.vue";

const props = defineProps({
  video: {
    type: Object,
    required: true,
  },
  videoEncoders: {
    type: Array,
    required: true,
  },
  encodersLoading: {
    type: Boolean,
    default: false,
  },
  encodersError: {
    type: String,
    default: "",
  },
});

const { options: encoderOptions } = useVideoEncoderOptions(computed(() => props.videoEncoders));

const resolutionOptions = computed(() =>
  MIRROR_RESOLUTIONS.map((item) => ({ label: item.label, value: item.value })),
);

const orientationOptions = computed(() =>
  MIRROR_CAPTURE_ORIENTATIONS.map((item) => ({ label: item.label, value: item.value })),
);

const resolutionHint = computed(() => {
  const item = MIRROR_RESOLUTIONS.find((entry) => entry.value === props.video.resolution);
  if (!item || item.maxSize === 0) {
    return "不限制长边，由设备原生分辨率决定。";
  }
  return `编码长边不超过 ${item.maxSize}px，等比缩放。`;
});

const encoderHelp = computed(() => {
  if (props.encodersLoading) {
    return "正在从设备加载编码器列表（最多约 15 秒）…";
  }
  if (props.encodersError) {
    return props.encodersError;
  }
  if (!encoderOptions.value.length) {
    return "未获取到编码器，请确认设备已连接并刷新页面。";
  }
  if (encoderOptions.value.some((item) => item.unsupported)) {
    return "网页端目前只能解码 H.264，H.265/AV1 条目已置灰；需要这些编码请改用 scrcpy/escrcpy 桌面端。";
  }
  return "列表第一项为默认；网页投屏请优先选择 H.264 条目。";
});
</script>

<template>
  <NCollapseItem title="视频" name="video">
    <NForm size="small" :show-label="true" label-placement="left">
      <MirrorSettingRow
        label="禁用视频（仅音频）"
        help="开启后画布显示音频波纹，需 Android 11+。音频相关选项见「音频」分组。"
        variant="checkbox"
      >
        <template #control>
          <NSwitch v-model:value="video.disabled" />
        </template>
      </MirrorSettingRow>

      <MirrorSettingRow label="视频编码器" :help="encoderHelp">
        <MirrorSearchableSelect
          v-model:value="video.encoder"
          :options="encoderOptions"
          :disabled="video.disabled || !encoderOptions.length"
          placeholder="选择编码器"
        />
      </MirrorSettingRow>

      <MirrorSettingRow
        label="比特率 (Mbps)"
        help="对应 scrcpy --video-bit-rate；越高画质越好，占用带宽越大。"
      >
        <NInputNumber
          v-model:value="video.bitRateMbps"
          :min="1"
          :max="100"
          :step="0.5"
          :disabled="video.disabled"
          style="width: 100%"
        />
      </MirrorSettingRow>

      <MirrorSettingRow label="刷新率 (fps)" help="对应 --max-fps，限制编码帧率上限。">
        <NInputNumber
          v-model:value="video.maxFps"
          :min="1"
          :max="120"
          :step="1"
          :disabled="video.disabled"
          style="width: 100%"
        />
      </MirrorSettingRow>

      <MirrorSettingRow label="分辨率" :help="resolutionHint">
        <MirrorSearchableSelect
          v-model:value="video.resolution"
          :options="resolutionOptions"
          :disabled="video.disabled"
        />
      </MirrorSettingRow>

      <MirrorSettingRow
        label="裁剪区域"
        help="对应 scrcpy --crop，格式 宽:高:x:y，例如 1080:1920:0:0；经 WebSocket 下发。"
      >
        <NInput
          v-model:value="video.crop"
          placeholder="宽:高:x:y"
          :disabled="video.disabled"
          spellcheck="false"
        />
      </MirrorSettingRow>

      <MirrorSettingRow
        label="显示方向（采集）"
        help="对应 --display-orientation：旋转编码后的画面（非仅浏览器预览）。0° 跟随设备；改后约 1 秒生效。"
      >
        <MirrorSearchableSelect
          v-model:value="video.captureOrientation"
          :options="orientationOptions"
          :disabled="video.disabled"
        />
      </MirrorSettingRow>

      <MirrorSettingRow
        label="关键帧间隔 (秒)"
        help="I 帧间隔；连接后通过 WebSocket 下发，部分机型可能忽略。"
      >
        <NInputNumber
          v-model:value="video.iFrameInterval"
          :min="1"
          :max="60"
          :step="1"
          :disabled="video.disabled"
          style="width: 100%"
        />
      </MirrorSettingRow>

      <MirrorSettingRow
        label="预览旋转 (°)"
        help="仅旋转浏览器预览画布；要旋转投屏画面请改「显示方向（采集）」。"
      >
        <NInputNumber
          v-model:value="video.rotationDeg"
          :min="0"
          :max="360"
          :step="90"
          :disabled="video.disabled"
          style="width: 100%"
        />
      </MirrorSettingRow>
    </NForm>
  </NCollapseItem>
</template>
