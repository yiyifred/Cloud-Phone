/**
 * 浏览器 WebCodecs 解码能力探测。
 *
 * 为什么要探测：投屏链路用 `VideoDecoder` 解 H.264，编码器下拉却把
 * h265/hevc/av1 也列出来。这些流到前端没有对应解码配置（只构造 avc1.*），
 * 结果就是黑屏。与其让用户踩坑，不如在选之前问浏览器"你能不能解"。
 */

/** 每种编码取一个通用的 codec 字符串做能力探测，不依赖真实码流。 */
const CODEC_PROBE_CONFIGS = {
  h264: { codec: "avc1.42E01E" },
  h265: { codec: "hvc1.1.6.L93.B0" },
  hevc: { codec: "hvc1.1.6.L93.B0" },
  av1: { codec: "av01.0.05M.08" },
};

const UNCHECKED = Object.freeze({ checked: false, supported: new Set() });

/**
 * 网页播放器（ws-scrcpy-annexb-player + h264-config）目前只解析 H.264 Annex-B，
 * 并只用 avc1.* 构造 VideoDecoder 配置。即便浏览器本身能解 HEVC/AV1，这里也不能放行，
 * 否则用户选中后就是黑屏。
 */
export const PLAYER_DECODABLE_CODECS = new Set(["h264"]);

/** @type {{ checked: boolean, supported: Set<string> } | null} */
let cachedSupport = null;
/** @type {Promise<{ checked: boolean, supported: Set<string> }> | null} */
let pendingProbe = null;

function hasVideoDecoder() {
  return typeof VideoDecoder !== "undefined" && typeof VideoDecoder.isConfigSupported === "function";
}

async function probeOnce() {
  const supported = new Set();

  if (!hasVideoDecoder()) {
    return { checked: false, supported };
  }

  for (const [codec, config] of Object.entries(CODEC_PROBE_CONFIGS)) {
    try {
      const result = await VideoDecoder.isConfigSupported(config);
      if (result?.supported) {
        supported.add(codec);
      }
    } catch {
      // 浏览器拒绝该配置（含不认识的 codec 字符串）→ 视为不支持。
    }
  }

  return { checked: true, supported };
}

/** 同步读取最近一次探测结果；未探测过时返回 checked=false，调用方据此放行。 */
export function getVideoCodecSupport() {
  return cachedSupport ?? UNCHECKED;
}

/** 探测一次并缓存；并发调用复用同一个 Promise。 */
export function probeVideoCodecSupport() {
  if (cachedSupport) {
    return Promise.resolve(cachedSupport);
  }

  if (!pendingProbe) {
    pendingProbe = probeOnce().then(
      (snapshot) => {
        cachedSupport = snapshot;
        pendingProbe = null;
        return snapshot;
      },
      () => {
        const fallback = { checked: false, supported: new Set() };
        cachedSupport = fallback;
        pendingProbe = null;
        return fallback;
      },
    );
  }

  return pendingProbe;
}

/**
 * @param {string} codec
 * @param {{ checked: boolean, supported: Set<string> }} [snapshot]
 */
export function isVideoCodecSupported(codec, snapshot = getVideoCodecSupport()) {
  if (!snapshot?.checked) {
    return true;
  }

  const key = String(codec ?? "").toLowerCase();

  if (!CODEC_PROBE_CONFIGS[key]) {
    return true;
  }

  return snapshot.supported.has(key);
}

/**
 * 编码器条目为什么不能用：player=网页播放器不实现；browser=浏览器 WebCodecs 解不了。
 * @param {string} codec
 * @param {{ checked: boolean, supported: Set<string> }} [snapshot]
 * @returns {"player" | "browser" | null}
 */
export function getEncoderBlockReason(codec, snapshot = getVideoCodecSupport()) {
  const key = String(codec ?? "").toLowerCase();

  if (!PLAYER_DECODABLE_CODECS.has(key)) {
    return "player";
  }

  if (snapshot?.checked && CODEC_PROBE_CONFIGS[key] && !snapshot.supported.has(key)) {
    return "browser";
  }

  return null;
}

/** 仅供测试/重新探测使用。 */
export function resetVideoCodecSupportProbe() {
  cachedSupport = null;
  pendingProbe = null;
}
