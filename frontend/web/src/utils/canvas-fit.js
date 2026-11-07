/**
 * canvas 等比自适应布局（视频画面 == canvas 的 CSS 盒子）。
 *
 * 为什么需要独立模块：canvas 是替换元素，`object-fit` 对它**无效**。此前用
 * width/height:100% 把 canvas 撑满容器，等于把位图非等比拉伸——画面变形，
 * 而且触摸换算（utils/canvas-rotation.js 的 mapClientToVideoLocal）是按 canvas
 * 盒子的宽高比去推算黑边的，拉伸后推算出的黑边与实际画面完全不符，点击必然偏移。
 *
 * 这里的做法：用「容器尺寸 + 视频宽高比」算出实际画面矩形，把 canvas 的 CSS
 * 盒子精确设成这个矩形并居中。于是
 *   1. 盒子宽高比 == 视频宽高比 ⇒ 位图等比缩放，任意容器比例下都不变形；
 *   2. canvas.getBoundingClientRect() 就是画面矩形 ⇒ 触摸坐标与画面像素 1:1 对齐，
 *      canvas-rotation.js 里的 letterbox 修正自然退化为 0（无需改动那个文件）；
 *   3. 画面四周的空白由父容器背景承担，即黑边。
 */

/** 需要快照/还原的内联样式属性：destroy 时还原，避免影响复用同一个 canvas 的其它播放器。 */
const MANAGED_STYLE_PROPS = ["position", "left", "top", "width", "height"];

export class CanvasFitLayout {
  /**
   * @param {HTMLCanvasElement | null} canvas
   */
  constructor(canvas) {
    this.canvas = canvas ?? null;
    this.host = canvas?.parentElement ?? null;
    /** 视频（位图）尺寸，0 表示尚未收到首帧 */
    this.videoSize = { width: 0, height: 0 };
    /** 画面在宿主容器内的矩形（CSS px，宿主坐标系）；供触摸/旋转换算读取 */
    this.contentRect = null;
    this._prevStyle = null;
    this._hostPositionPatched = false;
    this._resizeObserver = null;

    if (this.canvas && this.host) {
      this.#attach();
    }
  }

  #attach() {
    // 只在宿主是 static 时补定位上下文；旋转包装层自身可能已由 canvas-rotation.js
    // 设置 position，不能覆盖。sync() 里会再次校验，防止被外部重置后失配。
    this.#ensureHostPositioned();

    this._prevStyle = {};
    for (const prop of MANAGED_STYLE_PROPS) {
      this._prevStyle[prop] = this.canvas.style[prop] ?? "";
    }
    this.canvas.style.position = "absolute";

    // 容器尺寸会随窗口缩放、全屏、预览旋转（canvas-rotation.js 会改写包装层宽高）变化
    if (typeof ResizeObserver === "function") {
      this._resizeObserver = new ResizeObserver(() => this.sync());
      this._resizeObserver.observe(this.host);
    }

    this.sync();
  }

  #ensureHostPositioned() {
    if (!this.host) {
      return;
    }
    // 内联已设过就不必再看 computed style，减少布局读取
    if (this.host.style.position) {
      return;
    }
    if (getComputedStyle(this.host).position === "static") {
      this.host.style.position = "relative";
      this._hostPositionPatched = true;
    }
  }

  /** 首帧解码后调用；尺寸没变则不做任何布局动作。 */
  setVideoSize(width, height) {
    const nextWidth = Math.max(0, Math.floor(Number(width) || 0));
    const nextHeight = Math.max(0, Math.floor(Number(height) || 0));
    if (nextWidth === this.videoSize.width && nextHeight === this.videoSize.height) {
      return;
    }
    this.videoSize = { width: nextWidth, height: nextHeight };
    this.sync();
  }

  /**
   * 依据容器尺寸与视频宽高比重算画面矩形并落成内联样式。
   * @returns {{ left: number, top: number, width: number, height: number } | null}
   */
  sync() {
    if (!this.canvas || !this.host) {
      return null;
    }
    this.#ensureHostPositioned();

    const hostWidth = Math.max(1, Math.floor(this.host.clientWidth || 0));
    const hostHeight = Math.max(1, Math.floor(this.host.clientHeight || 0));
    const { width: videoWidth, height: videoHeight } = this.videoSize;

    let width = hostWidth;
    let height = hostHeight;

    if (videoWidth > 0 && videoHeight > 0) {
      // 取单一缩放比的较小值 ⇒ 等比缩放且完整可见；两个方向分别 round 后的
      // 宽高比误差 < 1px，不会造成可见的变形或触摸偏差
      const scale = Math.min(hostWidth / videoWidth, hostHeight / videoHeight);
      width = Math.max(1, Math.round(videoWidth * scale));
      height = Math.max(1, Math.round(videoHeight * scale));
    }

    const left = Math.max(0, Math.floor((hostWidth - width) / 2));
    const top = Math.max(0, Math.floor((hostHeight - height) / 2));
    this.contentRect = { left, top, width, height };

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    return this.contentRect;
  }

  destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    // 还原内联样式：音频可视化等播放器会复用同一个 canvas，残留的绝对定位
    // 与 px 尺寸会让它们错位
    if (this.canvas && this._prevStyle) {
      for (const prop of MANAGED_STYLE_PROPS) {
        this.canvas.style[prop] = this._prevStyle[prop] ?? "";
      }
    }
    if (this.host && this._hostPositionPatched && this.host.style.position === "relative") {
      this.host.style.position = "";
    }
    this._prevStyle = null;
    this._hostPositionPatched = false;
    this.contentRect = null;
  }
}
