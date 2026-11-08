import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirPath = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT_PATH = path.resolve(currentDirPath, "..");

// Loopback by default: the API has no TLS of its own, so "0.0.0.0" meant every
// LAN host could read cookies off the wire. Set HOST=0.0.0.0 explicitly in .env
// when you really want LAN access (and terminate TLS in front of it).
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_BACKEND_PORT = 3000;
const DEFAULT_FRONTEND_PORT = 5173;

let cachedEnv = null;

export function applyProjectEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const fileEnv = readEnvFile(path.join(PROJECT_ROOT_PATH, ".env"));

  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  cachedEnv = getServerConfig();

  if (cachedEnv.backendPort === cachedEnv.frontendPort) {
    throw new Error("BACKEND_PORT and FRONTEND_PORT must be different.");
  }

  return cachedEnv;
}

export function getServerConfig() {
  const host = process.env.HOST || DEFAULT_HOST;
  const backendPort = parsePort(
    process.env.BACKEND_PORT ?? process.env.PORT,
    DEFAULT_BACKEND_PORT,
    "BACKEND_PORT",
  );
  const frontendPort = parsePort(
    process.env.FRONTEND_PORT,
    DEFAULT_FRONTEND_PORT,
    "FRONTEND_PORT",
  );

  const corsAllowOrigins = String(process.env.CORS_ALLOW_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // 后端自身是否上 TLS：默认关（保持既有 http 部署不变），BACKEND_TLS=1 开启。
  const backendTls = process.env.BACKEND_TLS === "1" || process.env.BACKEND_TLS === "true";
  const backendTlsSans = String(process.env.BACKEND_TLS_SANS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // 开了后端 TLS 时，反代默认也要走 https，否则前端 502。
  const backendOrigin =
    process.env.BACKEND_ORIGIN?.trim() ||
    `${backendTls ? "https" : "http"}://127.0.0.1:${backendPort}`;

  const frontendHttps = process.env.FRONTEND_HTTPS !== "0";
  const frontendScheme = frontendHttps ? "https" : "http";
  const frontendTlsSans = String(process.env.FRONTEND_TLS_SAN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    host,
    backendPort,
    frontendPort,
    backendOrigin,
    backendTls,
    backendTlsSans,
    frontendHttps,
    frontendTlsSans,
    frontendOrigin: `${frontendScheme}://127.0.0.1:${frontendPort}`,
    corsAllowOrigins,
  };
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const entries = {};

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());

    if (key) {
      entries[key] = value;
    }
  }

  return entries;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parsePort(rawValue, fallback, label) {
  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }

  return port;
}
