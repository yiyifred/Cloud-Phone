import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { APP_VERSION } from "../config/version.js";
import { resolveAppOrientation } from "../services/device-app-orientation.js";
import { getPackageDetail } from "../services/device-apps-detail.js";
import { listInstalledApps } from "../services/device-apps-list.js";
import {
  installLocalApk,
  pullApkToTemp,
  resolvePrimaryApkPath,
  safeUnlink,
  setPackageFrozen,
  uninstallPackage,
} from "../services/device-apps-mutate.js";
import { runWithAdbLock } from "../services/adb-lock.js";
import { denyWriteIfNotController } from "../services/control-guard.js";
import {
  readProtectedBinaryBody,
  readProtectedJsonBody,
  sendProtectedBuffer,
  sendProtectedJson,
} from "../utils/protected-http.js";

/**
 * service 层抛出的 4xx（目前是包名等入参校验，statusCode=400）必须映射为 HTTP 4xx，
 * 否则前端把「参数非法」当成服务端故障，会误报错误并掩盖真实问题。
 *
 * @param {unknown} error
 * @param {number} [fallback]
 */
function resolveErrorStatus(error, fallback = 500) {
  const status = Number(/** @type {any} */ (error)?.statusCode);
  return Number.isInteger(status) && status >= 400 && status < 500 ? status : fallback;
}

/**
 * 安装包临时文件名必须不可预测：写入 tmpdir 期间若名字可猜，同机进程可抢先放置/抢占同名文件。
 * 随机名 + 0600 同时消除「内容可被预先创建后读取」与「读到他人残留文件」两类问题。
 */
function createInstallTempPath() {
  return path.join(os.tmpdir(), `cloud-phone-install-${crypto.randomBytes(16).toString("hex")}.apk`);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} method
 * @param {string} pathname
 * @param {URL} url
 */
export async function handleDeviceAppsRoute(req, res, method, pathname, url) {
  const installMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps\/install$/);
  const listMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps$/);
  const apkMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps\/([^/]+)\/apk$/);
  const stateMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps\/([^/]+)\/state$/);
  const orientationMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps\/([^/]+)\/orientation$/);
  const detailMatch = pathname.match(/^\/api\/devices\/([^/]+)\/apps\/([^/]+)$/);

  if (method === "PUT" && installMatch) {
    const serial = decodeURIComponent(installMatch[1]);
    // 安装会改设备状态：strict 下非持有者 409；advisory 下不拦，行为与既有完全一致
    if (denyWriteIfNotController(req, res, serial, "app_install")) return true;
    const tmpPath = createInstallTempPath();

    try {
      const { buffer } = await readProtectedBinaryBody(req, res);

      if (!buffer.length) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "install_empty_body",
          message: "安装包内容为空。",
        });
        return true;
      }

      await fs.promises.writeFile(tmpPath, buffer, { mode: 0o600 });
      const result = await installLocalApk(serial, tmpPath);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        ...result,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "install_failed",
        message: error instanceof Error ? error.message : "安装失败",
      });
    } finally {
      await safeUnlink(tmpPath);
    }

    return true;
  }

  if (method === "GET" && listMatch) {
    const serial = decodeURIComponent(listMatch[1]);

    try {
      const apps = await listInstalledApps(serial);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        apps,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "device_apps_list_failed",
        message: error instanceof Error ? error.message : "读取应用列表失败",
      });
    }

    return true;
  }

  if (method === "GET" && apkMatch) {
    const serial = decodeURIComponent(apkMatch[1]);
    const packageName = decodeURIComponent(apkMatch[2]);
    let localPath = null;

    try {
      const buffer = await runWithAdbLock(async () => {
        const remote = await resolvePrimaryApkPath(serial, packageName);
        localPath = await pullApkToTemp(serial, remote);
        return fs.promises.readFile(localPath);
      }, { lockKey: serial });

      const filename = `${packageName.replace(/[^\w.-]+/g, "_")}.apk`;

      sendProtectedBuffer(res, 200, buffer, "application/vnd.android.package-archive", {
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "apk_pull_failed",
        message: error instanceof Error ? error.message : "导出 APK 失败",
      });
    } finally {
      if (localPath) {
        await safeUnlink(localPath);
      }
    }

    return true;
  }

  if (method === "POST" && stateMatch) {
    const serial = decodeURIComponent(stateMatch[1]);
    const packageName = decodeURIComponent(stateMatch[2]);

    // 冻结/解冻会改设备状态，与安装同属写类操作
    if (denyWriteIfNotController(req, res, serial, "app_freeze")) return true;

    try {
      const body = await readProtectedJsonBody(req, res);

      if (typeof body.frozen !== "boolean") {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_body",
          message: "请求体需包含布尔字段 frozen。",
        });
        return true;
      }

      const frozen = body.frozen;

      const result = await setPackageFrozen(serial, packageName, frozen);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        packageName,
        frozen,
        ...result,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "freeze_failed",
        message: error instanceof Error ? error.message : "操作失败",
      });
    }

    return true;
  }

  if (method === "GET" && orientationMatch) {
    const serial = decodeURIComponent(orientationMatch[1]);
    const packageName = decodeURIComponent(orientationMatch[2]);

    try {
      const orientation = await resolveAppOrientation(serial, packageName);
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        packageName,
        orientation,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "orientation_failed",
        message: error instanceof Error ? error.message : "读取应用方向失败",
      });
    }

    return true;
  }

  if (method === "GET" && detailMatch) {
    const serial = decodeURIComponent(detailMatch[1]);
    const packageName = decodeURIComponent(detailMatch[2]);

    try {
      const detail = await getPackageDetail(serial, packageName);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        detail,
      });
    } catch (error) {
      const code = error?.code === "package_not_found" ? 404 : resolveErrorStatus(error);

      sendProtectedJson(res, code, {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "package_detail_failed",
        message: error instanceof Error ? error.message : "读取应用详情失败",
      });
    }

    return true;
  }

  if (method === "DELETE" && detailMatch) {
    const serial = decodeURIComponent(detailMatch[1]);
    const packageName = decodeURIComponent(detailMatch[2]);
    const confirm = url.searchParams.get("confirm");

    if (confirm !== "1") {
      sendProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "confirm_required",
        message: "请在确认卸载后附带参数 confirm=1。",
      });
      return true;
    }

    // 先确认（客户端错误 400）再判控制权，避免把「忘了带 confirm」误报成 409
    if (denyWriteIfNotController(req, res, serial, "app_uninstall")) return true;

    try {
      const result = await uninstallPackage(serial, packageName);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        packageName,
        ...result,
      });
    } catch (error) {
      sendProtectedJson(res, resolveErrorStatus(error), {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "uninstall_failed",
        message: error instanceof Error ? error.message : "卸载失败",
      });
    }

    return true;
  }

  return false;
}
