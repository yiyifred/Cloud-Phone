import { APP_VERSION } from "../config/version.js";
import {
  SCRCPY_SERVER_LIMITS,
  downloadAndInstallServer,
  getServerStatus,
  installServerJar,
} from "../services/scrcpy-server-install.js";
import { readProtectedJsonBody, sendProtectedJson } from "../utils/protected-http.js";

const MAX_UPLOAD_BYTES = SCRCPY_SERVER_LIMITS.maxBytes;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);

    if (declared > MAX_UPLOAD_BYTES) {
      reject(Object.assign(new Error("文件超过 32 MB 上限"), { code: "payload_too_large", statusCode: 413 }));
      req.destroy();
      return;
    }

    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;

      if (total > MAX_UPLOAD_BYTES) {
        reject(Object.assign(new Error("文件超过 32 MB 上限"), { code: "payload_too_large", statusCode: 413 }));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendInstallError(res, error) {
  sendProtectedJson(res, error?.statusCode ?? 500, {
    success: false,
    version: APP_VERSION,
    error: error?.code ?? "scrcpy_server_install_failed",
    message: error instanceof Error ? error.message : "scrcpy-server 安装失败",
  });
}

export async function handleScrcpyServerRoute(req, res, method, pathname) {
  if (method === "GET" && pathname === "/api/scrcpy/server") {
    sendProtectedJson(res, 200, { success: true, version: APP_VERSION, server: getServerStatus() });
    return true;
  }

  if (method === "POST" && pathname === "/api/scrcpy/server/upload") {
    try {
      const buffer = await readRawBody(req);
      const installed = installServerJar(buffer, { source: "upload" });
      sendProtectedJson(res, 200, { success: true, version: APP_VERSION, installed, server: getServerStatus() });
    } catch (error) {
      sendInstallError(res, error);
    }

    return true;
  }

  if (method === "POST" && pathname === "/api/scrcpy/server/download") {
    try {
      const body = await readProtectedJsonBody(req, res);

      if (body === null) {
        return true;
      }

      const installed = await downloadAndInstallServer(body?.source ?? "ghproxy");
      sendProtectedJson(res, 200, { success: true, version: APP_VERSION, installed, server: getServerStatus() });
    } catch (error) {
      sendInstallError(res, error);
    }

    return true;
  }

  return false;
}
