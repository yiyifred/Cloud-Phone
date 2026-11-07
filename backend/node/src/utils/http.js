import { serverConfig } from "../config/env.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * Body budgets. Anything that is not an explicit upload path is JSON metadata
 * and has no business being large: an unauthenticated 1 GiB body used to be
 * buffered straight into the heap.
 */
const DEFAULT_JSON_BODY_BYTES = 1024 * 1024;
const DEFAULT_UPLOAD_BODY_BYTES = 256 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 1024 * 1024 * 1024;

/** PUT /api/devices/:serial/files and POST /api/devices/:serial/apps/install carry APK/file bytes. */
const UPLOAD_PATH_PATTERN = /^\/api\/devices\/[^/]+\/(files|apps\/install)$/;

export class BodyTooLargeError extends Error {
  constructor(limit) {
    super(`Request body exceeds ${limit} bytes.`);
    this.name = "BodyTooLargeError";
    this.code = "request_body_too_large";
    this.statusCode = 413;
  }
}

export function resolveBodyLimit(pathname) {
  const upload = Number(process.env.UPLOAD_MAX_BYTES);
  const json = Number(process.env.MAX_JSON_BODY_BYTES);

  if (UPLOAD_PATH_PATTERN.test(String(pathname ?? ""))) {
    if (Number.isFinite(upload) && upload > 0) {
      return Math.min(upload, MAX_UPLOAD_BODY_BYTES);
    }
    return DEFAULT_UPLOAD_BODY_BYTES;
  }

  return Number.isFinite(json) && json > 0 ? json : DEFAULT_JSON_BODY_BYTES;
}

/**
 * Fast rejection before a single byte is buffered: Content-Length is advisory,
 * but an honest oversized upload should not reach the reader at all.
 */
export function rejectOversizedRequest(req, res, pathname) {
  const declared = Number(req.headers["content-length"]);

  if (!Number.isFinite(declared) || declared <= 0) {
    return false;
  }

  const limit = resolveBodyLimit(pathname);

  if (declared <= limit) {
    return false;
  }

  sendJson(res, 413, {
    success: false,
    error: "request_body_too_large",
    message: `Request body exceeds ${limit} bytes.`,
  }, { Connection: "close" });
  // Drain instead of destroying: destroying the socket here races the response
  // write and the client sees ECONNRESET instead of the 413.
  req.resume();
  return true;
}

/** Resolve the server config lazily so tests can swap env after import. */
function corsOrigins() {
  const allowed = new Set([
    serverConfig.frontendOrigin,
    `http://localhost:${serverConfig.frontendPort}`,
    `http://127.0.0.1:${serverConfig.frontendPort}`,
    `http://[::1]:${serverConfig.frontendPort}`,
    `https://localhost:${serverConfig.frontendPort}`,
    `https://127.0.0.1:${serverConfig.frontendPort}`,
    `https://[::1]:${serverConfig.frontendPort}`,
    ...(serverConfig.corsAllowOrigins ?? []),
  ]);
  return allowed;
}

/** Synthetic origins (file://, sandboxed iframes, some native webviews) must be explicitly allowed. */
const NULL_ORIGINS = new Set(["null", "file://"]);

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...JSON_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

export function sendEmpty(res, statusCode, extraHeaders = {}) {
  res.writeHead(statusCode, extraHeaders);
  res.end();
}

export function sendBuffer(res, statusCode, buffer, contentType, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(buffer);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {{ maxBytes?: number }} [options]
 */
export async function readJsonBody(req, options = {}) {
  const limit = Number.isFinite(options.maxBytes) && options.maxBytes > 0
    ? options.maxBytes
    : resolveBodyLimit(req.url ?? "/");
  const declared = Number(req.headers["content-length"]);

  if (Number.isFinite(declared) && declared > limit) {
    req.destroy();
    throw new BodyTooLargeError(limit);
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > limit) {
      // Stop the producer instead of buffering the rest of an abusive body.
      req.destroy();
      throw new BodyTooLargeError(limit);
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(body);
}

export function applyCors(req, res) {
  const origin = req.headers.origin;

  if (!origin || !isAllowedOrigin(origin)) {
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Encrypted-Request");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Vary", "Origin");
}

/**
 * Explicit allow-list only. The old heuristic ("any host, as long as the port
 * matches FRONTEND_PORT") let every site on the LAN read authenticated APIs.
 */
export function isAllowedOrigin(origin) {
  const value = String(origin ?? "").trim();

  if (!value) {
    return false;
  }

  const configuredOrigins = serverConfig.corsAllowOrigins ?? [];

  if (configuredOrigins.includes("*")) {
    return true;
  }

  if (NULL_ORIGINS.has(value) && !configuredOrigins.includes(value)) {
    return false;
  }

  return corsOrigins().has(value);
}
