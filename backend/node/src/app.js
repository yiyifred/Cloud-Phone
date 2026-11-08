import http from "node:http";

import { APP_VERSION } from "./config/version.js";
import { captureDeviceScreenshot } from "./services/device-screenshot.js";
import { resolveDevicePlatform } from "./services/device-platform-registry.js";
import { captureHarmonyScreenshot } from "./services/harmony-device.js";
import { captureIosScreenshot } from "./services/ios/ios-device.js";
import { listAllDevices } from "./services/device-list-service.js";
import { handleAuthRoute } from "./routes/auth-routes.js";
import { handleDeviceCastRoute } from "./routes/device-cast-routes.js";
import { handleDeviceControlRoute } from "./routes/device-control-routes.js";
import { handleDeviceConnectRoute } from "./routes/device-connect-routes.js";
import { handleDeviceRoute } from "./routes/device-routes.js";
import { handleHostRoute } from "./routes/host-routes.js";
import { handleIosDeviceRoute } from "./routes/ios-device-routes.js";
import { handleIosWdaPipelineRoute } from "./routes/ios-wda-pipeline-routes.js";
import { handleLocalPersistenceRoute } from "./routes/local-persistence-routes.js";
import { handleScrcpyRoute } from "./routes/scrcpy-routes.js";
import {
  getSessionTokenFromCookies,
  isPublicApiPath,
  requireApiSession,
} from "./middleware/api-auth.js";
import { parseCookies } from "./utils/cookies.js";
import { applyCors, rejectOversizedRequest, sendEmpty } from "./utils/http.js";
import {
  attachResponseEncryption,
  sendLoginWireProtectedJson,
  sendProtectedBuffer,
  sendProtectedJson,
} from "./utils/protected-http.js";

function sendUnauthorized(res) {
  sendLoginWireProtectedJson(res, 401, {
    success: false,
    version: APP_VERSION,
    error: "unauthorized",
    message: "Valid session required. Sign in first.",
  });
}

export function createApp() {
  return http.createServer(async (req, res) => {
    const { method, url } = req;
    const requestUrl = new URL(url ?? "/", "http://127.0.0.1");
    const { pathname } = requestUrl;
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = getSessionTokenFromCookies(cookies);

    applyCors(req, res);

    // Reject on the declared length before any handler buffers the body.
    if (rejectOversizedRequest(req, res, pathname)) {
      return;
    }

    if (method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }

    if (pathname.startsWith("/api/") && !isPublicApiPath(pathname, method)) {
      const session = await requireApiSession(sessionToken);
      if (!session) {
        sendUnauthorized(res);
        return;
      }
      attachResponseEncryption(res, session.encryptionKey);
    }

    if (handleHostRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleAuthRoute(req, res, method, pathname, sessionToken)) {
      return;
    }

    if (await handleLocalPersistenceRoute(req, res, method, pathname, requestUrl)) {
      return;
    }

    if (method === "GET" && pathname === "/api/devices") {
      try {
        const { adbPath, hdcPath, devices, total, host } = await listAllDevices();
        sendProtectedJson(res, 200, {
          success: true,
          version: APP_VERSION,
          adbPath,
          hdcPath,
          host,
          total,
          devices,
        });
      } catch (error) {
        sendProtectedJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "devices_list_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    if (await handleDeviceConnectRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleIosWdaPipelineRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleIosDeviceRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleDeviceControlRoute(req, res, method, pathname, sessionToken)) {
      return;
    }

    if (await handleDeviceCastRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleDeviceRoute(req, res, method, pathname, requestUrl)) {
      return;
    }

    if (await handleScrcpyRoute(req, res, method, pathname)) {
      return;
    }

    const screenshotMatch = pathname.match(/^\/api\/devices\/([^/]+)\/screenshot$/);
    if (method === "GET" && screenshotMatch) {
      const serial = decodeURIComponent(screenshotMatch[1]);
      try {
        const platform = await resolveDevicePlatform(serial);
        const screenshot =
          platform === "ios"
            ? await captureIosScreenshot(serial)
            : platform === "harmony"
              ? await captureHarmonyScreenshot(serial)
              : await captureDeviceScreenshot(serial);
        const mime = platform === "harmony" ? "image/jpeg" : "image/png";
        sendProtectedBuffer(res, 200, screenshot, mime);
      } catch (error) {
        const code = error?.code ?? "screenshot_failed";
        const transient = code === "device_offline" || code === "adb_connection_closed";
        if (!res.writableEnded) {
          sendProtectedJson(res, transient ? 503 : 500, {
            success: false,
            version: APP_VERSION,
            error: code,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return;
    }

    sendProtectedJson(res, 404, {
      success: false,
      version: APP_VERSION,
      error: "not_found",
    });
  });
}
