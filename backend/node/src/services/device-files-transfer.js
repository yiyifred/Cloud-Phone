import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";
import { safeUnlink } from "./device-apps-mutate.js";
import { resolveDevicePath, shellQuote } from "./device-file-path.js";

/**
 * @returns {"file" | "directory" | "missing"}
 */
export async function getDevicePathKind(serial, devicePath) {
  const quoted = shellQuote(devicePath);
  const script = `if [ -f ${quoted} ]; then echo file; elif [ -d ${quoted} ]; then echo directory; else echo missing; fi`;
  const { stdout } = await runAdb(["-s", serial, "shell", script], { timeout: 20_000 });
  const kind = stdout.trim().split(/\r?\n/).pop()?.trim();

  if (kind === "file" || kind === "directory" || kind === "missing") {
    return kind;
  }

  return "missing";
}

/**
 * Upload body budget for the streaming path.
 *
 * Kept next to the transfer code (not in utils/http.js) because that module's
 * route pattern decides the *pre-flight* Content-Length rejection; this limit
 * guards the byte counter while the body is being streamed to disk.
 */
export const DEFAULT_FILE_UPLOAD_MAX_BYTES = 256 * 1024 * 1024;

export function resolveFileUploadMaxBytes() {
  const configured = Number(process.env.UPLOAD_MAX_BYTES);

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_FILE_UPLOAD_MAX_BYTES;
}

/** Temp dirs must not survive the request; a failed rm is reported, never hidden. */
async function removeTempDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    console.warn("[files] 临时目录清理失败：", dirPath, error?.message ?? error);
  }
}

/**
 * Reserve a temp file for a streaming upload.
 *
 * @returns {Promise<{ localPath: string, cleanup: () => Promise<void> }>}
 */
export async function createUploadTempFile() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloud-phone-upload-"));

  return {
    localPath: path.join(tmpDir, "blob"),
    cleanup: () => removeTempDir(tmpDir),
  };
}

/**
 * Pull a device file to a temp file and hand the caller its path.
 *
 * The bytes never enter the Node heap: the route pipes `localPath` to the
 * response and calls `cleanup()` on both the success and the failure path.
 * `size` comes from the pulled file itself so `Content-Length` cannot disagree
 * with what will be streamed.
 *
 * @param {string} serial
 * @param {string} devicePath absolute file path on device
 * @returns {Promise<{ localPath: string, filename: string, devicePath: string, size: number, cleanup: () => Promise<void> }>}
 */
export async function pullDeviceFile(serial, devicePath) {
  const remotePath = resolveDevicePath(devicePath);
  const kind = await getDevicePathKind(serial, remotePath);

  if (kind === "directory") {
    const err = new Error("无法下载目录，请选择文件。");
    err.code = "is_directory";
    throw err;
  }

  if (kind === "missing") {
    const err = new Error("文件不存在。");
    err.code = "not_found";
    throw err;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloud-phone-pull-"));
  const localPath = path.join(tmpDir, "blob");

  try {
    await runWithAdbLock(
      () => runAdb(["-s", serial, "pull", remotePath, localPath], { timeout: 600_000 }),
      { lockKey: serial },
    );

    const stat = await fs.stat(localPath);
    const filename = path.posix.basename(remotePath) || "download";

    return {
      localPath,
      filename,
      devicePath: remotePath,
      size: stat.size,
      cleanup: () => removeTempDir(tmpDir),
    };
  } catch (error) {
    // Nothing streams after a failed pull, so the temp dir is ours to drop now.
    await removeTempDir(tmpDir);
    throw error;
  }
}

/**
 * @param {string} serial
 * @param {string} devicePath absolute destination path on device
 * @param {string} localPath temp file on host
 */
export async function pushDeviceFile(serial, devicePath, localPath) {
  const remotePath = resolveDevicePath(devicePath);
  const parent = path.posix.dirname(remotePath);

  if (parent && parent !== "/") {
    const parentKind = await getDevicePathKind(serial, parent);

    if (parentKind === "missing") {
      const err = new Error("目标目录不存在。");
      err.code = "parent_missing";
      throw err;
    }

    if (parentKind === "file") {
      const err = new Error("目标路径无效。");
      err.code = "parent_not_dir";
      throw err;
    }
  }

  return runWithAdbLock(async () => {
    await runAdb(["-s", serial, "push", localPath, remotePath], { timeout: 600_000 });

    return { devicePath: remotePath };
  }, { lockKey: serial });
}

export function buildDownloadHeaders(filename) {
  const base = path.posix.basename(String(filename || "download"));
  const ascii = base.replace(/[^\x20-\x7E]+/g, "_") || "download";

  return {
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(base)}`,
  };
}
