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
import { ACCEL_CANDIDATES, pickSupportedConfig } from "./h264-decoder-config.js";
import { createKeyframeGuard } from "./h264-keyframe-guard.js";

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
    this.frameIndex = 0;
    this.lastError = "";
    this.videoFrameSize = { width: 0, height: 0 };
    this.onVideoFrameSize = null;
    this.onFirstFrameRendered = null;
    this.onNeedKeyframe = null;
    this.hasRenderedFrame = false;
    this.pendingFrame = null;
    this.rafId = 0;
    this._spsUnit = null;
    this._ppsUnit = null;
    this._configAttempt = 0;
    this._configSeq = 0;
    // 尺寸交给 CanvasFitLayout：canvas 是替换元素，object-fit 无效；width/height:100%
    // 会非等比拉伸位图（画面变形、触摸点偏移）。详见 utils/canvas-fit.js。
    this.fitLayout = this.canvas ? new CanvasFitLayout(this.canvas) : null;
    this.keyframe = createKeyframeGuard({
      requestKeyframe: () => this.onNeedKeyframe?.(),
    });

    this.#createDecoder();
  }

  #createDecoder() {
    this.decoder = new VideoDecoder({
      output: (frame) => this.#queueFrame(frame),
      error: (error) => {
        this.lastError = error?.message ?? String(error);
        if (this.#retryWithNextAccel()) {
          return;
        }
        this.keyframe.request(true);
      },
    });
  }

  #ensureDecoder() {
    if (this.decoder && this.decoder.state !== "closed") {
      return;
    }
    this.#createDecoder();
    this.keyframe.resetOnReconfigure();
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

  /**
   * 上一档加速模式被拒（异步 error 回调）时降档重试一次。
   * VideoDecoder 出错后 state 会变 closed，所以必须先重建解码器。
   */
  #retryWithNextAccel() {
    if (this._configAttempt >= ACCEL_CANDIDATES.length - 1) {
      return false;
    }
    if (!this._spsUnit) {
      return false;
    }
    this._configAttempt += 1;
    if (this.decoder && this.decoder.state !== "closed") {
      try {
        this.decoder.close();
      } catch {
        // ignore
      }
    }
    this.decoder = null;
    this.#configureFromSps(this._spsUnit);
    return true;
  }

  async #configureWithFallback(codec, seq) {
    const picked = await pickSupportedConfig(
      { codec, optimizeForLatency: true },
      this._configAttempt,
    );
    if (seq !== this._configSeq || !this.decoder || this.decoder.state === "closed") {
      return;
    }
    if (!picked) {
      this.lastError = `H.264 解码配置不受支持：${codec}`;
      return;
    }
    try {
      this.decoder.configure(picked.config);
      this._configAttempt = picked.index;
    } catch (error) {
      this.lastError = error?.message ?? String(error);
    }
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
    const codec = codecFromSps(spsNal.subarray(sc));
    this._configSeq += 1;
    const seq = this._configSeq;
    void this.#configureWithFallback(codec, seq);
  }

  #decodePacket(bytes, isKey) {
    this.#ensureDecoder();
    if (!this.decoder || this.decoder.state !== "configured") {
      return;
    }
    if ((this.keyframe.needIdr || !this.keyframe.hadIdr) && !isKey) {
      return;
    }
    const payload = isKey
      ? ensureAnnexBKeyWithParams(bytes, this._spsUnit, this._ppsUnit)
      : bytes;
    if (isKey && !annexBHasNalType(payload, 8)) {
      this.keyframe.schedule(800);
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
        this.keyframe.onKeyframeDecoded();
      }
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      this.keyframe.request(true);
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
        this.keyframe.schedule(1500);
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
    this.keyframe.clear();
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
    this._configAttempt = 0;
    this._configSeq = 0;
    this.fitLayout?.destroy();
    this.fitLayout = null;
  }

  /** 画面实际矩形（CSS px，容器坐标系）：触摸/旋转换算应以此为准。 */
  get contentRect() {
    return this.fitLayout?.contentRect ?? null;
  }
}
