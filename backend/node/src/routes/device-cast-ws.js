import { logCastError, logCastInfo, logCastWarn } from "../services/scrcpy-cast/cast-logger.js";
import { sessionKeyOf } from "../services/device-control-lease.js";
import {
  attachWebSocketClient,
  ensureCastVideoPipe,
  getCastSession,
  waitForCastSession,
} from "../services/scrcpy-cast/index.js";
import { appendCastStartupLog } from "../services/scrcpy-cast/startup-log.js";
import { proxyWebSocket } from "../services/scrcpy-cast/ws-scrcpy-ws-proxy.js";
import { resolveDevicePlatform } from "../services/device-platform-registry.js";
import { getHarmonyCastSession } from "../services/harmony-cast/index.js";
import { handleHarmonyCastWebSocket } from "./harmony-cast-routes.js";
import { getIosCastSession } from "../services/ios-cast/index.js";
import { handleIosCastWebSocket } from "./ios-cast-routes.js";

export function parseCastWebSocketPath(pathname) {
  const videoMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/ws$/);

  if (videoMatch) {
    return { serial: decodeURIComponent(videoMatch[1]), channel: "video" };
  }

  const controlMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/control\/ws$/);

  if (controlMatch) {
    return { serial: decodeURIComponent(controlMatch[1]), channel: "control" };
  }

  return null;
}

/**
 * @param {import("ws").WebSocket} ws
 * @param {string} serial
 * @param {{ earlyClientMessages?: unknown[], detachEarlyMessage?: () => void, sessionKey?: string, sessionToken?: string|null }} [early]
 */
export async function handleCastWebSocket(ws, serial, early = {}) {
  const earlyClientMessages = early.earlyClientMessages ?? [];
  const detachEarlyMessage = early.detachEarlyMessage ?? (() => {});
  const sessionKey = early.sessionKey || serial;
  // 只记哈希引用，不落原始 sessionToken；控制帧拦截本身在 ws 上层的 control-guard 完成
  const controlSessionKey = sessionKeyOf(early.sessionToken);

  const releaseEarly = () => {
    try {
      detachEarlyMessage();
    } catch {
      // ignore
    }
  };

  try {
    if (getIosCastSession(serial)) {
      releaseEarly();
      await handleIosCastWebSocket(ws, serial);
      return;
    }

    if ((await resolveDevicePlatform(serial)) === "ios") {
      releaseEarly();
      await handleIosCastWebSocket(ws, serial);
      return;
    }

    if (getHarmonyCastSession(serial)) {
      releaseEarly();
      await handleHarmonyCastWebSocket(ws, serial);
      return;
    }

    if ((await resolveDevicePlatform(serial)) === "harmony") {
      releaseEarly();
      await handleHarmonyCastWebSocket(ws, serial);
      return;
    }

    const session = getCastSession(sessionKey);

    if (!session) {
      releaseEarly();
      logCastWarn(serial, "ws.rejected", { reason: "cast session missing", sessionKey });
      ws.close(1008, "Cast session is not active. Call cast/start first.");
      return;
    }

    const prefetchedClientMessages = [...earlyClientMessages];
    const prefetchClientMessage = (data) => {
      prefetchedClientMessages.push(data);
    };

    ws.on("message", prefetchClientMessage);

    try {
      logCastInfo(serial, "ws.session.begin", {
        sessionKey,
        controlSessionKey,
        webCast: Boolean(session.webCast),
        localPort: session.localPort,
        deviceWsPort: session.deviceWsPort ?? null,
        isolateServer: Boolean(session.isolateServer),
        serverExited: session.serverExited ?? false,
        shellPid: session.shellProcess?.pid ?? null,
        earlyPrefetched: earlyClientMessages.length,
      });
      appendCastStartupLog(session, "后端：WebSocket 客户端已接入");

      await ensureCastVideoPipe(sessionKey);

      if (ws.readyState !== 1) {
        logCastWarn(serial, "ws.session.client_closed", { readyState: ws.readyState });
        return;
      }

      logCastInfo(serial, "ws.session.pipe_ready", {
        sessionKey,
        webCast: Boolean(session.webCast),
        serverExited: session.serverExited ?? false,
        shellPid: session.shellProcess?.pid ?? null,
      });

      if (session.webCast) {
        const remoteUrl = `ws://127.0.0.1:${session.localPort}/`;
        logCastInfo(serial, "ws.proxy.attach", {
          remoteUrl,
          sessionKey,
          prefetchedMessages: prefetchedClientMessages.length,
        });

        const shouldAbort = () =>
          ws.readyState !== 1 ||
          session.stopping ||
          session.serverExited ||
          getCastSession(sessionKey) !== session;

        const proxied = await proxyWebSocket(ws, remoteUrl, {
          prefetchedClientMessages,
          serial,
          shouldAbort,
          onProxyListening: () => {
            ws.off("message", prefetchClientMessage);
            releaseEarly();
          },
        });

        if (!proxied) {
          logCastInfo(serial, "ws.proxy.aborted", { remoteUrl });
        }

        return;
      }

      ws.off("message", prefetchClientMessage);
      releaseEarly();

      logCastInfo(serial, "ws.legacy_bridge", {
        prefetchedMessages: prefetchedClientMessages.length,
      });
      attachWebSocketClient(session, ws);
      await waitForCastSession(session);
    } catch (error) {
      ws.off("message", prefetchClientMessage);
      releaseEarly();

      const aborted =
        error?.code === "proxy_connect_aborted" ||
        error?.code === "cast_port_wait_aborted" ||
        session.stopping;

      if (aborted) {
        logCastInfo(serial, "ws.aborted", {
          message: error instanceof Error ? error.message : "cast aborted",
        });

        if (ws.readyState === 1) {
          ws.close(1000, "cast stopped");
        }

        return;
      }

      logCastError(serial, "ws.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      session.clients.delete(ws);
      ws.close(1011, error instanceof Error ? error.message : "Cast failed");
    }
  } catch (error) {
    releaseEarly();
    throw error;
  }
}

export async function handleCastControlWebSocket(ws) {
  ws.close(1000, "Use /cast/ws for ws-scrcpy protocol");
}
