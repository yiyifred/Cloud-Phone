/**
 * 关键帧等待守卫：记录「当前必须等 IDR」的状态，并在迟迟拿不到 IDR 时
 * 节流地向宿主要一次关键帧（避免每次丢帧都打断编码器）。
 *
 * 从 ws-scrcpy-annexb-player.js 抽出（T-438），保持原有 2s 节流与定时器语义。
 */
export function createKeyframeGuard({ requestKeyframe, now = () => performance.now() }) {
  let waitTimer = 0;
  let lastRequestAt = 0;
  let needIdr = true;
  let hadIdr = false;

  const clear = () => {
    if (waitTimer) {
      clearTimeout(waitTimer);
      waitTimer = 0;
    }
  };

  const request = (immediate) => {
    needIdr = true;
    if (!immediate) {
      return;
    }
    const at = now();
    if (at - lastRequestAt < 2000) {
      return;
    }
    lastRequestAt = at;
    clear();
    try {
      requestKeyframe?.();
    } catch {
      // ignore
    }
  };

  const schedule = (delayMs = 1500) => {
    needIdr = true;
    if (waitTimer || hadIdr) {
      return;
    }
    waitTimer = setTimeout(() => {
      waitTimer = 0;
      if (!hadIdr) {
        request(true);
      }
    }, delayMs);
  };

  return {
    clear,
    request,
    schedule,
    resetOnReconfigure() {
      hadIdr = false;
      request(true);
    },
    get needIdr() {
      return needIdr;
    },
    set needIdr(value) {
      needIdr = value;
    },
    get hadIdr() {
      return hadIdr;
    },
    set hadIdr(value) {
      hadIdr = value;
    },
    onKeyframeDecoded() {
      needIdr = false;
      hadIdr = true;
      clear();
    },
  };
}
