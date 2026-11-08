import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BACKEND_DATA_PATH } from "../config/paths.js";

/**
 * 后端自身的 TLS。
 *
 * 为什么需要：Web 端有 https（server.mjs 自签），但后端 3000 端口一直是裸 http。
 * 浏览器页面走 https、接口走 http 时，Cookie 的 Secure 标不上；Android 客户端因为
 * 只有 http 也只能开 usesCleartextTraffic。把后端也上 TLS 之后，这两处才能真正收紧。
 *
 * 证书来源优先级：
 * 1. BACKEND_TLS_CERT + BACKEND_TLS_KEY（用户提供的 PEM，适配合规证书或已有 CA）；
 * 2. 自动生成自签证书并落盘复用（换 SAN 或剩余 < 7 天才重签，避免每次启动换指纹）。
 */

const TLS_DIR_PATH = path.resolve(process.env.BACKEND_TLS_DIR || path.join(BACKEND_DATA_PATH, ".tls"));
const KEY_FILE_PATH = path.join(TLS_DIR_PATH, "backend-key.pem");
const CERT_FILE_PATH = path.join(TLS_DIR_PATH, "backend-cert.pem");
const META_FILE_PATH = path.join(TLS_DIR_PATH, "cert-meta.json");
const MIN_REMAINING_MS = 7 * 24 * 60 * 60 * 1000;
const VALIDITY_DAYS = 825;

/** @returns {import("node:https").ServerOptions | null} */
export function loadBackendTlsOptions() {
  const certPath = process.env.BACKEND_TLS_CERT?.trim();
  const keyPath = process.env.BACKEND_TLS_KEY?.trim();

  if (certPath && keyPath) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  if (certPath || keyPath) {
    throw new Error("BACKEND_TLS_CERT 与 BACKEND_TLS_KEY 必须同时设置。");
  }

  return createSelfSignedTlsOptions(readExtraSans());
}

/** @param {string[]} extraSans */
function createSelfSignedTlsOptions(extraSans) {
  const sanList = buildSanList(extraSans);
  const fingerprint = crypto.createHash("sha256").update(sanList.join(",")).digest("hex");

  const cached = readCachedCertificate(fingerprint);

  if (cached) {
    return cached;
  }

  fs.mkdirSync(TLS_DIR_PATH, { recursive: true, mode: 0o700 });

  // openssl 是部署机最常见的依赖；没有它时给出可操作的错误，而不是静默退回 http。
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-keyout",
        KEY_FILE_PATH,
        "-out",
        CERT_FILE_PATH,
        "-days",
        String(VALIDITY_DAYS),
        "-subj",
        "/CN=Cloud Phone Backend",
        "-addext",
        `subjectAltName=${sanList.join(",")}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `后端 TLS 证书生成失败（需要 openssl）：${detail}。` +
        "也可以直接提供 BACKEND_TLS_CERT / BACKEND_TLS_KEY。",
    );
  }

  fs.chmodSync(KEY_FILE_PATH, 0o600);
  fs.chmodSync(CERT_FILE_PATH, 0o600);
  fs.writeFileSync(
    META_FILE_PATH,
    JSON.stringify({ fingerprint, sans: sanList, createdAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 },
  );

  return { key: fs.readFileSync(KEY_FILE_PATH), cert: fs.readFileSync(CERT_FILE_PATH) };
}

function readCachedCertificate(fingerprint) {
  if (!fs.existsSync(KEY_FILE_PATH) || !fs.existsSync(CERT_FILE_PATH) || !fs.existsSync(META_FILE_PATH)) {
    return null;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE_PATH, "utf8"));

    if (meta?.fingerprint !== fingerprint) {
      return null;
    }

    const cert = new crypto.X509Certificate(fs.readFileSync(CERT_FILE_PATH));

    if (new Date(cert.validTo).getTime() - Date.now() < MIN_REMAINING_MS) {
      return null;
    }

    return { key: fs.readFileSync(KEY_FILE_PATH), cert: fs.readFileSync(CERT_FILE_PATH) };
  } catch {
    // 证书损坏就当没有缓存，重新签一张。
    return null;
  }
}

function readExtraSans() {
  return String(process.env.BACKEND_TLS_SANS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** @param {string[]} extraSans */
function buildSanList(extraSans) {
  const entries = new Set(["DNS:localhost", "IP:127.0.0.1", "IP:::1"]);

  for (const raw of extraSans) {
    const value = raw.trim();

    if (!value) {
      continue;
    }

    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(":");

    entries.add(isIp ? `IP:${value}` : `DNS:${value}`);
  }

  return [...entries].sort();
}

/** 供启动日志使用：证书指纹便于用户核对信任的是哪一张。 */
export function describeTlsCertificate(options) {
  try {
    const cert = new crypto.X509Certificate(options.cert);
    const hash = crypto.createHash("sha256").update(cert.raw).digest("hex").slice(0, 16);
    return { subject: cert.subject, validTo: cert.validTo, fingerprint: hash };
  } catch {
    return null;
  }
}
