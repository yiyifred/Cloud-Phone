/**
 * 控制通道（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么这些放一起：它们都是「一条控制帧 → 一种设备动作」的薄封装
 * （导航键、文本注入、剪贴板双向、相机控制、启动应用、改分辨率、流参数重发），
 * 共同依赖只有 sendControl 与 castOptions。集中后上层不用再关心每种帧怎么序列化。
 *
 * 剪贴板要特别注意：lastOutboundClipboard / clipboardSequence 存在 ctx 里，
 * 因为「设备把自己刚被写入的文本又同步回来」时靠它去重，否则会来回回环。
 */
import { unref } from "vue";

import {
  COPY_KEY,
  KEY_ACTION,
  serializeCameraControl,
  serializeDisplayWakeActions,
  serializeGetClipboard,
  serializeInjectText,
  serializeNavigationActions,
  serializeNavigationPress,
  serializeResetVideo,
  serializeResizeDisplay,
  serializeSetClipboard,
  serializeStartApp,
} from "../../utils/ws-scrcpy-control.js";
import { readSystemClipboard, writeSystemClipboard } from "../../utils/cast-clipboard.js";
import {
  serializeChangeStreamParameters,
  videoSettingsFromCastOptions,
} from "../../utils/ws-scrcpy-video-settings.js";

export function createCastControlChannel({ ctx, castOptionsRef, socketApi, startup }) {
  const sendControl = socketApi.sendControl;

  /** Re-send type-101 from current castOptions (e.g. maxFps change). */
  function resendStreamParameters(reason = "options-update") {
    if (!ctx.socket || ctx.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      const body = serializeChangeStreamParameters(
        videoSettingsFromCastOptions(unref(castOptionsRef) ?? {}, ctx.sessionMeta.value),
      );
      const copy = new Uint8Array(body.byteLength);
      copy.set(body);
      sendControl(copy);
      return true;
    } catch (error) {
      startup.append(
        `流参数重发失败 (${reason}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  function sendInjectText(text) {
    const value = String(text ?? "");

    if (!value) {
      return;
    }

    // 单条 INJECT_TEXT 超过 300 字符会被后端的输入法通道截断，所以按 300 切片。
    for (let offset = 0; offset < value.length; offset += 300) {
      const chunk = value.slice(offset, offset + 300);
      const buffer = serializeInjectText(chunk);

      if (buffer) {
        sendControl(buffer);
      }
    }
  }

  function sendSetClipboardToDevice(text, paste = true) {
    const value = String(text ?? "");
    ctx.lastOutboundClipboard = value;
    ctx.clipboardSequence += 1n;
    const buffer = serializeSetClipboard(value, paste, ctx.clipboardSequence);

    if (buffer) {
      sendControl(buffer);
    }
  }

  async function handleDeviceClipboard(text) {
    const value = String(text ?? "");

    // 与刚写下去的内容相同说明是回环同步，直接丢弃。
    if (!value || value === ctx.lastOutboundClipboard) {
      return;
    }

    await writeSystemClipboard(value);
  }

  async function pasteClipboardToDevice() {
    const text = await readSystemClipboard();

    if (text == null) {
      throw new Error("无法读取系统剪贴板，请允许浏览器剪贴板权限。");
    }

    sendSetClipboardToDevice(text, true);
  }

  function copyClipboardFromDevice(copyKey = COPY_KEY.COPY) {
    sendControl(serializeGetClipboard(copyKey));
  }

  function sendCameraControl(payload) {
    const buffer = serializeCameraControl(payload);

    if (buffer) {
      sendControl(buffer);
    }
  }

  function sendStartApp(packageName) {
    const buffer = serializeStartApp(packageName);

    if (buffer) {
      sendControl(buffer);
    }
  }

  function sendResizeDisplay(width, height) {
    sendControl(serializeResizeDisplay(width, height));
  }

  function sendNavigationPress(actionId, phase) {
    const keyAction = phase === "down" ? KEY_ACTION.DOWN : KEY_ACTION.UP;
    const buffer = serializeNavigationPress(actionId, keyAction);

    if (buffer) {
      sendControl(buffer);
    }
  }

  function sendNavigation(actionId) {
    if (actionId === "screen-off" || actionId === "screen-on") {
      const turnOn = actionId === "screen-on";
      ctx.displayScreenOn.value = turnOn;

      if (turnOn) {
        for (const buffer of serializeDisplayWakeActions()) {
          sendControl(buffer);
        }
        // 亮屏后解码器需要一个关键帧，否则画面停在熄屏前的最后一帧。
        window.setTimeout(() => {
          sendControl(serializeResetVideo());
        }, 450);
      } else {
        for (const buffer of serializeNavigationActions("screen-off")) {
          sendControl(buffer);
        }
      }

      return;
    }

    for (const buffer of serializeNavigationActions(actionId)) {
      sendControl(buffer);
    }
  }

  return {
    resendStreamParameters,
    sendInjectText,
    handleDeviceClipboard,
    pasteClipboardToDevice,
    copyClipboardFromDevice,
    sendCameraControl,
    sendStartApp,
    sendResizeDisplay,
    sendNavigationPress,
    sendNavigation,
  };
}
