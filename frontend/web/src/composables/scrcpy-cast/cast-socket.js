/**
 * WebSocket 连接句柄 + 控制帧发送 + START_APP 延迟发送（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么把 sendControl 放在最底层：它是所有控制通道（导航、文本注入、剪贴板、相机、
 * 流参数）唯一的出口，二进制帧必须保持「独立的一帧」，一旦被上层各自包装就会
 * 出现 ArrayBuffer/Uint8Array 视图偏移问题（见下面的 copy）。
 * close() 负责把一次会话的全部旁挂资源（player、audio、canvas/keyboard 解绑）收干净，
 * 所以它也必须留在这个持有 socket 的模块里。
 */
import { unref } from "vue";

import {
  isNewDisplayEnabled,
  resolveStartAppPackage,
} from "../../utils/mirror-screen-utils.js";
import { serializeStartApp } from "../../utils/ws-scrcpy-control.js";

export function createCastSocket({ ctx, castOptionsRef, onControlSent }) {
  function sendControl(buffer) {
    if (!ctx.socket || ctx.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // ws.send 只接受完整的一帧：TypedArray 若带 offset 必须重新拷一份，
    // 否则浏览器会把整个底层 ArrayBuffer 发出去，后端解出的指令就错位了。
    if (buffer instanceof ArrayBuffer) {
      ctx.socket.send(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      const copy = new Uint8Array(buffer.byteLength);
      copy.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
      ctx.socket.send(copy);
    } else {
      ctx.socket.send(buffer);
    }
    onControlSent?.(buffer);
  }

  function clearStartAppTimer() {
    if (ctx.startAppTimer) {
      clearTimeout(ctx.startAppTimer);
      ctx.startAppTimer = null;
    }
  }

  function queueStartAppAfterConnect(delayMs) {
    const screen = unref(castOptionsRef)?.mirror?.screen ?? {};
    const packageName = resolveStartAppPackage(screen);

    if (!packageName || ctx.startAppSent) {
      return;
    }

    // Official/web path: start_app in type-101 extras launches when the VD is ready.
    // Do not send a delayed START_APP control — it only adds 2–4s of empty wait.
    if (isNewDisplayEnabled(screen) && String(screen.newDisplayApp || "").trim()) {
      ctx.startAppSent = true;
      return;
    }

    const baseDelay = delayMs ?? 400;

    const sendOnce = () => {
      if (!ctx.socket || ctx.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const buffer = serializeStartApp(packageName);

      if (buffer) {
        sendControl(buffer);
      }
    };

    clearStartAppTimer();
    ctx.startAppTimer = setTimeout(() => {
      ctx.startAppTimer = null;
      ctx.startAppSent = true;
      sendOnce();
    }, baseDelay);
  }

  function close() {
    clearStartAppTimer();
    ctx.startAppSent = false;
    ctx.openWebSocketReady = null;
    ctx.unbindCanvas?.();
    ctx.unbindCanvas = null;
    ctx.unbindKeyboard?.();
    ctx.unbindKeyboard = null;
    ctx.lastOutboundClipboard = "";

    if (ctx.socket) {
      ctx.socket.close();
      ctx.socket = null;
    }

    ctx.player.value?.destroy();
    ctx.player.value = null;
    ctx.audioPlayback?.destroy();
    ctx.audioPlayback = null;
    ctx.sessionMeta.value = null;
    ctx.displayScreenOn.value = true;
  }

  return { sendControl, clearStartAppTimer, queueStartAppAfterConnect, close };
}
