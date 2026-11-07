import {
  base64ToKey,
  decryptPayload,
  deriveLoginWireKey,
  encryptPayload,
} from "./api-crypto.js";
import {
  clearSessionEncryptionKey,
  getSessionEncryptionKey,
  hasSessionEncryptionKey,
  saveSessionEncryptionKey,
} from "./api-session.js";
import { notifySessionExpired } from "./auth-session-bridge.js";
import { fetchWithLanFallback } from "./api-transport.js";

export { clearSessionEncryptionKey, hasSessionEncryptionKey, saveSessionEncryptionKey };
export { loginRequest, changePasswordRequest } from "./api-auth-http.js";
export { fetchWithLanFallback };

function isUnauthorizedResponse(response, result) {
  if (response.status === 401) {
    return true;
  }

  const message = String(result?.message ?? "");
  const error = String(result?.error ?? "");

  return (
    error === "unauthorized" ||
    /valid session required/i.test(message) ||
    /sign in first/i.test(message)
  );
}

function handleUnauthorizedResponse(response, result) {
  if (!isUnauthorizedResponse(response, result)) {
    return false;
  }

  notifySessionExpired();
  throw new SessionExpiredError(result?.message ?? "Valid session required. Sign in first.");
}

export class SessionExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(error) {
  if (error instanceof SessionExpiredError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /valid session required/i.test(message) ||
    /sign in first/i.test(message) ||
    /缺少会话加密密钥/i.test(message)
  );
}

/** Decrypt session envelope, falling back to login-wire for public/401 responses. */
export async function decryptApiEnvelope(envelope, { preferWire = false } = {}) {
  if (!envelope?.encrypted) {
    return envelope;
  }

  const sessionKey = getSessionEncryptionKey();
  if (!preferWire && sessionKey) {
    try {
      return await decryptPayload(envelope, base64ToKey(sessionKey));
    } catch {
      // Unauthorized / public endpoints use the login-wire key.
    }
  }

  return decryptPayload(envelope, await deriveLoginWireKey());
}

async function parseResponseBody(response, options = {}) {
  const rawText = await response.text();
  if (!rawText?.trim()) {
    throw new Error(
      response.ok
        ? "服务器返回了空响应。"
        : `服务器错误 (${response.status})，请确认后端已启动且无崩溃。`,
    );
  }

  let envelope;
  try {
    envelope = JSON.parse(rawText);
  } catch {
    throw new Error(
      response.ok
        ? "服务器返回了无效 JSON。"
        : `服务器错误 (${response.status})，请确认后端已启动且无崩溃。`,
    );
  }

  return decryptApiEnvelope(envelope, { preferWire: Boolean(options.wireEncrypted) });
}

async function buildRequestBody(body, options = {}) {
  if (!body) {
    return undefined;
  }

  if (options.wireEncrypted) {
    return JSON.stringify(await encryptPayload(body, await deriveLoginWireKey()));
  }

  if (options.plainJson) {
    throw new Error("明文 JSON 请求已禁用，请使用会话或 login-wire 加密。");
  }

  const sessionKey = getSessionEncryptionKey();

  if (!sessionKey) {
    notifySessionExpired();
    throw new SessionExpiredError("缺少会话加密密钥，请重新登录。");
  }

  return JSON.stringify(await encryptPayload(body, base64ToKey(sessionKey)));
}

export async function requestJson(url, options = {}) {
  const response = await fetchWithLanFallback(url, {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
    headers: options.body
      ? {
          "Content-Type": "application/json",
          "X-Encrypted-Request": "1",
        }
      : {},
    body: await buildRequestBody(options.body, options),
  });

  let result = {};

  try {
    result = await parseResponseBody(response, options);
  } catch (parseError) {
    if (parseError instanceof SessionExpiredError) {
      throw parseError;
    }

    if (response.status === 401 && !options.skipAuthExpire) {
      handleUnauthorizedResponse(response, { message: "Valid session required. Sign in first." });
    }

    throw parseError instanceof Error
      ? parseError
      : new Error(
          response.ok
            ? "服务器返回了无效 JSON。"
            : `服务器错误 (${response.status})，请确认后端已启动且无崩溃。`,
        );
  }

  if (isUnauthorizedResponse(response, result)) {
    if (options.skipAuthExpire) {
      return result;
    }
    handleUnauthorizedResponse(response, result);
  }

  if (options.allowFailure) {
    return result;
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message ?? result.error ?? result.pair?.output ?? "Request failed.",
    );
  }

  return result;
}

export async function parseEncryptedFetchResponse(response) {
  const envelope = await response.json();
  const result = await decryptApiEnvelope(envelope);

  if (isUnauthorizedResponse(response, result)) {
    handleUnauthorizedResponse(response, result);
  }

  return result;
}

export async function fetchEncryptedBinary(url, options = {}) {
  const response = await fetchWithLanFallback(url, {
    ...options,
    credentials: "include",
  });

  const result = await parseResponseBody(response);

  if (isUnauthorizedResponse(response, result)) {
    handleUnauthorizedResponse(response, result);
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message ?? result.error ?? "Request failed.");
  }

  if (!result.data) {
    throw new Error("缺少加密文件数据。");
  }

  const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
  const mime = result.contentType ?? options.mime ?? "application/octet-stream";
  return new Blob([bytes], { type: mime });
}

export function getErrorMessage(error, fallback) {
  if (isSessionExpiredError(error)) {
    return "";
  }

  if (error instanceof TypeError) {
    const detail = error.message?.trim();

    if (detail && /failed to fetch|networkerror|network error|load failed/i.test(detail)) {
      const hint = detail !== "Failed to fetch" ? `（${detail}）` : "";
      return `无法连接后端 API${hint}。请确认后端已启动，Docker 生产环境请使用 https://<IP>:5173 并重建 v0.13.9+ 镜像。`;
    }

    return detail || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
