import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { APP_VERSION } from "../config/version.js";
import { DEVICE_FILES_DEFAULT_OPEN } from "../services/device-file-path.js";
import { listDeviceFiles } from "../services/device-files.js";
import {
  buildDownloadHeaders,
  pullDeviceFile,
  pushDeviceFile,
} from "../services/device-files-transfer.js";
import { safeUnlink } from "../services/device-apps-mutate.js";
import {
  readProtectedBinaryBody,
  readProtectedJsonBody,
  sendProtectedBuffer,
  sendProtectedJson,
} from "../utils/protected-http.js";

/**
 * @returns {Promise<boolean>}
 */
export async function handleDeviceFilesRoute(req, res, method, pathname, url) {
  const listMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files$/);
  const downloadMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files\/download$/);
  const uploadMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files\/upload$/);

  if (method === "POST" && downloadMatch) {
    const serial = decodeURIComponent(downloadMatch[1]);

    try {
      const body = await readProtectedJsonBody(req, res);
      const devicePath = typeof body.path === "string" ? body.path : "";

      if (!devicePath.trim()) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "path_required",
          message: "缺少 path（加密 POST body）。",
        });
        return true;
      }

      const { buffer, filename } = await pullDeviceFile(serial, devicePath);
      sendProtectedBuffer(res, 200, buffer, "application/octet-stream", buildDownloadHeaders(filename));
    } catch (error) {
      const code = error?.code;
      const status = code === "not_found" ? 404 : code === "is_directory" ? 400 : 500;
      sendProtectedJson(res, status, {
        success: false,
        version: APP_VERSION,
        error: code ?? "device_file_download_failed",
        message: error instanceof Error ? error.message : "下载失败",
      });
    }

    return true;
  }

  if (method === "PUT" && uploadMatch) {
    const serial = decodeURIComponent(uploadMatch[1]);
    const tmpPath = path.join(
      os.tmpdir(),
      `cloud-phone-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

    try {
      const { buffer, path: bodyPath } = await readProtectedBinaryBody(req, res);
      const devicePath = bodyPath?.trim() || "";

      if (!devicePath) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "path_required",
          message: "缺少 path（加密 body.path）。",
        });
        return true;
      }

      if (!buffer.length) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "upload_empty_body",
          message: "上传内容为空。",
        });
        return true;
      }

      await fs.promises.writeFile(tmpPath, buffer);
      const result = await pushDeviceFile(serial, devicePath, tmpPath);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        ...result,
        bytes: buffer.length,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "device_file_upload_failed",
        message: error instanceof Error ? error.message : "上传失败",
      });
    } finally {
      await safeUnlink(tmpPath);
    }

    return true;
  }

  if (method === "GET" && listMatch) {
    const serial = decodeURIComponent(listMatch[1]);
    const requestedPath = url.searchParams.get("path") ?? DEVICE_FILES_DEFAULT_OPEN;

    try {
      const listing = await listDeviceFiles(serial, requestedPath);
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        ...listing,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "device_files_failed",
        message: error instanceof Error ? error.message : "无法读取设备目录",
      });
    }

    return true;
  }

  return false;
}
