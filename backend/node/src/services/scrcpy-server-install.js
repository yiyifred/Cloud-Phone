import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  getScrcpyPlatformKey,
  getScrcpyServerDiagnostics,
  isScrcpyServerReady,
  resolveScrcpyServerJarPath,
} from "../config/scrcpy-paths.js";
import { downloadBuffer } from "../utils/http-download.js";

const MAX_JAR_BYTES = 32 * 1024 * 1024;
const MIN_JAR_BYTES = 200 * 1024;
const REPO_RELEASE_TAG = "v1.29.0";
const RELEASE_ASSET = "scrcpy-server-android-5.0.1.jar";

const DOWNLOAD_SOURCES = {
  github: {
    label: "GitHub 直连",
    url: `https://github.com/yiyifred/Cloud-Phone/releases/download/${REPO_RELEASE_TAG}/${RELEASE_ASSET}`,
  },
  ghproxy: {
    label: "gh-proxy.com 加速",
    url: `https://gh-proxy.com/https://github.com/yiyifred/Cloud-Phone/releases/download/${REPO_RELEASE_TAG}/${RELEASE_ASSET}`,
  },
};

export class ScrcpyServerMissingError extends Error {
  constructor() {
    super("scrcpy-server 未安装");
    this.code = "scrcpy_server_missing";
    this.statusCode = 409;
    this.diagnostics = getScrcpyServerDiagnostics();
    this.install = describeInstallTargets();
  }
}

export function listDownloadSources() {
  return Object.entries(DOWNLOAD_SOURCES).map(([id, item]) => ({ id, label: item.label, url: item.url }));
}

/** Where a manual/upload/download install lands, and which copies already exist. */
export function describeInstallTargets() {
  const platformKey = getScrcpyPlatformKey();
  const diagnostics = getScrcpyServerDiagnostics();

  return {
    expectedPath: diagnostics.expectedPath,
    platform: platformKey,
    candidates: diagnostics.candidatesChecked,
    envOverride: process.env.CLOUD_PHONE_SCRCPY_SERVER_JAR ?? null,
  };
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertJar(buffer) {
  if (!buffer || buffer.length < MIN_JAR_BYTES) {
    throw Object.assign(new Error(`文件太小，不是 scrcpy-server：${buffer?.length ?? 0} 字节`), {
      code: "invalid_scrcpy_server",
      statusCode: 400,
    });
  }

  if (buffer.length > MAX_JAR_BYTES) {
    throw Object.assign(new Error("文件超过 32 MB 上限"), { code: "invalid_scrcpy_server", statusCode: 400 });
  }

  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw Object.assign(new Error("不是 APK/JAR 文件（缺少 ZIP 头 PK）"), {
      code: "invalid_scrcpy_server",
      statusCode: 400,
    });
  }

  if (!buffer.includes(Buffer.from("AndroidManifest.xml")) || !buffer.includes(Buffer.from("classes.dex"))) {
    throw Object.assign(new Error("不是 Android 端 scrcpy-server（缺少 AndroidManifest.xml 或 classes.dex）"), {
      code: "invalid_scrcpy_server",
      statusCode: 400,
    });
  }
}

function writeAtomic(targetPath, buffer) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, buffer, { mode: 0o644 });
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Install a validated scrcpy-server jar. Writes the resolved target and refreshes
 * sibling platform copies that already exist, since the jar is platform-independent.
 */
export function installServerJar(buffer, { source = "manual" } = {}) {
  assertJar(buffer);

  const diagnostics = getScrcpyServerDiagnostics();
  const target = diagnostics.expectedPath;
  writeAtomic(target, buffer);

  const touched = [target];
  const platformRoot = path.dirname(target);

  for (const key of ["linux", "macos", "windows"]) {
    const sibling = path.join(platformRoot, "..", key, "scrcpy-server");

    if (path.resolve(sibling) === path.resolve(target)) {
      continue;
    }

    if (fs.existsSync(sibling)) {
      writeAtomic(sibling, buffer);
      touched.push(path.resolve(sibling));
    }
  }

  return {
    path: target,
    size: buffer.length,
    sha256: sha256(buffer),
    source,
    updated: touched,
  };
}

export async function downloadAndInstallServer(sourceId) {
  const source = DOWNLOAD_SOURCES[sourceId];

  if (!source) {
    throw Object.assign(new Error(`未知下载源：${sourceId}`), {
      code: "invalid_download_source",
      statusCode: 400,
    });
  }

  const { buffer, url } = await downloadBuffer(source.url, { maxBytes: MAX_JAR_BYTES });
  const installed = installServerJar(buffer, { source: `download:${sourceId}` });

  return { ...installed, url };
}

export function getServerStatus() {
  const ready = isScrcpyServerReady();
  const jarPath = ready ? resolveScrcpyServerJarPath() : null;
  let stat = null;

  if (jarPath) {
    try {
      stat = fs.statSync(jarPath);
    } catch {
      stat = null;
    }
  }

  return {
    ready,
    path: jarPath,
    size: stat?.size ?? null,
    modifiedAt: stat?.mtime?.toISOString?.() ?? null,
    targets: describeInstallTargets(),
    sources: listDownloadSources(),
    accepts: { upload: "POST /api/scrcpy/server/upload (application/octet-stream)", maxUploadBytes: MAX_JAR_BYTES },
  };
}

export const SCRCPY_SERVER_LIMITS = { minBytes: MIN_JAR_BYTES, maxBytes: MAX_JAR_BYTES };
