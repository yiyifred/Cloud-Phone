/**
 * HTTP 埋点与 /metrics 端点。
 *
 * 路由标签为什么要模板化：Prometheus 每条标签组合都是一个独立时间序列，
 * /api/devices/<序列号>/cast/start 这种路径如果原样入标签，几台设备就能把
 * 序列数打爆（还会把序列号带进监控系统）。这里按「资源白名单 + 参数折叠」
 * 归一成 /api/devices/:serial/cast/start，未知片段统一折叠成 :param，
 * registry 里还有 500 条/指标 的硬上限兜底。
 */

import { timingSafeEqual } from "node:crypto";

import { httpRequestDurationSeconds, httpRequestsTotal } from "./definitions.js";
import { renderMetrics } from "./registry.js";

const KNOWN_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/** 后端真实存在的资源名（来自 routes/*.js 的路径定义），只有这些词会原样出现在标签里。 */
const DEVICE_RESOURCES = new Set([
  "cast",
  "apps",
  "files",
  "screenshot",
  "control",
  "terminal",
  "icon-helper",
  "quick-settings",
  "notifications",
  "connect",
  "disconnect",
  "pair-code",
  "pair-qr",
  "qr-session",
]);

/** 资源后面的动作/子资源名；不在表里的片段（包名、文件路径）一律折叠。 */
const ACTION_WORDS = new Set([
  "start",
  "stop",
  "status",
  "ws",
  "control",
  "install",
  "download",
  "upload",
  "state",
  "running",
  "force-stop",
  "orientation",
  "apk",
  "ensure",
  "extract",
  "list",
  "login",
  "logout",
  "session",
  "change-password",
  "redeem",
  "diagnostics",
  "networks",
  "capabilities",
  "sessions",
  "preferences",
  "pipeline",
  "prepare",
  "discover",
]);

const API_PREFIXES = new Set([
  "auth",
  "devices",
  "share",
  "host",
  "logs",
  "public",
  "scrcpy",
  "local-persistence",
  // 两段式端点：/api/ping、/api/access 本身就是完整路径
  "ping",
  "access",
]);

function templateDeviceRest(rest) {
  if (rest.length === 0) {
    return "";
  }

  const [resource, ...tail] = rest;

  if (!DEVICE_RESOURCES.has(resource)) {
    return "/other";
  }

  if (tail.length === 0) {
    return `/${resource}`;
  }

  const folded = tail.map((segment) => (ACTION_WORDS.has(segment) ? segment : ":param"));
  return `/${resource}/${folded.join("/")}`;
}

/** 把请求路径归一成模板化路由，保证标签基数受控。 */
export function templateRoute(pathname) {
  if (pathname === "/" || pathname === "/index.html") {
    return "/";
  }

  if (pathname === "/metrics" || pathname === "/health") {
    return pathname;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "api") {
    // 后端不服务静态资源：非 /api 的请求要么是前端代理误打，要么是扫描器
    return "/other";
  }

  if (segments[1] === "devices") {
    if (segments.length === 2) {
      return "/api/devices";
    }

    return `/api/devices/:serial${templateDeviceRest(segments.slice(3))}`;
  }

  if (!API_PREFIXES.has(segments[1])) {
    return "/api/other";
  }

  if (segments.length === 2) {
    return `/api/${segments[1]}`;
  }

  const action = ACTION_WORDS.has(segments[2]) ? segments[2] : ":param";
  return `/api/${segments[1]}/${action}`;
}

function normalizeMethod(method) {
  const upper = String(method ?? "").toUpperCase();
  return KNOWN_METHODS.has(upper) ? upper : "OTHER";
}

/**
 * 请求入口埋点：只挂 finish/close 监听，不改任何响应逻辑。
 * close 在客户端提前断开时先于 finish 触发，所以要 de-dupe，避免一次请求记两条。
 */
export function trackHttpRequest(req, res) {
  const startedAt = process.hrtime.bigint();
  const pathname = String(req.url ?? "/").split("?")[0] || "/";
  let recorded = false;

  const record = () => {
    if (recorded) {
      return;
    }
    recorded = true;

    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    // 499 不是 HTTP 标准码，是 nginx 的「客户端提前断开」约定，便于和真实状态码区分
    const status = res.headersSent ? String(res.statusCode) : "499";
    const labels = { method: normalizeMethod(req.method), route: templateRoute(pathname), status };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, seconds);
  };

  res.once("finish", record);
  res.once("close", record);
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackRequest(req) {
  const address = String(req.socket?.remoteAddress ?? "");
  if (LOOPBACK_ADDRESSES.has(address)) {
    return true;
  }
  // 整个 127/8 都是回环；容器 / 反向代理有时给出 127.0.0.x
  const mapped = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return mapped.startsWith("127.");
}

/**
 * METRICS_TOKEN 在请求时才读：tools/env-loader.js 要等 config/env.js import 后才把
 * .env 灌进 process.env，模块加载期读会读到 undefined。
 */
function configuredMetricsToken() {
  return String(process.env.METRICS_TOKEN ?? "").trim();
}

function hasValidMetricsToken(req) {
  const expected = configuredMetricsToken();

  if (!expected) {
    return false;
  }

  const header = String(req.headers.authorization ?? "");
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return false;
  }

  const provided = header.slice(prefix.length).trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  // 长度不同直接失败；长度相同再走定长比较，避免按字节提前返回泄露前缀信息
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * 允许出指标就直接写响应并返回 true；否则返回 false，让调用方走正常的 404。
 *
 * 为什么拒绝时不自己写 404：本服务对未知路径的 404 是加密信封（sendProtectedJson），
 * 这里若回一段明文 404，攻击者就能用响应差异判断「/metrics 存在但没权限」。
 */
export function serveMetricsIfAuthorized(req, res) {
  // 一旦配了 METRICS_TOKEN 就一律校验（含本机）：否则「错误 token 也 200」只在回环成立，
  // 语义会随来源地址漂移，运维很难判断自己配的 token 到底生效没有。
  // 没配 token 时退回默认策略：只信回环，其它来源一律当作不存在。
  const authorized = configuredMetricsToken() ? hasValidMetricsToken(req) : isLoopbackRequest(req);

  if (!authorized) {
    return false;
  }

  const body = renderMetrics();

  res.writeHead(200, {
    // version=0.0.4 是 Prometheus 文本格式的协商版本，抓取端据此解析
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);

  return true;
}
