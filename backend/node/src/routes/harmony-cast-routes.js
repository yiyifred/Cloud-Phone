import { APP_VERSION } from "../config/version.js";
import {
  getHarmonyCastSession,
  getHarmonyStartupLogs,
  startHarmonyCast,
  stopHarmonyCast,
  attachHarmonyCastWebSocket,
  ensureHarmonyCastPipe,
} from "../services/harmony-cast/index.js";
import { logHarmonyCastError, logHarmonyCastInfo } from "../services/harmony-cast/cast-logger.js";
import { appendHarmonyStartupLog } from "../services/harmony-cast/startup-log.js";
import { withCastSessionTracking } from "../metrics/cast-tracker.js";
import { readProtectedJsonBody, sendProtectedJson } from "../utils/protected-http.js";

export async function handleHarmonyCastRoute(req, res, method, pathname) {
  const startMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/start$/);
  const stopMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/stop$/);
  const statusMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/status$/);

  if (method === "POST" && startMatch) {
    const serial = decodeURIComponent(startMatch[1]);

    try {
      const body = await readProtectedJsonBody(req, res);
      logHarmonyCastInfo(serial, "api.cast.start", { options: body ?? {} });
      const session = await withCastSessionTracking("harmony", serial, () =>
        startHarmonyCast(serial, body ?? {}),
      );

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        ...session,
      });
    } catch (error) {
      logHarmonyCastError(serial, "api.cast.start_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "harmony_cast_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "DELETE" && stopMatch) {
    const serial = decodeURIComponent(stopMatch[1]);

    try {
      logHarmonyCastInfo(serial, "api.cast.stop", {});
      const stopped = await withCastSessionTracking("harmony", serial, () => stopHarmonyCast(serial));
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        stopped,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "harmony_cast_stop_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "GET" && statusMatch) {
    const serial = decodeURIComponent(statusMatch[1]);
    const session = getHarmonyCastSession(serial);

    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      serial,
      platform: "harmony",
      active: Boolean(session),
      streaming: session?.streaming ?? false,
      localPort: session?.localPort ?? null,
      wsClients: session?.clients.size ?? 0,
      frameCount: session?.frameCount ?? 0,
      castProtocol: "harmony-jpeg",
      startupLogs: getHarmonyStartupLogs(session),
    });
    return true;
  }

  return false;
}

export async function handleHarmonyCastWebSocket(ws, serial) {
  const session = getHarmonyCastSession(serial);

  if (!session) {
    ws.close(1008, "Harmony cast session is not active. Call cast/start first.");
    return;
  }

  logHarmonyCastInfo(serial, "ws.client.connected", { localPort: session.localPort });
  appendHarmonyStartupLog(session, "后端：WebSocket 客户端已接入");

  try {
    await ensureHarmonyCastPipe(serial);

    if (ws.readyState !== 1) {
      logHarmonyCastInfo(serial, "ws.client.closed_before_attach", { readyState: ws.readyState });
      return;
    }

    await attachHarmonyCastWebSocket(ws, serial);
  } catch (error) {
    logHarmonyCastError(serial, "ws.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    session.clients.delete(ws);
    ws.close(1011, error instanceof Error ? error.message : "Harmony cast failed");
  }
}
