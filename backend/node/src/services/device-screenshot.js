import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { runWithAdbLock } from "./adb-lock.js";
import { resolveAdbPath } from "./adb-path.js";
import { runScreenshotTask } from "./device-screenshot-queue.js";

const execFileAsync = promisify(execFile);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function looksLikePng(buffer) {
  return Boolean(buffer) && buffer.length >= 8 && buffer.subarray(0, 4).equals(PNG_MAGIC);
}

function normalizeScreenshotError(error) {
  const stderr = String(error?.stderr ?? "");
  const message = String(error?.message ?? "");
  const detail = `${stderr}\n${message}`.trim();

  if (/device offline/i.test(detail)) {
    const err = new Error("Device is offline.");
    err.code = "device_offline";
    return err;
  }

  if (/error:\s*closed/i.test(detail)) {
    const err = new Error("ADB connection closed.");
    err.code = "adb_connection_closed";
    return err;
  }

  if (/not found/i.test(detail)) {
    const err = new Error("Device not found.");
    err.code = "device_not_found";
    return err;
  }

  const err = new Error(detail || "Screenshot capture failed.");
  err.code = "screenshot_failed";
  return err;
}

async function captureViaPull(adbPath, serial) {
  const remote = `/data/local/tmp/cloud-phone-shot-${Date.now()}.png`;
  const dir = await mkdtemp(path.join(tmpdir(), "cp-shot-"));
  const local = path.join(dir, "shot.png");

  try {
    await execFileAsync(adbPath, ["-s", serial, "shell", "screencap", "-p", remote], {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    await execFileAsync(adbPath, ["-s", serial, "pull", remote, local], {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const buffer = await readFile(local);
    return looksLikePng(buffer) ? buffer : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    await execFileAsync(adbPath, ["-s", serial, "shell", "rm", "-f", remote], {
      windowsHide: true,
      timeout: 5000,
    }).catch(() => {});
  }
}

export async function captureDeviceScreenshot(serial) {
  return runWithAdbLock(
    () => runScreenshotTask(() => captureDeviceScreenshotUnsafe(serial)),
    { lockKey: serial },
  );
}

async function captureDeviceScreenshotUnsafe(serial) {
  const adbPath = resolveAdbPath();

  try {
    const { stdout } = await execFileAsync(
      adbPath,
      ["-s", serial, "exec-out", "screencap", "-p"],
      {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "buffer",
      },
    );

    if (!stdout || stdout.length < 24) {
      const err = new Error("Screenshot payload is empty.");
      err.code = "screenshot_empty";
      throw err;
    }

    // exec-out 在部分设备/容器（Waydroid、带 CRLF 转换的 adbd）上会把 PNG 当文本处理，
    // 拿回来是以 "/vendor/..." 开头的路径字符串，前端 <img> 解码失败只能显示破图。
    // 不是合法 PNG 就走 shell + pull 的二进制安全路径。
    if (looksLikePng(stdout)) {
      return stdout;
    }

    const pulled = await captureViaPull(adbPath, serial);
    if (pulled) {
      return pulled;
    }

    const err = new Error("Screenshot payload is not a PNG.");
    err.code = "screenshot_not_png";
    throw err;
    return stdout;
  } catch (error) {
    if (error?.code === "screenshot_empty") {
      throw error;
    }

    throw normalizeScreenshotError(error);
  }
}
