import { reactive } from "vue";

/**
 * 应用级确认框的极简 Promise 桥。
 *
 * 为什么不用 window.confirm：
 * - 浏览器原生框在只读分享/移动端上样式与语言都不可控，且会阻塞整个渲染线程；
 * - 原生框无法标红"危险操作"、无法带持有者等富文本上下文；
 * - 组件内直接调用原生框后，测试与可访问性都很难覆盖。
 */

const state = reactive({
  open: false,
  title: "",
  message: "",
  confirmText: "",
  cancelText: "",
  danger: false,
  /** @type {((value: boolean) => void) | null} */
  resolve: null,
});

export const confirmState = state;

/**
 * @param {{ title?: string, message?: string, confirmText?: string, cancelText?: string, danger?: boolean }} options
 * @returns {Promise<boolean>} true=确认，false=取消/关闭
 */
export function requestConfirm(options = {}) {
  // 同一时刻只允许一个待决确认框：旧请求按"取消"结算，避免 Promise 永久悬挂。
  if (state.resolve) {
    state.resolve(false);
    state.resolve = null;
  }

  return new Promise((resolve) => {
    state.resolve = resolve;
    state.title = options.title ?? "";
    state.message = options.message ?? "";
    state.confirmText = options.confirmText ?? "";
    state.cancelText = options.cancelText ?? "";
    state.danger = Boolean(options.danger);
    state.open = true;
  });
}

/** @param {boolean} value */
export function settleConfirm(value) {
  const resolve = state.resolve;
  state.resolve = null;
  state.open = false;
  resolve?.(Boolean(value));
}
