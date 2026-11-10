/**
 * 会话编排：开始 / 停止 / 旋转 / 录音联动（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么这一层必须有：beginCast 是「顺序」本身——先写日志与状态、再建 socket、
 * 再挂交互与键盘、最后才置 streaming。任何一步调换顺序都会让 UI 出现过扫状态
 * （比如 streaming 但触摸还没绑上）。所以即使它调用了多个模块，也保持单函数顺序执行。
 *
 * 依赖方向刻意做成单向：session → socket / transport / frameState / startup / control，
 * 反向只有 transport 通过传入的 frameState 回调通知首帧，不引用 session，避免循环依赖。
 */
import { nextTick, onBeforeUnmount, unref, watch } from "vue";

import { startDeviceCast, stopDeviceCast } from "../../utils/cast-api.js";
import { applyStagePreviewRotation } from "../../utils/canvas-rotation.js";
import { attachCastInteraction } from "../../utils/scrcpy-cast-interaction.js";
import { attachCastKeyboard } from "../../utils/scrcpy-cast-keyboard.js";
import { isAudioOnlyCast } from "../../utils/scrcpy-cast-helpers.js";
import { WsScrcpyAnnexBPlayer } from "../../utils/ws-scrcpy-annexb-player.js";
import { WsScrcpyAudioCanvas } from "../../utils/ws-scrcpy-audio-canvas.js";
import { useScrcpyCastRecording } from "../useScrcpyCastRecording.js";
import { openScrcpyServerSetup } from "../../utils/scrcpy-server-setup-state.js";

