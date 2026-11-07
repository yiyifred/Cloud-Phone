import {
  base64ToKey,
  decryptPayload,
  deriveLoginRequestKey,
  deriveLoginResponseKey,
  deriveLoginWireKey,
  encryptPayload,
} from "./api-crypto.js";
import {
  clearSessionEncryptionKey,
  getSessionEncryptionKey,
  hasSessionEncryptionKey,
  saveSessionEncryptionKey,
} from "./api-session.js";
import { fetchWithLanFallback } from "./api-transport.js";

async function decryptChangePasswordError(envelope, body, bootstrap) {
  if (!envelope?.encrypted) {
    throw new Error(envelope?.message ?? envelope?.error ?? "Password change failed.");
  }

  let decrypted;
  if (!bootstrap) {
    decrypted = await decryptPayload(envelope, base64ToKey(getSessionEncryptionKey()));
  } else {
    try {
      decrypted = await decryptPayload(
        envelope,
        await deriveLoginResponseKey(body.currentPassword),
      );
    } catch {
      decrypted = await decryptPayload(envelope, await deriveLoginWireKey());
    }
  }

  throw new Error(decrypted.message ?? decrypted.error ?? "Password change failed.");
}

export async function loginRequest(password) {
  const wireKey = await deriveLoginWireKey();
  const envelopeBody = await encryptPayload({ password }, wireKey);
  const response = await fetchWithLanFallback("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Encrypted-Request": "1",
    },
    body: JSON.stringify(envelopeBody),
  });

  const envelope = await response.json();

  if (!envelope?.encrypted) {
    throw new Error(envelope.message ?? envelope.error ?? "登录响应未加密。");
  }

  if (!response.ok) {
    const failed = await decryptPayload(envelope, wireKey);
    throw new Error(failed.message ?? failed.error ?? "Login failed.");
  }

  const loginKey = await deriveLoginResponseKey(password);
  const result = await decryptPayload(envelope, loginKey);

  if (result.encryptionKey) {
    saveSessionEncryptionKey(result.encryptionKey);
  } else {
    clearSessionEncryptionKey();
  }

  return result;
}

export async function changePasswordRequest(body, options = {}) {
  const bootstrap = options.plainJson || !hasSessionEncryptionKey();
  const requestBody = bootstrap
    ? JSON.stringify(await encryptPayload(body, await deriveLoginRequestKey(body.currentPassword)))
    : JSON.stringify(await encryptPayload(body, base64ToKey(getSessionEncryptionKey())));

  const response = await fetchWithLanFallback("/api/auth/change-password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Encrypted-Request": "1",
    },
    body: requestBody,
  });

  const envelope = await response.json();

  if (!response.ok) {
    await decryptChangePasswordError(envelope, body, bootstrap);
  }

  if (!envelope?.encrypted) {
    return envelope;
  }

  if (!bootstrap) {
    const result = await decryptPayload(envelope, base64ToKey(getSessionEncryptionKey()));
    if (result.encryptionKey) {
      saveSessionEncryptionKey(result.encryptionKey);
    }
    return result;
  }

  const loginKey = await deriveLoginResponseKey(body.currentPassword);
  const result = await decryptPayload(envelope, loginKey);

  if (result.encryptionKey) {
    saveSessionEncryptionKey(result.encryptionKey);
  }

  return result;
}
