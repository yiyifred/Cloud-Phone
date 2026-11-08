import { APP_VERSION } from "../config/version.js";
import {
  attachIosCastWebSocket,
  ensureIosCastPipe,
  getIosCastSession,
  getIosStartupLogs,
  startIosCast,
  stopIosCast,
} from "../services/ios-cast/index.js";
import { logIosCastError, logIosCastInfo } from "../services/ios-cast/cast-logger.js";
import { appendIosStartupLog } from "../services/ios-cast/startup-log.js";
import { withCastSessionTracking } from "../metrics/cast-tracker.js";
import { sendProtectedJson } from "../utils/protected-http.js";

export async function handleIosCastRoute(req, res, method, pathname) {
  const startMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/start$/);
  const stopMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/stop$/);
  const statusMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cast\/status$/);

  if (method === "POST" && startMatch) {
    const serial = decodeURIComponent(startMatch[1]);

    try {
      logIosCastInfo(serial, "api.cast.start", {});
      const session = await withCastSessionTracking("ios", serial, () => startIosCast(serial));
      sendProtectedJson(res, 200, { success: true, version: APP_VERSION, ...session });
    } catch (error) {
      logIosCastError(serial, "api.cast.start_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "ios_cast_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "DELETE" && stopMatch) {
    const serial = decodeURIComponent(stopMatch[1]);

    try {
      const stopped = await withCastSessionTracking("ios", serial, () => stopIosCast(serial));
      sendProtectedJson(res, 200, { success: true, version: APP_VERSION, serial, stopped });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "ios_cast_stop_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "GET" && statusMatch) {
    const serial = decodeURIComponent(statusMatch[1]);
    const session = getIosCastSession(serial);

    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      serial,
      platform: "ios",
      active: Boolean(session),
      streaming: session?.streaming ?? false,
      wsClients: session?.clients.size ?? 0,
      frameCount: session?.frameCount ?? 0,
      castProtocol: "ios-mjpeg",
      startupLogs: getIosStartupLogs(session),
    });
    return true;
  }

  return false;
}

export async function handleIosCastWebSocket(ws, serial) {
  const session = getIosCastSession(serial);

  if (!session) {
    ws.close(1008, "iOS cast session is not active. Call cast/start first.");
    return;
  }

  logIosCastInfo(serial, "ws.client.connected", { endpoint: session.endpoint });
  appendIosStartupLog(session, "后端：WebSocket 客户端已接入");

  try {
    await ensureIosCastPipe(serial);

    if (ws.readyState !== 1) {
      return;
    }

    await attachIosCastWebSocket(ws, serial);
  } catch (error) {
    logIosCastError(serial, "ws.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    session.clients.delete(ws);
    ws.close(1011, error instanceof Error ? error.message : "iOS cast failed");
  }
}
