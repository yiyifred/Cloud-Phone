import { getEncoderBlockReason } from "./webcodecs-support.js";

/** Values that are codec ids, not MediaCodec encoder names. */
const CODEC_LIKE_NAMES = new Set(["h264", "h265", "hevc", "av1", "opus", "aac", "flac"]);

const CODEC_SORT_ORDER = { h264: 0, h265: 1, hevc: 1, av1: 2 };

export const DEFAULT_VIDEO_CODEC = "h264";

/**
 * @param {string} codec
 */
export function formatCodecPrefix(codec) {
  const key = String(codec ?? DEFAULT_VIDEO_CODEC).toLowerCase();

  if (key === "h264") {
    return "H264";
  }

  if (key === "h265" || key === "hevc") {
    return "H265";
  }

  if (key === "av1") {
    return "AV1";
  }

  return key.toUpperCase();
}

/**
 * @param {{ codec?: string, value: string, label?: string }} item
 */
export function formatEncoderOptionLabel(item) {
  const prefix = formatCodecPrefix(item.codec);
  const name = item.label || item.value;
  return `${prefix} - ${name}`;
}

/**
 * @param {{ codec?: string, value: string }[]} encoders
 */
export function sortVideoEncoders(encoders) {
  return [...encoders]
    .filter((item) => item.value)
    .sort((left, right) => {
      const leftOrder = CODEC_SORT_ORDER[String(left.codec ?? "").toLowerCase()] ?? 9;
      const rightOrder = CODEC_SORT_ORDER[String(right.codec ?? "").toLowerCase()] ?? 9;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.value.localeCompare(right.value);
    });
}

/**
 * @param {{ codec?: string, value: string, label?: string }[]} encoders
 */
export function buildEncoderSelectOptions(encoders) {
  return sortVideoEncoders(encoders).map((item) => ({
    value: item.value,
    codec: String(item.codec ?? DEFAULT_VIDEO_CODEC).toLowerCase(),
    label: formatEncoderOptionLabel(item),
  }));
}

/**
 * @param {string} encoder
 */
export function normalizeVideoEncoderName(encoder) {
  const name = String(encoder ?? "").trim();

  if (!name || CODEC_LIKE_NAMES.has(name.toLowerCase())) {
    return "";
  }

  return name;
}

/**
 * @param {string} encoder
 * @param {{ codec?: string, value: string }[]} encoders
 */
export function resolveVideoEncoderName(encoder, encoders = []) {
  const normalized = normalizeVideoEncoderName(encoder);
  const options = buildEncoderSelectOptions(encoders);

  if (normalized && options.some((item) => item.value === normalized)) {
    return normalized;
  }

  return options[0]?.value ?? "";
}

/**
 * @param {{ video: { encoder?: string, codec?: string } }} settings
 * @param {{ value: string, codec: string }} option
 */
export function applyVideoEncoderSelection(settings, option) {
  if (!option?.value) {
    return;
  }

  settings.video.encoder = option.value;
  settings.video.codec = option.codec || DEFAULT_VIDEO_CODEC;
}

/**
 * @param {{ video: { encoder?: string, codec?: string } }} settings
 * @param {{ codec?: string, value: string }[]} encoders
 */
export function ensureDefaultVideoEncoder(settings, encoders) {
  const options = buildEncoderSelectOptions(encoders);

  if (!options.length) {
    return;
  }

  const current = normalizeVideoEncoderName(settings.video.encoder);

  if (current && options.some((item) => item.value === current)) {
    const match = options.find((item) => item.value === current);
    settings.video.codec = match?.codec ?? settings.video.codec ?? DEFAULT_VIDEO_CODEC;
    return;
  }

  applyVideoEncoderSelection(settings, options[0]);
}

/** 不可用编码器在下拉里的说明后缀。 */
const UNSUPPORTED_ENCODER_SUFFIXES = {
  player: "（网页端仅支持 H.264）",
  browser: "（浏览器无法解码）",
};

/**
 * 标记网页端解不了的编码器条目：播放器不实现（player）或浏览器 WebCodecs 不支持（browser）。
 *
 * @param {{ codec: string, value: string, label: string }[]} options
 * @param {{ checked: boolean, supported: Set<string> } | null | undefined} support
 */
export function markUnsupportedEncoderOptions(options, support) {
  return options.map((option) => {
    const reason = getEncoderBlockReason(option.codec, support);

    if (!reason) {
      return option;
    }

    return {
      ...option,
      disabled: true,
      unsupported: true,
      unsupportedReason: reason,
      label: `${option.label} ${UNSUPPORTED_ENCODER_SUFFIXES[reason]}`,
    };
  });
}

/**
 * @param {{ disabled?: boolean }[]} options
 */
export function firstSelectableEncoderOption(options) {
  return options.find((option) => !option.disabled) ?? null;
}