export function createCastSession({
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
}) {
  const isCastActive = castHooks.isCastActive ?? (() => true);
  const getInteractionEnabled = castHooks.getInteractionEnabled ?? (() => true);
  const sendControl = socketApi.sendControl;

  const recording = useScrcpyCastRecording({
    castOptionsRef,
    canvasRef,
    player: ctx.player,
    getAudioPlayback: () => ctx.audioPlayback,
    status: ctx.status,
    serialRef,
  });

  async function beginCast(payload) {
    const serial = serialRef.value;

    if (!serial) {
      throw new Error("设备序列号无效，无法开始投屏。");
    }

    if (!payload?.success) {
      throw new Error("投屏会话无效。");
    }

    ctx.errorMessage.value = "";
    ctx.status.value = "starting";
    ctx.screenSize.value = { width: 0, height: 0 };
    ctx.showStartupLogs.value = true;
    startup.reset();
    startup.append("用户点击开始投屏");
    startup.append("正在请求后端启动投屏…");
    startup.ingest(payload?.startupLogs);
    startup.append("前端：scrcpy 启动成功");

    const audioOnly = isAudioOnlyCast(unref(castOptionsRef));

    // 先判浏览器能力再建连：否则 socket 已经打开、后端已经推流，前端却解不了码，
    // 用户只能看到一个永远不动的启动日志。
    if (audioOnly) {
      if (!WsScrcpyAudioCanvas.isSupported()) {
        ctx.status.value = "error";
        ctx.errorMessage.value = "当前浏览器不支持 Web Audio，无法使用仅音频模式。";
        throw new Error(ctx.errorMessage.value);
      }
    } else if (!WsScrcpyAnnexBPlayer.isSupported()) {
      ctx.status.value = "error";
      ctx.errorMessage.value = "当前浏览器不支持 WebCodecs H.264 解码（请使用 Chrome / Edge）。";
      throw new Error(ctx.errorMessage.value);
    }

    ctx.sessionMeta.value = payload;
    ctx.backendSessionActive = true;
    ctx.logPollConsumed = Array.isArray(payload?.startupLogs) ? payload.startupLogs.length : 0;
    startup.startPolling(serial);

    await nextTick();
    startup.append("正在连接 WebSocket 视频流…");
    await transport.openWebSocket(serial);
    const castOptions = unref(castOptionsRef) ?? {};
    ctx.unbindCanvas?.();

    const interactionEnabled = castOptions.castMode !== "camera" && getInteractionEnabled();

    ctx.unbindCanvas = attachCastInteraction({
      canvas: canvasRef.value,
      getScreenSize: frameState.getEffectiveScreenSize,
      getRotator: () => rotatorRef?.value ?? null,
      hasScreenInfo: () => frameState.getEffectiveScreenSize().width > 0,
      sendControl,
      interactionEnabled,
    });

    ctx.unbindKeyboard?.();
    const keyboardRoot = viewportRef?.value ?? canvasRef.value;
    ctx.unbindKeyboard =
      interactionEnabled && keyboardRoot
        ? attachCastKeyboard({
            root: keyboardRoot,
            sendControl,
          })
        : null;
    applyPreviewRotation(unref(castOptionsRef)?.mirror?.video?.rotationDeg ?? 0);
    ctx.status.value = "streaming";

    if (audioOnly && typeof ctx.player.value?.resumeForUserPlayback === "function") {
      void ctx.player.value.resumeForUserPlayback();
    }
  }

  /** @deprecated Prefer workspace calling cast-api then beginCast(payload). */
  async function startCast() {
    const serial = serialRef.value;

    if (!serial) {
      throw new Error("设备序列号无效，无法开始投屏。");
    }

    try {
      const options = unref(castOptionsRef) ?? { maxSize: 1024 };
      const payload = await startDeviceCast(serial, options);

      if (payload?.error === "scrcpy_server_missing") {
        ctx.status.value = "error";
        ctx.errorMessage.value = payload.message ?? "设备端 scrcpy-server 未安装";
        openScrcpyServerSetup({ reason: "投屏启动时未找到设备端 scrcpy-server", detail: payload.install ?? null });
        throw new Error(ctx.errorMessage.value);
      }

      await beginCast(payload);
    } catch (error) {
      ctx.status.value = "error";
      ctx.errorMessage.value = error instanceof Error ? error.message : "投屏启动失败";
      await stopCast({ backend: ctx.backendSessionActive });
      throw error;
    }
  }

  async function resumeCastAudio() {
    const currentPlayer = ctx.player.value;

    if (typeof currentPlayer?.resumeForUserPlayback === "function") {
      await currentPlayer.resumeForUserPlayback();
      return;
    }

    await ctx.audioPlayback?.resumeForUserPlayback?.();
  }

  function applyPreviewRotation(degrees) {
    applyStagePreviewRotation(
      rotatorRef?.value ?? null,
      degrees,
      viewportRef?.value ?? null,
    );

    // 画布尺寸变了要重算触摸映射，交互层监听 window resize；这里主动触发一次，
    // 因为它挂在 window 上而旋转并不改变窗口尺寸。
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  async function stopCast(options = {}) {
    const serial = serialRef.value;
    const shouldStopBackend = options.backend ?? ctx.backendSessionActive;
    const sessionKey = ctx.sessionMeta.value?.sessionKey;

    await recording.stopCastRecording(true);
    socketApi.close();
    startup.hide();
    startup.reset();
    ctx.screenSize.value = { width: 0, height: 0 };
    ctx.status.value = "idle";
    ctx.errorMessage.value = "";
    ctx.sessionMeta.value = null;
    ctx.backendSessionActive = false;

    // 组件已切走（例如从投屏页返回列表）时不能再发 stop：isCastActive 为假说明
    // 当前 tab 已经由别的会话接管，此时 POST 会误停别人的流。
    if (!serial || !shouldStopBackend || !isCastActive()) {
      return;
    }

    ctx.stopRequest?.abort();
    ctx.stopRequest = new AbortController();

    try {
      await stopDeviceCast(serial, {
        signal: ctx.stopRequest.signal,
        sessionKey: sessionKey || undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
    } finally {
      ctx.stopRequest = null;
    }
  }

  watch(
    () => unref(castOptionsRef)?.mirror?.video?.rotationDeg,
    (degrees) => {
      applyPreviewRotation(degrees ?? 0);
    },
  );

  watch(ctx.status, (next, prev) => {
    // 录屏依赖流已建立：一旦离开 streaming 就落盘，否则文件长度会拖到下次开始。
    if (prev === "streaming" && next !== "streaming" && recording.isRecording.value) {
      void recording.stopCastRecording(true);
    }
  });

  onBeforeUnmount(() => {
    if (isCastActive()) {
      void stopCast();
    }
  });

  return { beginCast, startCast, stopCast, resumeCastAudio, applyPreviewRotation, recording };
}
