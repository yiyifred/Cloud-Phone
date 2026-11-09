/**
 * H.264 WebCodecs 配置档位选择。
 *
 * 为什么单独成文件：无硬件 H.264 的浏览器（headless Chromium、部分 Linux 桌面、
 * 旧版 Safari）对 `hardwareAcceleration: "prefer-hardware"` 会**异步**报
 * "Unsupported configuration. Check isConfigSupported() prior to calling configure()."。
 * 玩家侧只 catch 同步异常时，configure 失败后解码器永远停在无帧状态，
 * 画布保持默认 300x150（T-438 黑屏）。这里先探测再配置，逐档回退。
 */

export const ACCEL_CANDIDATES = ["prefer-hardware", "prefer-software", "no-preference"];

/**
 * 从 startIndex 起找第一个 isConfigSupported() 通过的配置。
 * @param {{ codec: string, optimizeForLatency?: boolean }} base
 * @param {number} startIndex
 * @returns {Promise<{ config: object, index: number } | null>}
 */
export async function pickSupportedConfig(base, startIndex = 0) {
  for (let index = startIndex; index < ACCEL_CANDIDATES.length; index += 1) {
    const config = { ...base, hardwareAcceleration: ACCEL_CANDIDATES[index] };
    let supported = true;
    if (typeof VideoDecoder !== "undefined" && typeof VideoDecoder.isConfigSupported === "function") {
      try {
        const result = await VideoDecoder.isConfigSupported(config);
        supported = result?.supported === true;
      } catch {
        supported = false;
      }
    }
    if (supported) {
      return { config, index };
    }
  }
  return null;
}
