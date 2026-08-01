import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";

/**
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<string>} primary apk path on device
 */
export async function resolvePrimaryApkPath(serial, packageName) {
  const { stdout } = await runAdb(["-s", serial, "shell", "pm", "path", packageName], {
    timeout: 20_000,
  });

  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const paths = lines
    .filter((l) => l.startsWith("package:"))
    .map((l) => l.slice("package:".length));

  const base = paths.find((p) => p.includes("base.apk"));

  if (base) {
    return base;
  }

  if (paths[0]) {
    return paths[0];
  }

  const err = new Error("无法解析应用 APK 路径。");
  err.code = "apk_path_missing";
  throw err;
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
export async function uninstallPackage(serial, packageName) {
  return runWithAdbLock(async () => {
    const { stdout, stderr } = await runAdb(["-s", serial, "uninstall", packageName], {
      timeout: 120_000,
    });
    const out = `${stdout}\n${stderr}`.trim();

    if (!/Success/i.test(out)) {
      const err = new Error(out || "卸载失败。");
      err.code = "uninstall_failed";
      throw err;
    }

    return { ok: true, message: out };
  }, { lockKey: serial });
}

/**
 * Force-stop a package process (am force-stop).
 * Prefer {@link import("./device-apps-stop.js").stopPackage} for multi-app close
 * (graceful exit first, then force-stop).
 *
 * @param {string} serial
 * @param {string} packageName
 */
export async function forceStopPackage(serial, packageName) {
  const pkg = String(packageName || "").trim();
  if (!pkg) {
    const err = new Error("包名无效。");
    err.code = "invalid_package";
    throw err;
  }

  return runWithAdbLock(async () => {
    const { stdout, stderr } = await runAdb(
      ["-s", serial, "shell", "am", "force-stop", pkg],
      { timeout: 20_000 },
    );
    const out = `${stdout}\n${stderr}`.trim();
    return { ok: true, message: out || "ok" };
  }, { lockKey: serial });
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @param {boolean} freeze true = disable-user, false = enable
 */
export async function setPackageFrozen(serial, packageName, freeze) {
  return runWithAdbLock(async () => {
    const args = freeze
      ? ["-s", serial, "shell", "pm", "disable-user", "--user", "0", packageName]
      : ["-s", serial, "shell", "pm", "enable", packageName];

    const { stdout, stderr } = await runAdb(args, { timeout: 60_000 });
    const out = `${stdout}\n${stderr}`.trim();

    return { ok: true, message: out || "ok" };
  }, { lockKey: serial });
}

/**
 * Pull remote apk to local temp file.
 * @param {string} serial
 * @param {string} remoteApkPath
 * @returns {Promise<string>} local file path
 */
export async function pullApkToTemp(serial, remoteApkPath) {
  const safeName = `apk-${Date.now()}-${Math.random().toString(16).slice(2)}.apk`;
  const localPath = path.join(os.tmpdir(), safeName);

  await runAdb(["-s", serial, "pull", remoteApkPath, localPath], { timeout: 300_000 });

  return localPath;
}

/**
 * @param {string} serial
 * @param {string} localApkPath
 */
export async function installLocalApk(serial, localApkPath) {
  return runWithAdbLock(async () => {
    const { stdout, stderr } = await runAdb(
      ["-s", serial, "install", "-r", "-t", localApkPath],
      { timeout: 300_000 },
    );

    const out = `${stdout}\n${stderr}`.trim();

    if (!/Success/i.test(out)) {
      const err = new Error(out || "安装失败。");
      err.code = "install_failed";
      throw err;
    }

    return { ok: true, message: out };
  }, { lockKey: serial });
}

/**
 * @param {string} filePath
 */
export async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}
