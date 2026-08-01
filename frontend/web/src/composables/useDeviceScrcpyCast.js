import { nextTick, onBeforeUnmount, ref, shallowRef, unref, watch } from "vue";

import { WsScrcpyAnnexBPlayer } from "../utils/ws-scrcpy-annexb-player.js";
import { WsScrcpyAudioCanvas, isScrcpyAudioPacket } from "../utils/ws-scrcpy-audio-canvas.js";
import { WsScrcpyAudioPlayback } from "../utils/ws-scrcpy-audio-playback.js";
import { isNewDisplayEnabled, resolveStartAppPackage } from "../utils/mirror-screen-utils.js";
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
} from "../utils/ws-scrcpy-control.js";
import { startDeviceCast, stopDeviceCast, getDeviceCastStatus } from "../utils/cast-api.js";
import { createCastStartupLog } from "../utils/cast-startup-log.js";
import { bridgeCastStreamLog } from "../utils/cast-stream-log-bridge.js";
import { readSystemClipboard, writeSystemClipboard } from "../utils/cast-clipboard.js";
import { attachCastKeyboard } from "../utils/scrcpy-cast-keyboard.js";
import { serializeChangeStreamParameters, videoSettingsFromCastOptions } from "../utils/ws-scrcpy-video-settings.js";
import { applyStagePreviewRotation } from "../utils/canvas-rotation.js";
import { attachCastInteraction } from "../utils/scrcpy-cast-interaction.js";
import {
  buildCastWebSocketUrl,
  handleWsScrcpyBinary,
  isAudioOnlyCast,
  isCastAudioEnabled,
} from "../utils/scrcpy-cast-helpers.js";
import {
  formatVirtualDisplayUserMessage,
  isVirtualDisplayError,
  parseCastErrorMessage,
} from "../utils/cast-error-message.js";
import { useScrcpyCastRecording } from "./useScrcpyCastRecording.js";

