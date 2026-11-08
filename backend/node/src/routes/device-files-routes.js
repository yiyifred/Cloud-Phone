import { APP_VERSION } from "../config/version.js";
import { denyWriteIfNotController } from "../services/control-guard.js";
import { DEVICE_FILES_DEFAULT_OPEN } from "../services/device-file-path.js";
import { listDeviceFiles } from "../services/device-files.js";
import {
  buildDownloadHeaders,
  createUploadTempFile,
  pullDeviceFile,
  pushDeviceFile,
  resolveFileUploadMaxBytes,
} from "../services/device-files-transfer.js";
import {
  pipeProtectedFileToResponse,
  readProtectedJsonBody,
  receiveProtectedUploadBody,
  sendProtectedJson,
} from "../utils/protected-http.js";

/** Client hung up mid-download; not a server defect, so do not page anyone. */
const PREMATURE_CLOSE_CODE = "ERR_STREAM_PREMATURE_CLOSE";

function downloadErrorStatus(code) {
  if (code === "not_found") {
    return 404;
  }

  if (code === "is_directory") {
    return 400;
  }

  return 500;
}

/**
 * Response headers are already on the wire for a streamed file, so a later
 * failure can only be logged and turned into a broken connection.
 */
function reportStreamFailure(res, error) {
  const code = error?.code;

  if (code === PREMATURE_CLOSE_CODE || res.destroyed) {
    console.warn("[files] 下载中断：客户端已断开。");
    return;
  }

  console.error("[files] 下载流写入失败：", error instanceof Error ? error.message : error);

  if (!res.writableEnded) {
    res.destroy(error instanceof Error ? error : undefined);
  }
}

/**
 * `path` moved to the query string because the response is now a raw byte
 * stream. The encrypted JSON body is still accepted so an older cached client
 * keeps working; a missing/malformed body is a 400 (missing path), not a 500.
 */
async function resolveDownloadPath(req, res, url) {
  const fromQuery = (url.searchParams.get("path") ?? "").trim();

  if (fromQuery) {
    return { devicePath: fromQuery };
  }

  try {
    const body = await readProtectedJsonBody(req, res);
    const fromBody = typeof body?.path === "string" ? body.path.trim() : "";

    return { devicePath: fromBody };
  } catch (error) {
    return {
      devicePath: "",
      bodyError: error instanceof Error ? error.message : String(error),
    };
  }
}

const UPLOAD_ERROR_STATUS = {
  parent_missing: 404,
  parent_not_dir: 400,
  path_required: 400,
  upload_empty_body: 400,
  is_directory: 400,
  not_found: 404,
};

function resolveUploadErrorStatus(error) {
  if (error?.statusCode === 413) {
    return 413;
  }

  const mapped = UPLOAD_ERROR_STATUS[error?.code];

  return mapped ?? 500;
}

/**
 * @returns {Promise<boolean>}
 */
export async function handleDeviceFilesRoute(req, res, method, pathname, url) {
  const listMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files$/);
  const downloadMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files\/download$/);
  const uploadMatch = pathname.match(/^\/api\/devices\/([^/]+)\/files\/upload$/);

  if (method === "POST" && downloadMatch) {
    const serial = decodeURIComponent(downloadMatch[1]);
    let pulled = null;

    try {
      const { devicePath, bodyError } = await resolveDownloadPath(req, res, url);

      if (!devicePath) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "path_required",
          message: "缺少 path（查询参数或加密 POST body）。",
          ...(bodyError ? { detail: bodyError } : {}),
        });
        return true;
      }

      pulled = await pullDeviceFile(serial, devicePath);

      await pipeProtectedFileToResponse(res, pulled.localPath, {
        contentType: "application/octet-stream",
        contentLength: pulled.size,
        extraHeaders: buildDownloadHeaders(pulled.filename),
      });
    } catch (error) {
      if (res.headersSent) {
        reportStreamFailure(res, error);
      } else {
        const code = error?.code;

        sendProtectedJson(res, downloadErrorStatus(code), {
          success: false,
          version: APP_VERSION,
          error: code ?? "device_file_download_failed",
          message: error instanceof Error ? error.message : "下载失败",
        });
      }
    } finally {
      if (pulled?.cleanup) {
        await pulled.cleanup();
      }
    }

    return true;
  }

  if (method === "PUT" && uploadMatch) {
    const serial = decodeURIComponent(uploadMatch[1]);
    const devicePath = (url.searchParams.get("path") ?? "").trim();
    let temp = null;

    if (!devicePath) {
      sendProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "path_required",
        message: "缺少 path（查询参数）。",
      });
      return true;
    }

    // 上传会写设备文件系统：strict 下非持有者 409，且在收流前拦下，避免白收一整个包体
    if (denyWriteIfNotController(req, res, serial, "file_upload")) return true;

    try {
      temp = await createUploadTempFile();

      const { bytes } = await receiveProtectedUploadBody(
        req,
        temp.localPath,
        resolveFileUploadMaxBytes(),
      );

      if (!bytes) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "upload_empty_body",
          message: "上传内容为空。",
        });
        return true;
      }

      const result = await pushDeviceFile(serial, devicePath, temp.localPath);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        ...result,
        bytes,
      });
    } catch (error) {
      // 客户端错误要与服务端故障区分开：路径不存在 404、父级不是目录/缺 path 400、
      // 超限 413，其余才 500。否则「目标目录不存在」会被当成后端故障重试。
      const status = resolveUploadErrorStatus(error);

      sendProtectedJson(res, status, {
        success: false,
        version: APP_VERSION,
        error: error?.code ?? "device_file_upload_failed",
        message: error instanceof Error ? error.message : "上传失败",
      });
    } finally {
      if (temp?.cleanup) {
        await temp.cleanup();
      }
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
