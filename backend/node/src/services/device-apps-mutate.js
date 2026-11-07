import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";

/** Android 包名字符集：字母、数字、下划线，至少一段点号分隔。 */
const PACKAGE_NAME_PATTERN = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/;
const MAX_PACKAGE_NAME_LENGTH = 255;

/**
 * 校验包名后再拼进 adb shell 参数。
 *
 * 为什么直接白名单而不是 shellQuote：`adb shell` 会把后续参数重新拼成一个 shell 命令串，
 * 引号转义在不同 adb 版本的拼接方式下并不稳定（`;`、`$(...)`、反引号都可能逃逸）。
 * 包名本身有严格格式，白名单拒绝一切特殊字符，比事后转义可靠。
 *
 * @param {string} packageName
 * @returns {string} 规范化后的包名
 */
function requireValidPackageName(packageName) {
  const pkg = String(packageName ?? "").trim();
  const invalid =
    !pkg || pkg.length > MAX_PACKAGE_NAME_LENGTH || !PACKAGE_NAME_PATTERN.test(pkg);

  if (invalid) {
    const err = new Error("包名格式非法。");
    err.code = "invalid_package";
    err.statusCode = 400;
    throw err;
  }

  return pkg;
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<string>} primary apk path on device
 */
export async function resolvePrimaryApkPath(serial, packageName) {
  const pkg = requireValidPackageName(packageName);
  const { stdout } = await runAdb(["-s", serial, "shell", "pm", "path", pkg], {
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
  const pkg = requireValidPackageName(packageName);

  return runWithAdbLock(async () => {
    const { stdout, stderr } = await runAdb(["-s", serial, "uninstall", pkg], {
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
  // 包名白名单校验（原先只判空，`;` / `$()` 等可直接进入 adb shell）。
  const pkg = requireValidPackageName(packageName);

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
  const pkg = requireValidPackageName(packageName);

  return runWithAdbLock(async () => {
    const args = freeze
      ? ["-s", serial, "shell", "pm", "disable-user", "--user", "0", pkg]
      : ["-s", serial, "shell", "pm", "enable", pkg];

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