export function useDeviceScrcpyCast(
  serialRef,
  canvasRef,
  castOptionsRef,
  rotatorRef,
  viewportRef,
  castHooks = {},
) {
  const isCastActive = castHooks.isCastActive ?? (() => true);
  const getInteractionEnabled = castHooks.getInteractionEnabled ?? (() => true);
  const onControlSent = castHooks.onControlSent;
  const status = ref("idle");
  const errorMessage = ref("");
  const startupLogText = ref("等待连接日志…");
  const showStartupLogs = ref(false);
  const player = shallowRef(null);
  const screenSize = ref({ width: 0, height: 0 });
  const sessionMeta = ref(null);
  let socket = null;
  let stopRequest = null;
  let unbindCanvas = null;
  let unbindKeyboard = null;
  let clipboardSequence = 0n;
  let lastOutboundClipboard = "";
  let audioPlayback = null;
  /** True after POST /cast/start succeeded (backend has a session). */
  let backendSessionActive = false;
  let startAppTimer = null;
  let startAppSent = false;
  let logPollTimer = null;
  let logPollConsumed = 0;
  let openWebSocketReady = null;
  const startupLog = createCastStartupLog();
  const displayScreenOn = ref(true);

  const recording = useScrcpyCastRecording({
    castOptionsRef,
    canvasRef,
    player,
    getAudioPlayback: () => audioPlayback,
    status,
    serialRef,
  });

  function syncStartupLogText() {
    startupLogText.value = startupLog.textValue();
  }

  function appendStartupLog(message) {
    startupLog.append(message);
    bridgeCastStreamLog(message, {
      castType: "scrcpy",
      deviceSerial: serialRef.value,
      source: "scrcpy-startup-log",
    });
    syncStartupLogText();
  }

  function ingestStartupLogs(entries) {
    const before = startupLog.lines.length;
    startupLog.ingest(entries);
    if (startupLog.lines.length !== before) {
      for (const line of startupLog.lines.slice(before)) {
        const message = line.replace(/^\d{1,2}:\d{2}:\d{2}\s+/, "");
        bridgeCastStreamLog(message, {
          castType: "scrcpy",
          deviceSerial: serialRef.value,
          source: "scrcpy-backend-log",
        });
      }
      syncStartupLogText();
    }
  }

  function stopLogPolling() {
    if (logPollTimer) {
      clearInterval(logPollTimer);
      logPollTimer = null;
    }
    logPollConsumed = 0;
  }

  function startLogPolling(serial) {
    stopLogPolling();
    logPollTimer = window.setInterval(async () => {
      try {
        const payload = await getDeviceCastStatus(serial);
        const entries = payload?.startupLogs;
        if (!Array.isArray(entries) || entries.length <= logPollConsumed) {
          return;
        }
        ingestStartupLogs(entries.slice(logPollConsumed));
        logPollConsumed = entries.length;
      } catch {
        // ignore polling errors
      }
    }, 600);
  }

  function hideStartupLogs() {
    showStartupLogs.value = false;
    stopLogPolling();
  }

  async function beginCast(payload) {
    const serial = serialRef.value;

    if (!serial) {
      throw new Error("设备序列号无效，无法开始投屏。");
    }

    if (!payload?.success) {
      throw new Error("投屏会话无效。");
    }

    errorMessage.value = "";
    status.value = "starting";
    screenSize.value = { width: 0, height: 0 };
    showStartupLogs.value = true;
    startupLog.reset();
    syncStartupLogText();
    appendStartupLog("用户点击开始投屏");
    appendStartupLog("正在请求后端启动投屏…");
    ingestStartupLogs(payload?.startupLogs);
    appendStartupLog("前端：scrcpy 启动成功");

    const audioOnly = isAudioOnlyCast(unref(castOptionsRef));

    if (audioOnly) {
      if (!WsScrcpyAudioCanvas.isSupported()) {
        status.value = "error";
        errorMessage.value = "当前浏览器不支持 Web Audio，无法使用仅音频模式。";
        throw new Error(errorMessage.value);
      }
    } else if (!WsScrcpyAnnexBPlayer.isSupported()) {
      status.value = "error";
      errorMessage.value = "当前浏览器不支持 WebCodecs H.264 解码（请使用 Chrome / Edge）。";
      throw new Error(errorMessage.value);
    }

    sessionMeta.value = payload;
    backendSessionActive = true;
    logPollConsumed = Array.isArray(payload?.startupLogs) ? payload.startupLogs.length : 0;
    startLogPolling(serial);

    await nextTick();
    appendStartupLog("正在连接 WebSocket 视频流…");
    await openWebSocket(serial);
    const castOptions = unref(castOptionsRef) ?? {};
    unbindCanvas?.();

    const interactionEnabled = castOptions.castMode !== "camera" && getInteractionEnabled();

    unbindCanvas = attachCastInteraction({
      canvas: canvasRef.value,
      getScreenSize: getEffectiveScreenSize,
      getRotator: () => rotatorRef?.value ?? null,
      hasScreenInfo: () => getEffectiveScreenSize().width > 0,
      sendControl,
      interactionEnabled,
    });

    unbindKeyboard?.();
    const keyboardRoot = viewportRef?.value ?? canvasRef.value;
    unbindKeyboard =
      interactionEnabled && keyboardRoot
        ? attachCastKeyboard({
            root: keyboardRoot,
            sendControl,
          })
        : null;
    applyPreviewRotation(unref(castOptionsRef)?.mirror?.video?.rotationDeg ?? 0);
    status.value = "streaming";

    if (audioOnly && typeof player.value?.resumeForUserPlayback === "function") {
      void player.value.resumeForUserPlayback();
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
      await beginCast(payload);
    } catch (error) {
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : "投屏启动失败";
      await stopCast({ backend: backendSessionActive });
      throw error;
    }
  }

  async function resumeCastAudio() {
    const currentPlayer = player.value;

    if (typeof currentPlayer?.resumeForUserPlayback === "function") {
      await currentPlayer.resumeForUserPlayback();
      return;
    }

    await audioPlayback?.resumeForUserPlayback?.();
  }

  function markFirstFrameRendered() {
    openWebSocketReady?.();

    if (!showStartupLogs.value) {
      return;
    }
    const size = screenSize.value;
    if (size.width > 0 && size.height > 0) {
      appendStartupLog(`视频尺寸 ${size.width} × ${size.height}`);
    }
    appendStartupLog("首帧已渲染");
    hideStartupLogs();
  }

  function applyControlVideoSize(size) {
    if (!size?.width || !size?.height) {
      return;
    }

    if (
      screenSize.value.width === size.width &&
      screenSize.value.height === size.height
    ) {
      return;
    }

    screenSize.value = { width: size.width, height: size.height };
  }

  function getEffectiveScreenSize() {
    if (screenSize.value.width > 0 && screenSize.value.height > 0) {
      return screenSize.value;
    }

    return { width: 0, height: 0 };
  }

  function openWebSocket(serial) {
    return new Promise((resolve, reject) => {
      closeWebSocket();

      const castOptions = unref(castOptionsRef) ?? {};
      const canvas = canvasRef.value;

      if (!canvas) {
        reject(new Error("投屏画布未就绪"));
        return;
      }

      const audioOnly = isAudioOnlyCast(castOptions);
      const nextPlayer = audioOnly ? new WsScrcpyAudioCanvas(canvas) : new WsScrcpyAnnexBPlayer(canvas);
      player.value = nextPlayer;
      nextPlayer.onFirstFrameRendered = markFirstFrameRendered;
      if (!audioOnly && typeof nextPlayer.onNeedKeyframe !== "undefined") {
        let lastResetAt = 0;
        nextPlayer.onNeedKeyframe = () => {
          const now = Date.now();
          if (now - lastResetAt < 2000) {
            return;
          }
          lastResetAt = now;
          try {
            sendControl(serializeResetVideo());
          } catch {
            // ignore
          }
        };
      }

      if (!audioOnly && typeof nextPlayer.onVideoFrameSize !== "undefined") {
        nextPlayer.onVideoFrameSize = applyControlVideoSize;
      }

      audioPlayback?.destroy();
      audioPlayback =
        !audioOnly && isCastAudioEnabled(castOptions) && WsScrcpyAudioPlayback.isSupported()
          ? new WsScrcpyAudioPlayback()
          : null;

      socket = new WebSocket(buildCastWebSocketUrl(serial, sessionMeta.value));
      socket.binaryType = "arraybuffer";

      let settled = false;
      let videoPipeLive = false;

      const settleReady = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(readyTimeout);
        clearStreamParamRetry?.();
        clearSettleFallback?.();
        openWebSocketReady = null;
        resolve();
      };

      const failReady = (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(readyTimeout);
        clearStreamParamRetry?.();
        clearSettleFallback?.();
        openWebSocketReady = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      openWebSocketReady = settleReady;

      let streamParametersSent = false;
      let streamParamRecovered = false;
      let streamParamRetryTimer = null;
      let streamParamRetryCount = 0;
      let settleFallbackTimer = null;

      const clearStreamParamRetry = () => {
        if (streamParamRetryTimer) {
          clearTimeout(streamParamRetryTimer);
          streamParamRetryTimer = null;
        }
      };

      const clearSettleFallback = () => {
        if (settleFallbackTimer) {
          clearTimeout(settleFallbackTimer);
          settleFallbackTimer = null;
        }
      };

      // Fail fast — 30s left the multi-app window stuck on a loading overlay.
      const readyTimeout = setTimeout(() => {
        if (audioOnly) {
          settleReady();
          return;
        }
        // Prefer soft-ready over hard-fail: VD may exist while decode still warms up.
        if (streamParametersSent) {
          appendStartupLog("首帧较慢，先结束等待（继续收流）");
          settleReady();
          return;
        }
        failReady(new Error("等待视频超时，请重试"));
      }, 8_000);

      const sendStreamParameters = (reason) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          appendStartupLog(`流参数未发送（socket 未就绪，${reason}）`);
          return false;
        }

        try {
          const options = unref(castOptionsRef) ?? {};
          const body = serializeChangeStreamParameters(
            videoSettingsFromCastOptions(options, sessionMeta.value),
          );
          const copy = new Uint8Array(body.byteLength);
          copy.set(body);
          sendControl(copy);
          streamParametersSent = true;
          appendStartupLog(`已发送流参数 (${reason}, ${copy.byteLength}B)`);
          return true;
        } catch (error) {
          appendStartupLog(
            `流参数发送失败 (${reason}): ${error instanceof Error ? error.message : String(error)}`,
          );
          return false;
        }
      };

      const scheduleStreamParamRetries = () => {
        clearStreamParamRetry();
        streamParamRetryCount = 0;
        streamParamRetryTimer = setTimeout(() => {
          streamParamRetryTimer = null;
          if (settled || videoPipeLive || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
          }
          streamParamRetryCount += 1;
          sendStreamParameters("retry-1");
        }, 1200);
      };

      socket.addEventListener("open", () => {
        appendStartupLog("WebSocket 已连接");
        sendStreamParameters("ws-open");
        scheduleStreamParamRetries();
        queueStartAppAfterConnect(400);
        // Fallback: never leave callers blocked if video NALs are delayed.
        clearSettleFallback();
        settleFallbackTimer = setTimeout(() => {
          settleFallbackTimer = null;
          if (!settled && streamParametersSent) {
            appendStartupLog("流参数已发送，结束连接等待");
            settleReady();
          }
        }, 700);
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          const castError = parseCastErrorMessage(event.data);
          if (castError) {
            const friendly = isVirtualDisplayError(castError.message || castError.code)
              ? formatVirtualDisplayUserMessage(castError.message)
              : castError.message || "投屏失败";
            status.value = "error";
            errorMessage.value = friendly;
            appendStartupLog(`设备报错：${castError.code} ${castError.message || ""}`.trim());
            clearStreamParamRetry();
            clearSettleFallback();
            failReady(new Error(friendly));
          }
          return;
        }

        if (!videoPipeLive && (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data))) {
          const head = new Uint8Array(
            event.data instanceof ArrayBuffer
              ? event.data
              : event.data.buffer,
            event.data instanceof ArrayBuffer ? 0 : event.data.byteOffset,
            Math.min(8, event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.byteLength),
          );
          if (
            head.length >= 4 &&
            head[0] === 0x00 &&
            head[1] === 0x00 &&
            (head[2] === 0x01 || (head[2] === 0x00 && head[3] === 0x01))
          ) {
            videoPipeLive = true;
            clearStreamParamRetry();
            clearSettleFallback();
            appendStartupLog("已收到视频流");
            if (!settled && !audioOnly) {
              settleReady();
            }
            // Do not RESET_VIDEO here — first IDR usually arrives with the stream;
            // forcing a reset mid-start causes a visible hitch on multi-app VD.
          }
        }

        handleWsScrcpyBinary(
          {
            player: player.value,
            audioPlayback,
            status,
            errorMessage,
            onInitialInfo: () => {
              if (!streamParametersSent) {
                appendStartupLog("设备已响应，发送流参数");
                sendStreamParameters("scrcpy-initial");
              } else {
                appendStartupLog("设备已响应，流参数已发送");
                clearStreamParamRetry();
              }
              streamParamRecovered = true;
              queueStartAppAfterConnect(400);
              // Server is alive — enough to unblock beginCast for multi-app UI.
              if (!settled && streamParametersSent) {
                clearSettleFallback();
                settleReady();
              }
            },
            onDeviceMessage: (message) => {
              if (message.type === "clipboard" && message.text != null) {
                void handleDeviceClipboard(message.text);
              }
            },
          },
          event.data,
        );

        if (!settled && audioOnly) {
          const bytes = new Uint8Array(event.data);

          if (isScrcpyAudioPacket(bytes)) {
            clearStreamParamRetry();
            settleReady();
          }
        }
      });

      socket.addEventListener("error", () => {
        failReady(new Error("投屏 WebSocket 连接失败"));
      });

      socket.addEventListener("close", (event) => {
        clearTimeout(readyTimeout);

        if (!settled) {
          const reason = typeof event.reason === "string" && event.reason.trim()
            ? event.reason.trim()
            : "投屏 WebSocket 连接已关闭";
          failReady(new Error(reason));
          return;
        }

        if (status.value === "streaming") {
          status.value = "error";
          errorMessage.value = "投屏连接已断开";
        }
      });
    });
  }

  function clearStartAppTimer() {
    if (startAppTimer) {
      clearTimeout(startAppTimer);
      startAppTimer = null;
    }
  }

  function queueStartAppAfterConnect(delayMs) {
    const screen = unref(castOptionsRef)?.mirror?.screen ?? {};
    const packageName = resolveStartAppPackage(screen);

    if (!packageName || startAppSent) {
      return;
    }

    // Official/web path: start_app in type-101 extras launches when the VD is ready.
    // Do not send a delayed START_APP control — it only adds 2–4s of empty wait.
    if (isNewDisplayEnabled(screen) && String(screen.newDisplayApp || "").trim()) {
      startAppSent = true;
      return;
    }

    const baseDelay = delayMs ?? 400;

    const sendOnce = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const buffer = serializeStartApp(packageName);

      if (buffer) {
        sendControl(buffer);
      }
    };

    clearStartAppTimer();
    startAppTimer = setTimeout(() => {
      startAppTimer = null;
      startAppSent = true;
      sendOnce();
    }, baseDelay);
  }

  function closeWebSocket() {
    clearStartAppTimer();
    startAppSent = false;
    openWebSocketReady = null;
    unbindCanvas?.();
    unbindCanvas = null;
    unbindKeyboard?.();
    unbindKeyboard = null;
    lastOutboundClipboard = "";

    if (socket) {
      socket.close();
      socket = null;
    }

    player.value?.destroy();
    player.value = null;
    audioPlayback?.destroy();
    audioPlayback = null;
    sessionMeta.value = null;
    displayScreenOn.value = true;
  }

  function sendControl(buffer) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Ensure a standalone binary frame (Uint8Array or ArrayBuffer both OK for ws).
    if (buffer instanceof ArrayBuffer) {
      socket.send(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      const copy = new Uint8Array(buffer.byteLength);
      copy.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
      socket.send(copy);
    } else {
      socket.send(buffer);
    }
    onControlSent?.(buffer);
  }

  /** Re-send type-101 from current castOptions (e.g. maxFps change). */
  function resendStreamParameters(reason = "options-update") {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      const body = serializeChangeStreamParameters(
        videoSettingsFromCastOptions(unref(castOptionsRef) ?? {}, sessionMeta.value),
      );
      const copy = new Uint8Array(body.byteLength);
      copy.set(body);
      sendControl(copy);
      return true;
    } catch (error) {
      appendStartupLog(
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
    lastOutboundClipboard = value;
    clipboardSequence += 1n;
    const buffer = serializeSetClipboard(value, paste, clipboardSequence);

    if (buffer) {
      sendControl(buffer);
    }
  }

  async function handleDeviceClipboard(text) {
    const value = String(text ?? "");

    if (!value || value === lastOutboundClipboard) {
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

  function applyPreviewRotation(degrees) {
    applyStagePreviewRotation(
      rotatorRef?.value ?? null,
      degrees,
      viewportRef?.value ?? null,
    );

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  async function stopCast(options = {}) {
    const serial = serialRef.value;
    const shouldStopBackend = options.backend ?? backendSessionActive;
    const sessionKey = sessionMeta.value?.sessionKey;

    await recording.stopCastRecording(true);
    closeWebSocket();
    hideStartupLogs();
    startupLog.reset();
    syncStartupLogText();
    screenSize.value = { width: 0, height: 0 };
    status.value = "idle";
    errorMessage.value = "";
    sessionMeta.value = null;
    backendSessionActive = false;

    if (!serial || !shouldStopBackend || !isCastActive()) {
      return;
    }

    stopRequest?.abort();
    stopRequest = new AbortController();

    try {
      await stopDeviceCast(serial, {
        signal: stopRequest.signal,
        sessionKey: sessionKey || undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
    } finally {
      stopRequest = null;
    }
  }

  watch(
    () => unref(castOptionsRef)?.mirror?.video?.rotationDeg,
    (degrees) => {
      applyPreviewRotation(degrees ?? 0);
    },
  );

  watch(status, (next, prev) => {
    if (prev === "streaming" && next !== "streaming" && recording.isRecording.value) {
      void recording.stopCastRecording(true);
    }
  });

  onBeforeUnmount(() => {
    if (isCastActive()) {
      void stopCast();
    }
  });

  return {
    status,
    errorMessage,
    startupLogText,
    showStartupLogs,
    screenSize,
    sessionMeta,
    beginCast,
    startCast,
    stopCast,
    sendNavigationPress: (actionId, phase) => {
      const keyAction = phase === "down" ? KEY_ACTION.DOWN : KEY_ACTION.UP;
      const buffer = serializeNavigationPress(actionId, keyAction);

      if (buffer) {
        sendControl(buffer);
      }
    },
    sendNavigation: (actionId) => {
      if (actionId === "screen-off" || actionId === "screen-on") {
        const turnOn = actionId === "screen-on";
        displayScreenOn.value = turnOn;

        if (turnOn) {
          for (const buffer of serializeDisplayWakeActions()) {
            sendControl(buffer);
          }
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
    },
    displayScreenOn,
    applyPreviewRotation,
    isRecording: recording.isRecording,
    recordingElapsedMs: recording.recordingElapsedMs,
    castVideoRecordingSupported: recording.castVideoRecordingSupported,
    castAudioRecordingSupported: recording.castAudioRecordingSupported,
    isCastRecordingSupported: recording.isCastRecordingSupported,
    startCastRecording: recording.startCastRecording,
    stopCastRecording: recording.stopCastRecording,
    toggleCastRecording: recording.toggleCastRecording,
    resumeCastAudio,
    sendCameraControl,
    sendControl,
    resendStreamParameters,
    sendInjectText,
    pasteClipboardToDevice,
    copyClipboardFromDevice,
    getEffectiveScreenSize,
    sendStartApp: (packageName) => {
      const buffer = serializeStartApp(packageName);
      if (buffer) {
        sendControl(buffer);
      }
    },
    sendResizeDisplay: (width, height) => {
      sendControl(serializeResizeDisplay(width, height));
    },
  };
}
