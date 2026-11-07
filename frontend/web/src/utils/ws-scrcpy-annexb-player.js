/**
 * ws-scrcpy / WebCodecs Annex-B player: one MediaCodec buffer → one EncodedVideoChunk.
 */

import {
  annexBHasNalType,
  annexBNalTypeAt,
  codecFromSps,
  ensureAnnexBKeyWithParams,
  forEachAnnexBNal,
  startCodeLenAt,
} from "./h264-nal-utils.js";
import { CanvasFitLayout } from "./canvas-fit.js";

export class WsScrcpyAnnexBPlayer {
  static isSupported() {
    return typeof VideoDecoder === "function";
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
      canvas.getContext("2d");
    this.decoder = null;
    this.hadIdr = false;
    this.needIdr = false;
    this.frameIndex = 0;
    this.lastError = "";
    this.videoFrameSize = { width: 0, height: 0 };
    this.onVideoFrameSize = null;
    this.onFirstFrameRendered = null;
    this.onNeedKeyframe = null;
    this.hasRenderedFrame = false;
    this.pendingFrame = null;
    this.rafId = 0;
    this._lastKeyframeRequestAt = 0;
    this._keyframeWaitTimer = 0;
    this._spsUnit = null;
    this._ppsUnit = null;
    // 尺寸交给 CanvasFitLayout：canvas 是替换元素，object-fit 无效；width/height:100%
    // 会非等比拉伸位图（画面变形、触摸点偏移）。详见 utils/canvas-fit.js。
    this.fitLayout = this.canvas ? new CanvasFitLayout(this.canvas) : null;

    this.#createDecoder();
  }

