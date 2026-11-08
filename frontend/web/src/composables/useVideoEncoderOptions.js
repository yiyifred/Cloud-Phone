import { computed, onMounted, ref, watch } from "vue";

import {
  applyVideoEncoderSelection,
  buildEncoderSelectOptions,
  ensureDefaultVideoEncoder,
  markUnsupportedEncoderOptions,
} from "../utils/mirror-encoder-utils.js";
import { getVideoCodecSupport, probeVideoCodecSupport } from "../utils/webcodecs-support.js";

/**
 * 编码器下拉的"浏览器能不能解"闸门。
 *
 * 后端/设备可以把 video_codec 设成 h265/av1，但网页端只用 avc1.* 配置解码，
 * 选中后画面直接黑掉。这里把不支持的条目置灰，已选中的自动回退到 H.264。
 *
 * @param {import("vue").Ref<Array<{ codec?: string, value: string, label?: string }>>} encodersRef
 * @param {(() => { video: { encoder?: string, codec?: string } }) | null} getHolder 取编码器写回目标（settings / { video: settings.camera }）
 * @param {((result: { from: object, to: object }) => void) | null} onFallback 回退时的提示回调
 */
export function useVideoEncoderOptions(encodersRef, getHolder = null, onFallback = null) {
  const support = ref(getVideoCodecSupport());

  const options = computed(() =>
    markUnsupportedEncoderOptions(buildEncoderSelectOptions(encodersRef.value), support.value),
  );

  async function refreshSupport() {
    support.value = await probeVideoCodecSupport();
  }

  function reconcile() {
    const holder = getHolder?.();

    if (!holder?.video) {
      return null;
    }

    ensureDefaultVideoEncoder(holder, encodersRef.value);

    const current = options.value.find((item) => item.value === holder.video.encoder);

    if (!current?.unsupported) {
      return null;
    }

    const fallback = options.value.find((item) => !item.disabled);

    if (!fallback) {
      // 设备只提供浏览器解不了的编码器：没有可回退项，提示用户换设备/换浏览器。
      onFallback?.({ from: current, to: null });
      return null;
    }

    applyVideoEncoderSelection(holder, fallback);
    const result = { from: current, to: fallback };
    onFallback?.(result);
    return result;
  }

  watch([encodersRef, support], reconcile, { immediate: true });

  onMounted(refreshSupport);

  if (!support.value.checked) {
    // onMounted 之前的首屏也要尽快拿到结果（组件可能被缓存/延迟挂载）。
    refreshSupport();
  }

  return { support, options, reconcile, refreshSupport };
}
