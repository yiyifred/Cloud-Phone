/**
 * 设备投屏（scrcpy over WebSocket）的前端编排入口。
 *
 * T-433 从这里拆出了 6 个模块（composables/scrcpy-cast/）：
 *   cast-context.js           共享状态容器（一次会话只有一份）
 *   cast-startup-log.js       启动日志 + 后端日志轮询
 *   cast-socket.js            socket 句柄 / sendControl / START_APP / 收尾
 *   cast-frame-state.js       首帧就绪与画面尺寸
 *   cast-stream-connection.js WebSocket 连接与「谁先到就软就绪」的仲裁
 *   cast-control-channel.js   各种控制帧封装
 *   cast-session.js           beginCast / stopCast / 旋转 / 录音联动
 *
 * 为什么保留这一层而不是让调用方直接拼装：对外返回值（33 个字段）是
 * DeviceCastViewport / DeviceWorkspace 依赖的稳定契约，组装顺序也决定了
 * 依赖方向（socket → frameState → control → transport → session），改动集中在这里。
 */
import { createCastContext } from "./scrcpy-cast/cast-context.js";
import { createCastControlChannel } from "./scrcpy-cast/cast-control-channel.js";
import { createCastFrameState } from "./scrcpy-cast/cast-frame-state.js";
import { createCastSession } from "./scrcpy-cast/cast-session.js";
import { createCastSocket } from "./scrcpy-cast/cast-socket.js";
import { createCastStartupLogChannel } from "./scrcpy-cast/cast-startup-log.js";
import { createCastStreamConnection } from "./scrcpy-cast/cast-stream-connection.js";

export function useDeviceScrcpyCast(
  serialRef,
  canvasRef,
  castOptionsRef,
  rotatorRef,
  viewportRef,
  castHooks = {},
) {
  const ctx = createCastContext();
  const startup = createCastStartupLogChannel({ ctx, serialRef });
  const socketApi = createCastSocket({
    ctx,
    castOptionsRef,
    onControlSent: castHooks.onControlSent,
  });
  const frameState = createCastFrameState({ ctx, startup });
  const control = createCastControlChannel({ ctx, castOptionsRef, socketApi, startup });
  const transport = createCastStreamConnection({
    ctx,
    canvasRef,
    castOptionsRef,
    socketApi,
    startup,
    frameState,
    control,
  });
  const session = createCastSession({
    ctx,
    serialRef,
    canvasRef,
    castOptionsRef,
    rotatorRef,
    viewportRef,
    castHooks,
    socketApi,
    startup,
    transport,
    frameState,
  });

  return {
    status: ctx.status,
    errorMessage: ctx.errorMessage,
    startupLogText: ctx.startupLogText,
    showStartupLogs: ctx.showStartupLogs,
    screenSize: ctx.screenSize,
    sessionMeta: ctx.sessionMeta,
    beginCast: session.beginCast,
    startCast: session.startCast,
    stopCast: session.stopCast,
    sendNavigationPress: control.sendNavigationPress,
    sendNavigation: control.sendNavigation,
    displayScreenOn: ctx.displayScreenOn,
    applyPreviewRotation: session.applyPreviewRotation,
    isRecording: session.recording.isRecording,
    recordingElapsedMs: session.recording.recordingElapsedMs,
    castVideoRecordingSupported: session.recording.castVideoRecordingSupported,
    castAudioRecordingSupported: session.recording.castAudioRecordingSupported,
    isCastRecordingSupported: session.recording.isCastRecordingSupported,
    startCastRecording: session.recording.startCastRecording,
    stopCastRecording: session.recording.stopCastRecording,
    toggleCastRecording: session.recording.toggleCastRecording,
    resumeCastAudio: session.resumeCastAudio,
    sendCameraControl: control.sendCameraControl,
    sendControl: socketApi.sendControl,
    resendStreamParameters: control.resendStreamParameters,
    sendInjectText: control.sendInjectText,
    pasteClipboardToDevice: control.pasteClipboardToDevice,
    copyClipboardFromDevice: control.copyClipboardFromDevice,
    getEffectiveScreenSize: frameState.getEffectiveScreenSize,
    sendStartApp: control.sendStartApp,
    sendResizeDisplay: control.sendResizeDisplay,
  };
}
