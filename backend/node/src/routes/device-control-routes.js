import { APP_VERSION } from "../config/version.js";
import {
  ControlLeaseError,
  acquireControlLease,
  getControlLease,
  isControlEnforced,
  releaseControlLease,
  renewControlLease,
  sessionKeyOf,
} from "../services/device-control-lease.js";
import { readProtectedJsonBody, sendProtectedJson } from "../utils/protected-http.js";

const CONTROL_PATH = /^\/api\/devices\/([^/]+)\/control(?:\/(acquire|release|heartbeat))?$/;

function sendLeaseError(res, error) {
  const status = error instanceof ControlLeaseError ? error.statusCode : 400;

  sendProtectedJson(res, status, {
    success: false,
    version: APP_VERSION,
    error: error?.code ?? "control_lease_failed",
    message:
      status === 409
        ? "设备正被其他会话控制，请先请求控制权或稍后重试。"
        : "控制权操作失败。",
    holder: error?.holder ?? null,
    enforced: isControlEnforced(),
  });
}

function sendLease(res, status, control) {
  sendProtectedJson(res, status, {
    success: true,
    version: APP_VERSION,
    control,
    enforced: isControlEnforced(),
  });
}

/**
 * 设备控制权租约 API。
 * @returns {Promise<boolean>} 已处理返回 true
 */
export async function handleDeviceControlRoute(req, res, method, pathname, sessionToken) {
  const match = pathname.match(CONTROL_PATH);

  if (!match) {
    return false;
  }

  const serial = decodeURIComponent(match[1]);
  const action = match[2] ?? "";
  const sessionKey = sessionKeyOf(sessionToken);

  try {
    if (method === "GET" && !action) {
      sendLease(res, 200, getControlLease(serial, sessionKey));
      return true;
    }

    if (method === "POST" && action === "acquire") {
      // body 可选：老客户端可能直接 POST 空体
      let body = {};

      if (Number(req.headers["content-length"] ?? 0) > 0) {
        body = (await readProtectedJsonBody(req, res)) ?? {};
      }

      const control = acquireControlLease(serial, sessionKey, {
        label: body.label,
        force: body.force === true,
      });

      sendLease(res, 200, control);
      return true;
    }

    if (method === "POST" && action === "release") {
      releaseControlLease(serial, sessionKey, { force: false });
      sendLease(res, 200, getControlLease(serial, sessionKey));
      return true;
    }

    if (method === "POST" && action === "heartbeat") {
      sendLease(res, 200, renewControlLease(serial, sessionKey));
      return true;
    }
  } catch (error) {
    if (res.writableEnded) {
      return true;
    }

    if (error instanceof ControlLeaseError) {
      sendLeaseError(res, error);
      return true;
    }

    // 读 body 失败（例如加密信封坏掉）也要给出可读错误，不要静默 500
    console.warn("[control-lease] 请求处理失败：", error?.message ?? error);
    sendProtectedJson(res, 400, {
      success: false,
      version: APP_VERSION,
      error: error?.code ?? "control_lease_bad_request",
      message: error instanceof Error ? error.message : "请求无效。",
    });
    return true;
  }

  sendProtectedJson(res, 405, {
    success: false,
    version: APP_VERSION,
    error: "method_not_allowed",
  });
  return true;
}
