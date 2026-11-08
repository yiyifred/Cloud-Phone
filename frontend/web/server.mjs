import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyProjectEnv } from "../../tools/env-loader.js";
import { createSelfSignedTlsOptions } from "./tls-self-signed.mjs";
import { attachApiWebSocketProxy } from "./ws-proxy.mjs";

const currentDirPath = path.dirname(fileURLToPath(import.meta.url));
const distRootPath = path.resolve(currentDirPath, "dist");
const {
  host,
  frontendPort,
  backendOrigin,
  frontendHttps,
  frontendTlsSans,
} = applyProjectEnv();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// 统一出口的 CSP。放行项都对应真实用法，不列白名单会「静默降级」：
// 1) media-src 的 blob: 与 img-src 的 data:/blob: 是投屏、录音回放、设备截图、
//    二维码 data URI 的实际用法；script-src 的 'wasm-unsafe-eval' 留给需要实例化
//    wasm 的编解码/终端组件，去掉它会直接白屏或功能失效。
// 2) 字体已改系统栈（T-412，见 index.html + main.css --font-sans），不再有外链字体
//    请求，因此 style-src / font-src 都不再放行外网字体域；font-src 保留 data:
//    是因为图标与兜底字体仍可能内联。
// frame-ancestors 'none' 与 X-Frame-Options: DENY 双写，兼容老浏览器。
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

// 静态响应与代理响应共用同一份表，避免两处各写一遍后逐渐漂移
const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// HSTS 只在真的走 https 时下发：http 端口下发 HSTS 会把用户浏览器锁到不存在的 https 上
if (frontendHttps) {
  securityHeaders["Strict-Transport-Security"] = "max-age=31536000";
}

if (!fs.existsSync(distRootPath)) {
  console.error("Missing frontend build output. Run: cd frontend/web && npm run build");
  process.exit(1);
}

const requestListener = async (req, res) => {
  const requestScheme = frontendHttps ? "https" : "http";
  const requestUrl = new URL(req.url ?? "/", `${requestScheme}://127.0.0.1:${frontendPort}`);
  const { pathname } = requestUrl;

  if (pathname.startsWith("/api/")) {
    await proxyToBackend(req, res, requestUrl);
    return;
  }

  await serveStaticFile(pathname, res);
};

const tlsOptions = frontendHttps ? await createSelfSignedTlsOptions(frontendTlsSans) : null;
const server = tlsOptions
  ? https.createServer(tlsOptions, requestListener)
  : http.createServer(requestListener);

server.listen(frontendPort, host, () => {
  const scheme = frontendHttps ? "https" : "http";
  console.log(`Cloud Phone frontend: ${scheme}://127.0.0.1:${frontendPort}`);
  console.log("Serving build from dist/");

  if (frontendHttps) {
    console.log("Self-signed TLS enabled (accept browser warning on first visit).");
    if (frontendTlsSans.length > 0) {
      console.log(`TLS SAN: ${frontendTlsSans.join(", ")}`);
    }
  }

  console.log(`API proxy /api/* -> ${backendOrigin}`);
  console.log("WebSocket proxy /api/* -> backend enabled");
});

attachApiWebSocketProxy(server, {
  backendOrigin,
  frontendPort,
  frontendHttps,
});

async function serveStaticFile(pathname, res) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;

  try {
    const normalizedPath = path.resolve(distRootPath, `.${requestPath}`);

    // 用 path.relative 判断归属：startsWith 会把 dist-backup 这类兄弟目录也算成
    // dist 内部路径，等于给目录穿越开口子
    if (!isInsideDist(normalizedPath)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    let filePath = normalizedPath;

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distRootPath, "index.html");
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(
      200,
      mergeWithSecurityHeaders({
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
      }),
    );
    res.end(fs.readFileSync(filePath));
  } catch {
    sendText(res, 500, "Internal Server Error");
  }
}

function isInsideDist(candidatePath) {
  const relativePath = path.relative(distRootPath, candidatePath);

  if (!relativePath) {
    // 请求恰好等于 dist 根目录本身，不是可服务的文件
    return false;
  }

  if (relativePath === ".." || path.isAbsolute(relativePath)) {
    return false;
  }

  return !relativePath.startsWith(`..${path.sep}`);
}

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

/**
 * 后端自己也上 TLS（BACKEND_TLS=1）时，反代必须改用 https 客户端。
 * 环回地址默认接受自签证书（这本机链路），远端后端仍强制校验，
 * 真要放开需显式 BACKEND_TLS_INSECURE=1。
 */
export function buildBackendClientOptions(backendUrl) {
  if (backendUrl.protocol !== "https:") {
    return {};
  }

  const insecure = process.env.BACKEND_TLS_INSECURE === "1" || isLoopbackHost(backendUrl.hostname);
  return { rejectUnauthorized: !insecure };
}

async function proxyToBackend(clientReq, clientRes, requestUrl) {
  const backendUrl = new URL(backendOrigin);
  const backendClient = backendUrl.protocol === "https:" ? https : http;
  const headers = { ...clientReq.headers, host: backendUrl.host };

  // 反代补头：后端据此判断「前端是否 HTTPS」，决定给 Cookie 加 Secure
  headers["x-forwarded-proto"] = frontendHttps ? "https" : "http";

  const clientAddress = resolveClientAddress(clientReq);
  if (clientAddress) {
    headers["x-forwarded-for"] = clientAddress;
  }

  const proxyReq = backendClient.request(
    `${backendOrigin}${requestUrl.pathname}${requestUrl.search}`,
    {
      method: clientReq.method,
      headers,
      timeout: 0,
      ...buildBackendClientOptions(backendUrl),
    },
    (proxyRes) => {
      // 后端响应头先铺底，再由本服务的统一安全头覆盖，保证策略只有一份来源
      clientRes.writeHead(
        proxyRes.statusCode ?? 502,
        mergeWithSecurityHeaders(proxyRes.headers),
      );
      proxyRes.pipe(clientRes);
    },
  );

  proxyReq.on("error", () => {
    sendText(clientRes, 502, `Backend unavailable at ${backendOrigin}`);
  });

  clientReq.pipe(proxyReq);
}

// 前端是 TLS 终点，客户端自带的 X-Forwarded-For 不可信（可伪造身份绕过限流），
// 所以一律用 socket 对端地址覆盖；去掉 IPv4-mapped 前缀，与后端 getClientIp 对齐
function resolveClientAddress(clientReq) {
  const remoteAddress = String(clientReq.socket?.remoteAddress ?? "").trim();

  if (!remoteAddress) {
    return "";
  }

  return remoteAddress.startsWith("::ffff:") ? remoteAddress.slice(7) : remoteAddress;
}

// 代理响应常见同名但大小写不同的安全头，Node 会当成两个头一起下发，浏览器对
// 多条 CSP 取交集；这里统一按小写去重，确保最终只有本服务这一份策略
function mergeWithSecurityHeaders(sourceHeaders = {}) {
  const securityKeys = new Set(Object.keys(securityHeaders).map((key) => key.toLowerCase()));
  const merged = {};

  for (const [key, value] of Object.entries(sourceHeaders)) {
    if (!securityKeys.has(key.toLowerCase())) {
      merged[key] = value;
    }
  }

  return { ...merged, ...securityHeaders };
}

function sendText(res, statusCode, message) {
  res.writeHead(
    statusCode,
    mergeWithSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  );
  res.end(message);
}