  #createDecoder() {
    this.decoder = new VideoDecoder({
      output: (frame) => this.#queueFrame(frame),
      error: (error) => {
        this.lastError = error?.message ?? String(error);
        this.#markNeedKeyframe(true);
      },
    });
  }

  #ensureDecoder() {
    if (this.decoder && this.decoder.state !== "closed") {
      return;
    }
    this.#createDecoder();
    this.hadIdr = false;
    this.#markNeedKeyframe(true);
  }

  #clearKeyframeWait() {
    if (this._keyframeWaitTimer) {
      clearTimeout(this._keyframeWaitTimer);
      this._keyframeWaitTimer = 0;
    }
  }

  #markNeedKeyframe(requestImmediate = false) {
    this.needIdr = true;
    if (!requestImmediate) {
      return;
    }
    const now = performance.now();
    if (now - this._lastKeyframeRequestAt < 2000) {
      return;
    }
    this._lastKeyframeRequestAt = now;
    this.#clearKeyframeWait();
    try {
      this.onNeedKeyframe?.();
    } catch {
      // ignore
    }
  }

  #scheduleKeyframeWait(delayMs = 1500) {
    this.needIdr = true;
    if (this._keyframeWaitTimer || this.hadIdr) {
      return;
    }
    this._keyframeWaitTimer = setTimeout(() => {
      this._keyframeWaitTimer = 0;
      if (!this.hadIdr) {
        this.#markNeedKeyframe(true);
      }
    }, delayMs);
  }

  #cacheParameterSets(bytes) {
    forEachAnnexBNal(bytes, (nal, type) => {
      if (type === 7) {
        this._spsUnit = nal.slice();
      } else if (type === 8) {
        this._ppsUnit = nal.slice();
      }
    });
  }

  #queueFrame(frame) {
    if (this.pendingFrame) {
      this.pendingFrame.close();
    }
    this.pendingFrame = frame;
    if (this.rafId) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const next = this.pendingFrame;
      this.pendingFrame = null;
      if (next) {
        this.#drawFrame(next);
      }
    });
  }

  #drawFrame(frame) {
    if (!this.ctx) {
      frame.close();
      return;
    }
    const frameWidth = frame.displayWidth;
    const frameHeight = frame.displayHeight;
    if (frameWidth > 0 && frameHeight > 0) {
      if (this.canvas.width !== frameWidth || this.canvas.height !== frameHeight) {
        this.canvas.width = frameWidth;
        this.canvas.height = frameHeight;
      }
      // 位图尺寸确定后按视频宽高比重排，保证不变形、触摸坐标可换算
      this.fitLayout?.setVideoSize(frameWidth, frameHeight);
      if (
        this.videoFrameSize.width !== frameWidth ||
        this.videoFrameSize.height !== frameHeight
      ) {
        this.videoFrameSize = { width: frameWidth, height: frameHeight };
        this.onVideoFrameSize?.(this.videoFrameSize);
      }
    }
    this.ctx.drawImage(frame, 0, 0);
    frame.close();
    if (!this.hasRenderedFrame) {
      this.hasRenderedFrame = true;
      this.onFirstFrameRendered?.();
    }
    this.lastError = "";
  }

  #configureFromSps(spsNal) {
    this.#ensureDecoder();
    if (!this.decoder || this.decoder.state === "closed") {
      return;
    }
    if (this.decoder.state === "configured") {
      try {
        this.decoder.reset();
      } catch {
        this.#createDecoder();
      }
    }
    const sc = startCodeLenAt(spsNal, 0);
    if (!sc || spsNal.length < sc + 4) {
      return;
    }
    const config = {
      codec: codecFromSps(spsNal.subarray(sc)),
      optimizeForLatency: true,
      hardwareAcceleration: "prefer-hardware",
    };
    try {
      this.decoder.configure(config);
    } catch {
      try {
        this.decoder.configure({ ...config, hardwareAcceleration: "prefer-software" });
      } catch (error2) {
        this.lastError = error2?.message ?? String(error2);
      }
    }
  }

  #decodePacket(bytes, isKey) {
    this.#ensureDecoder();
    if (!this.decoder || this.decoder.state !== "configured") {
      return;
    }
    if ((this.needIdr || !this.hadIdr) && !isKey) {
      return;
    }
    const payload = isKey
      ? ensureAnnexBKeyWithParams(bytes, this._spsUnit, this._ppsUnit)
      : bytes;
    if (isKey && !annexBHasNalType(payload, 8)) {
      this.#scheduleKeyframeWait(800);
      return;
    }
    try {
      this.decoder.decode(
        new EncodedVideoChunk({
          type: isKey ? "key" : "delta",
          timestamp: this.frameIndex * 16_666,
          data: payload,
        }),
      );
      this.frameIndex += 1;
      if (isKey) {
        this.needIdr = false;
        this.hadIdr = true;
        this.#clearKeyframeWait();
      }
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      this.#markNeedKeyframe(true);
    }
  }

  pushFrame(arrayBuffer) {
    if (!arrayBuffer) {
      return;
    }
    const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
    if (bytes.length < 4 || !startCodeLenAt(bytes, 0)) {
      return;
    }

    this.#cacheParameterSets(bytes);
    const firstType = annexBNalTypeAt(bytes, 0);

    if (firstType === 7) {
      let next = bytes.length;
      const sc = startCodeLenAt(bytes, 0) || 4;
      for (let j = sc + 1; j + 3 < bytes.length; j += 1) {
        if (startCodeLenAt(bytes, j)) {
          next = j;
          break;
        }
      }
      this.#configureFromSps(bytes.subarray(0, next));
      if (!annexBHasNalType(bytes, 5)) {
        this.#scheduleKeyframeWait(1500);
        return;
      }
    }

    if (firstType === 8) {
      return;
    }

    const isKey =
      firstType === 5 ||
      (firstType !== 1 && firstType !== 9 && annexBHasNalType(bytes, 5));
    this.#decodePacket(bytes, isKey);
  }

  destroy() {
    this.#clearKeyframeWait();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.pendingFrame) {
      this.pendingFrame.close();
      this.pendingFrame = null;
    }
    try {
      if (this.decoder && this.decoder.state !== "closed") {
        this.decoder.close();
      }
    } catch {
      // ignore
    }
    this.decoder = null;
    this.onNeedKeyframe = null;
    this._spsUnit = null;
    this._ppsUnit = null;
    this.fitLayout?.destroy();
    this.fitLayout = null;
  }

  /** 画面实际矩形（CSS px，容器坐标系）：触摸/旋转换算应以此为准。 */
  get contentRect() {
    return this.fitLayout?.contentRect ?? null;
  }
}
