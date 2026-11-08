/**
 * WebSocket 视频流的连接生命周期（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么这一整段不能被切得更碎：它围绕三个局部变量（settled / videoPipeLive /
 * streamParametersSent）做「谁先到就软就绪、否则超时硬失败」的仲裁，拆开就必须把
 * 这些状态外提成模块级字段，反而更容易在多次连接之间串味。这里保留单函数 +
 * 内联闭包，只是把与连接无关的判断（首帧 sniff、错误文案）移到 cast-stream-probe.js。
 */
import { unref } from "vue";

import { buildCastWebSocketUrl, handleWsScrcpyBinary, isAudioOnlyCast, isCastAudioEnabled } from "../../utils/scrcpy-cast-helpers.js";
import { parseCastErrorMessage } from "../../utils/cast-error-message.js";
import { serializeChangeStreamParameters, videoSettingsFromCastOptions } from "../../utils/ws-scrcpy-video-settings.js";
import { serializeResetVideo } from "../../utils/ws-scrcpy-control.js";
import { WsScrcpyAnnexBPlayer } from "../../utils/ws-scrcpy-annexb-player.js";
import { WsScrcpyAudioCanvas, isScrcpyAudioPacket } from "../../utils/ws-scrcpy-audio-canvas.js";
import { WsScrcpyAudioPlayback } from "../../utils/ws-scrcpy-audio-playback.js";

import { formatCastErrorForUser, isVideoStreamStart } from "./cast-stream-probe.js";

export function createCastStreamConnection({ ctx, canvasRef, castOptionsRef, socketApi, startup, frameState, control }) {
  const appendStartupLog = startup.append;

  function openWebSocket(serial) {
    return new Promise((resolve, reject) => {
      socketApi.close();

      const castOptions = unref(castOptionsRef) ?? {};
      const canvas = canvasRef.value;

      if (!canvas) {
        reject(new Error("投屏画布未就绪"));
        return;
      }

      const audioOnly = isAudioOnlyCast(castOptions);
      const nextPlayer = audioOnly ? new WsScrcpyAudioCanvas(canvas) : new WsScrcpyAnnexBPlayer(canvas);
      ctx.player.value = nextPlayer;
      nextPlayer.onFirstFrameRendered = frameState.markFirstFrameRendered;
      if (!audioOnly && typeof nextPlayer.onNeedKeyframe !== "undefined") {
        // 丢包后请求关键帧要限速：设备端每次 RESET_VIDEO 都会真的重编一帧，
        // 连发会把弱网变成反复卡顿。
        let lastResetAt = 0;
        nextPlayer.onNeedKeyframe = () => {
          const now = Date.now();
          if (now - lastResetAt < 2000) {
            return;
          }
          lastResetAt = now;
          try {
            socketApi.sendControl(serializeResetVideo());
          } catch {
            // 关键帧请求是尽力而为：socket 已断时静默即可，由 close 事件统一收尾。
          }
        };
      }

      if (!audioOnly && typeof nextPlayer.onVideoFrameSize !== "undefined") {
        nextPlayer.onVideoFrameSize = frameState.applyControlVideoSize;
      }

      ctx.audioPlayback?.destroy();
      ctx.audioPlayback =
        !audioOnly && isCastAudioEnabled(castOptions) && WsScrcpyAudioPlayback.isSupported()
          ? new WsScrcpyAudioPlayback()
          : null;

      ctx.socket = new WebSocket(buildCastWebSocketUrl(serial, ctx.sessionMeta.value));
      ctx.socket.binaryType = "arraybuffer";

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
        ctx.openWebSocketReady = null;
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
        ctx.openWebSocketReady = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      ctx.openWebSocketReady = settleReady;

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
        if (!ctx.socket || ctx.socket.readyState !== WebSocket.OPEN) {
          appendStartupLog(`流参数未发送（socket 未就绪，${reason}）`);
          return false;
        }

        try {
          const options = unref(castOptionsRef) ?? {};
          const body = serializeChangeStreamParameters(
            videoSettingsFromCastOptions(options, ctx.sessionMeta.value),
          );
          const copy = new Uint8Array(body.byteLength);
          copy.set(body);
          socketApi.sendControl(copy);
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
          if (settled || videoPipeLive || !ctx.socket || ctx.socket.readyState !== WebSocket.OPEN) {
            return;
          }
          streamParamRetryCount += 1;
          sendStreamParameters("retry-1");
        }, 1200);
      };

      ctx.socket.addEventListener("open", () => {
        appendStartupLog("WebSocket 已连接");
        sendStreamParameters("ws-open");
        scheduleStreamParamRetries();
        socketApi.queueStartAppAfterConnect(400);
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

      ctx.socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          const castError = parseCastErrorMessage(event.data);
          if (castError) {
            const friendly = formatCastErrorForUser(castError);
            ctx.status.value = "error";
            ctx.errorMessage.value = friendly;
            appendStartupLog(`设备报错：${castError.code} ${castError.message || ""}`.trim());
            clearStreamParamRetry();
            clearSettleFallback();
            failReady(new Error(friendly));
          }
          return;
        }

        if (!videoPipeLive && isVideoStreamStart(event.data)) {
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

        handleWsScrcpyBinary(
          {
            player: ctx.player.value,
            audioPlayback: ctx.audioPlayback,
            status: ctx.status,
            errorMessage: ctx.errorMessage,
            onInitialInfo: () => {
              if (!streamParametersSent) {
                appendStartupLog("设备已响应，发送流参数");
                sendStreamParameters("scrcpy-initial");
              } else {
                appendStartupLog("设备已响应，流参数已发送");
                clearStreamParamRetry();
              }
              streamParamRecovered = true;
              socketApi.queueStartAppAfterConnect(400);
              // Server is alive — enough to unblock beginCast for multi-app UI.
              if (!settled && streamParametersSent) {
                clearSettleFallback();
                settleReady();
              }
            },
            onDeviceMessage: (message) => {
              if (message.type === "clipboard" && message.text != null) {
                void control.handleDeviceClipboard(message.text);
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

      ctx.socket.addEventListener("error", () => {
        failReady(new Error("投屏 WebSocket 连接失败"));
      });

      ctx.socket.addEventListener("close", (event) => {
        clearTimeout(readyTimeout);

        if (!settled) {
          const reason = typeof event.reason === "string" && event.reason.trim()
            ? event.reason.trim()
            : "投屏 WebSocket 连接已关闭";
          failReady(new Error(reason));
          return;
        }

        if (ctx.status.value === "streaming") {
          ctx.status.value = "error";
          ctx.errorMessage.value = "投屏连接已断开";
        }
      });
    });
  }

  return { openWebSocket };
}
