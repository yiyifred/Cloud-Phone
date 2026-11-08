import http from "node:http";

import { APP_VERSION } from "./config/version.js";
import { captureDeviceScreenshot } from "./services/device-screenshot.js";
import { resolveDevicePlatform } from "./services/device-platform-registry.js";
import { captureHarmonyScreenshot } from "./services/harmony-device.js";
import { captureIosScreenshot } from "./services/ios/ios-device.js";
import { listAllDevices } from "./services/device-list-service.js";
import { handleAuthRoute } from "./routes/auth-routes.js";
import { handleShareRoute } from "./routes/share-routes.js";
import { handleDeviceCastRoute } from "./routes/device-cast-routes.js";
import { handleDeviceControlRoute } from "./routes/device-control-routes.js";
import { handleDeviceConnectRoute } from "./routes/device-connect-routes.js";
import { handleDeviceRoute } from "./routes/device-routes.js";
import { handleHostRoute } from "./routes/host-routes.js";
import { handleIosDeviceRoute } from "./routes/ios-device-routes.js";
import { handleIosWdaPipelineRoute } from "./routes/ios-wda-pipeline-routes.js";
import { handleLocalPersistenceRoute } from "./routes/local-persistence-routes.js";
import { handleScrcpyRoute } from "./routes/scrcpy-routes.js";
import { SHARE_COOKIE_NAME } from "./config/auth.js";
import {
  getSessionTokenFromCookies,
  isPublicApiPath,
  requireApiSession,
} from "./middleware/api-auth.js";
import { serveMetricsIfAuthorized, trackHttpRequest } from "./metrics/http.js";
import { resolveShareToken } from "./services/share-tokens.js";
import { isSecureRequest } from "./utils/request-https.js";
import { parseCookies } from "./utils/cookies.js";
import { applyCors, rejectOversizedRequest, sendEmpty } from "./utils/http.js";
import {
  attachResponseEncryption,
  getLoginWireKey,
  sendLoginWireProtectedJson,
  sendProtectedBuffer,
  sendProtectedJson,
} from "./utils/protected-http.js";

/**
 * viewer（只读分享）能碰的接口：只放行读，且排除分享管理与认证管理，
 * 否则「看一眼画面」的凭据就能给自己续期或改密码。
 */
/** 分享 cookie 与管理员会话 cookie 同源同 Path，但作用域只有读：见 isViewerAllowed。 */
function buildShareCookie(token, maxAgeSeconds, secure) {
  const parts = [
    `${SHARE_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, maxAgeSeconds)}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/**
 * viewer 唯一允许的写操作是「开启/停止自己的投屏观看」：
 * 不 start 就没有画面可看，不 stop 会话无处释放；两者都不改设备状态（不注入输入）。
 */
const VIEWER_ALLOWED_WRITE = [
  { method: "POST", pattern: /^\/api\/devices\/[^/]+\/cast\/start$/ },
  { method: "DELETE", pattern: /^\/api\/devices\/[^/]+\/cast\/stop$/ },
];

function isViewerAllowed(pathname, method) {
  if (pathname.startsWith("/api/share") || pathname.startsWith("/api/auth")) {
    return false;
  }

  if (method === "GET" || method === "HEAD") {
    return true;
  }

  return VIEWER_ALLOWED_WRITE.some(
    (rule) => rule.method === method && rule.pattern.test(pathname),
  );
}

function sendUnauthorized(res) {
  sendLoginWireProtectedJson(res, 401, {
    success: false,
    version: APP_VERSION,
    error: "unauthorized",
    message: "Valid session required. Sign in first.",
  });
}

/**
 * 请求处理函数单独导出：HTTP 与 HTTPS（BACKEND_TLS=1）共用同一套逻辑，
 * 避免为 TLS 复制整份路由分发。
 */
export function createRequestHandler() {
  return async (req, res) => {
    const { method, url } = req;
    trackHttpRequest(req, res);
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

    // /metrics 自带访问控制（默认仅回环；远端需 Bearer METRICS_TOKEN）。不满足时返回 false
    // 交给末尾的通用 404，避免用响应差异暴露这个端点存在。
    if (method === "GET" && pathname === "/metrics" && serveMetricsIfAuthorized(req, res)) {
      return;
    }

    let accessRole = "admin";
    // 审计用身份：管理员会话与分享访客要能区分开，日志的 actor 列由服务端判定，
    // 不接受客户端自报（否则日志里的"谁干的"可以被伪造）。
    let accessActor = "admin";

    if (pathname.startsWith("/api/") && !isPublicApiPath(pathname, method)) {
      const session = await requireApiSession(sessionToken);

      if (session) {
        attachResponseEncryption(res, session.encryptionKey);
      } else {
        // 没有管理员会话时再试只读分享令牌：viewer 只能读，写一律 403
        const share = resolveShareToken(cookies[SHARE_COOKIE_NAME]);

        if (!share) {
          sendUnauthorized(res);
          return;
        }

        if (!isViewerAllowed(pathname, method)) {
          sendProtectedJson(res, 403, {
            success: false,
            version: APP_VERSION,
            error: "viewer_forbidden",
            message: "当前是只读分享访问，无法执行该操作。",
            role: "viewer",
          });
          return;
        }

        // viewer 也要能解/发加密信封：没有会话密钥时统一用 login-wire key。
        // 这只是混淆（常量公开），真正的机密性靠 TLS 与只读授权。
        attachResponseEncryption(res, getLoginWireKey());
        accessRole = "viewer";
        accessActor = share.label ? `viewer:${share.label}` : "viewer";
      }
    }

    // 分享链接落地页：把 ?token= 换成 HttpOnly cookie 再跳回控制台。
    // 放在鉴权闸门之前，因为分享链接本身就是凭据；也放在 /api/public 之外，
    // 避免被 isPublicApiPath 的语义混淆。
    if (method === "GET" && pathname === "/api/share/redeem") {
      const token = requestUrl.searchParams.get("token") ?? "";
      const share = resolveShareToken(token);

      if (!share) {
        res.writeHead(302, { Location: "/?share=invalid" });
        res.end();
        return;
      }

      const maxAge = Math.max(0, Math.floor((share.expiresAt - Date.now()) / 1000));
      res.writeHead(302, {
        Location: "/?share=1",
        "Set-Cookie": buildShareCookie(token, maxAge, isSecureRequest(req)),
      });
      res.end();
      return;
    }

    if (method === "GET" && pathname === "/api/access") {
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        role: accessRole,
        readOnly: accessRole === "viewer",
      });
      return;
    }

    if (await handleShareRoute(req, res, method, pathname)) {
      return;
    }

    if (handleHostRoute(req, res, method, pathname)) {
      return;
    }

    if (await handleAuthRoute(req, res, method, pathname, sessionToken)) {
      return;
    }

    if (await handleLocalPersistenceRoute(req, res, method, pathname, requestUrl, accessActor)) {
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
  };
}

export function createApp() {
  return http.createServer(createRequestHandler());
}
