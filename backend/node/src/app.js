import http from "node:http";

import { APP_VERSION } from "./config/version.js";
import {
  connectDeviceByHost,
  createQrPairingSession,
  listDevices,
  pairDeviceByQrService,
  pairDeviceWithCode,
} from "./services/adb-service.js";
import { captureDeviceScreenshot } from "./services/device-screenshot.js";
import {
  changePassword,
  getAuthStatus,
  getClearSessionCookie,
  getSessionCookie,
  loginWithPassword,
  revokeSessionToken,
} from "./services/auth-service.js";
import { handleDeviceCastRoute } from "./routes/device-cast-routes.js";
import { handleDeviceRoute } from "./routes/device-routes.js";
import { handleScrcpyRoute } from "./routes/scrcpy-routes.js";
import {
  getSessionTokenFromCookies,
  isPublicApiPath,
  requireApiSession,
} from "./middleware/api-auth.js";
import { parseCookies } from "./utils/cookies.js";
import { applyCors, readJsonBody, sendEmpty, sendJson } from "./utils/http.js";
import {
  attachResponseEncryption,
  readProtectedJsonBody,
  sendPasswordProtectedJson,
  sendProtectedBuffer,
  sendProtectedJson,
} from "./utils/protected-http.js";

function sendUnauthorized(res) {
  sendJson(res, 401, {
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

    if (method === "GET" && pathname === "/health") {
      const session = await requireApiSession(sessionToken);

      if (!session) {
        sendUnauthorized(res);
        return;
      }

      attachResponseEncryption(res, session.encryptionKey);
      sendProtectedJson(res, 200, {
        status: "ok",
        service: "cloud-phone-node",
        version: APP_VERSION,
      });
      return;
    }

    if (method === "GET" && pathname === "/api/auth/session") {
      try {
        const authStatus = await getAuthStatus(sessionToken);

        sendJson(res, 200, {
          success: true,
          version: APP_VERSION,
          ...authStatus,
        });
      } catch (error) {
        sendJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "auth_session_failed",
          message: error instanceof Error ? error.message : "Failed to read auth session.",
        });
      }

      return;
    }

    if (method === "GET" && pathname === "/api/ping") {
      sendJson(res, 200, {
        success: true,
        service: "cloud-phone-node",
        version: APP_VERSION,
      });
      return;
    }

    if (method === "POST" && pathname === "/api/auth/login") {
      try {
        const body = await readJsonBody(req);
        const password = String(body.password ?? "");
        const result = await loginWithPassword(password);

        if (!result.success) {
          sendJson(res, 401, {
            success: false,
            version: APP_VERSION,
            code: result.code,
            message: result.message,
          });
          return;
        }

        const headers = result.session
          ? { "Set-Cookie": getSessionCookie(result.session.token) }
          : {};

        sendPasswordProtectedJson(
          res,
          200,
          {
            success: true,
            version: APP_VERSION,
            authenticated: result.authenticated,
            requiresPasswordChange: result.requiresPasswordChange,
            passwordConfigured: result.passwordConfigured,
            sessionExpiresAt: result.session?.expiresAt ?? null,
            encryptionKey: result.session?.encryptionKey ?? null,
          },
          password,
          headers,
        );
      } catch (error) {
        sendJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_request",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/auth/change-password") {
      try {
        const session = await requireApiSession(sessionToken);
        if (session) {
          attachResponseEncryption(res, session.encryptionKey);
        }

        const body = session ? await readProtectedJsonBody(req, res) : await readJsonBody(req);

        const result = await changePassword(
          String(body.currentPassword ?? ""),
          String(body.nextPassword ?? ""),
        );

        if (!result.success) {
          const payload = {
            success: false,
            version: APP_VERSION,
            code: result.code,
            message: result.message,
          };

          if (session) {
            sendProtectedJson(res, 400, payload);
          } else {
            sendJson(res, 400, payload);
          }
          return;
        }

        const responsePayload = {
          success: true,
          version: APP_VERSION,
          authenticated: true,
          requiresPasswordChange: false,
          passwordConfigured: true,
          sessionExpiresAt: result.session.expiresAt,
          passwordUpdatedAt: result.passwordUpdatedAt,
          encryptionKey: result.session.encryptionKey,
        };

        const headers = {
          "Set-Cookie": getSessionCookie(result.session.token),
        };

        if (session) {
          sendProtectedJson(res, 200, responsePayload, headers);
        } else {
          sendPasswordProtectedJson(
            res,
            200,
            responsePayload,
            String(body.currentPassword ?? ""),
            headers,
          );
        }
      } catch (error) {
        sendJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_request",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/auth/logout") {
      revokeSessionToken(sessionToken);
      sendProtectedJson(
        res,
        200,
        {
          success: true,
          version: APP_VERSION,
        },
        {
          "Set-Cookie": getClearSessionCookie(),
        },
      );
      return;
    }

    if (method === "GET" && pathname === "/api/devices") {
      try {
        const { adbPath, devices } = await listDevices();

        sendProtectedJson(res, 200, {
          success: true,
          version: APP_VERSION,
          adbPath,
          total: devices.length,
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

    if (method === "POST" && pathname === "/api/devices/pair-code") {
      try {
        const body = await readProtectedJsonBody(req, res);
        const host = String(body.host ?? "").trim();
        const port = Number(body.port);
        const pairingCode = String(body.pairingCode ?? "").trim();

        if (!host || !Number.isInteger(port) || port <= 0 || port > 65535 || !pairingCode) {
          sendProtectedJson(res, 400, {
            success: false,
            version: APP_VERSION,
            error: "invalid_pair_payload",
            message: "host / port / pairingCode are required.",
          });
          return;
        }

        const pairResult = await pairDeviceWithCode(host, port, pairingCode);
        const connectResult = pairResult.success ? await connectDeviceByHost(host, port) : null;

        sendProtectedJson(res, pairResult.success ? 200 : 400, {
          success: pairResult.success,
          version: APP_VERSION,
          pair: pairResult,
          connect: connectResult,
        });
      } catch (error) {
        sendProtectedJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "pair_code_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/devices/qr-session") {
      try {
        const session = await createQrPairingSession();
        sendProtectedJson(res, 200, {
          success: true,
          version: APP_VERSION,
          ...session,
        });
      } catch (error) {
        sendProtectedJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "qr_session_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/devices/pair-qr") {
      try {
        const body = await readProtectedJsonBody(req, res);
        const serviceName = String(body.serviceName ?? "").trim();
        const pairingCode = String(body.pairingCode ?? "").trim();

        if (!serviceName || !pairingCode) {
          sendProtectedJson(res, 400, {
            success: false,
            version: APP_VERSION,
            error: "invalid_qr_pair_payload",
            message: "serviceName / pairingCode are required.",
          });
          return;
        }

        const result = await pairDeviceByQrService(serviceName, pairingCode);

        sendProtectedJson(res, result.success ? 200 : 400, {
          success: result.success,
          version: APP_VERSION,
          pair: result.pair,
          connect: result.connect,
          discovery: result.discovery,
        });
      } catch (error) {
        sendProtectedJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "pair_qr_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
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
        const screenshot = await captureDeviceScreenshot(serial);
        sendProtectedBuffer(res, 200, screenshot, "image/png");
      } catch (error) {
        sendProtectedJson(res, 500, {
          success: false,
          version: APP_VERSION,
          error: "screenshot_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
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
