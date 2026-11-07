import crypto from "node:crypto";

import {
  AUTH_COOKIE_NAME,
  DEFAULT_PASSWORD,
  PASSWORD_MIN_LENGTH,
  getSessionDurationMs,
} from "../config/auth.js";
import { createSessionEncryptionKey } from "../utils/api-crypto.js";
import { getAuthKeyMaterial, getPasswordRecord, savePasswordRecord } from "./auth-store.js";
import {
  clearAllSessions,
  getSessionRecord,
  registerSession,
  removeSession,
} from "./session-store.js";

const SESSION_SECRET_CONTEXT = "cloud-phone-session";

export async function getAuthStatus(sessionToken) {
  const passwordRecord = getPasswordRecord();
  const session = verifySessionTokenInternal(sessionToken);
  const record = session ? getSessionRecord(sessionToken) : null;
  const hasActiveSession = Boolean(session && record);

  if (sessionToken && !hasActiveSession) {
    removeSession(sessionToken);
  }

  return {
    authenticated: hasActiveSession,
    passwordConfigured: Boolean(passwordRecord),
    // Only prompt for password change after the default password was verified via login.
    requiresPasswordChange: !passwordRecord && hasActiveSession,
    sessionExpiresAt: hasActiveSession ? session?.expiresAt ?? null : null,
    passwordUpdatedAt: passwordRecord?.updatedAt ?? null,
    // Never return encryptionKey here — only via password-encrypted login/change-password.
  };
}

export async function loginWithPassword(password) {
  const passwordRecord = getPasswordRecord();
  const matches = passwordRecord
    ? await verifyPasswordAgainstRecord(password, passwordRecord)
    : password === DEFAULT_PASSWORD;

  if (!matches) {
    return {
      success: false,
      code: "INVALID_PASSWORD",
      message: "Password is incorrect.",
    };
  }

  if (!passwordRecord) {
    return {
      success: true,
      authenticated: false,
      requiresPasswordChange: true,
      passwordConfigured: false,
      message: "Default password must be changed before continuing.",
    };
  }

  const session = createSessionToken(passwordRecord.updatedAt);

  return {
    success: true,
    authenticated: true,
    requiresPasswordChange: false,
    passwordConfigured: true,
    session,
  };
}

export async function changePassword(currentPassword, nextPassword) {
  const passwordRecord = getPasswordRecord();
  const currentPasswordMatches = passwordRecord
    ? await verifyPasswordAgainstRecord(currentPassword, passwordRecord)
    : currentPassword === DEFAULT_PASSWORD;

  if (!currentPasswordMatches) {
    return {
      success: false,
      code: "INVALID_PASSWORD",
      message: "Current password is incorrect.",
    };
  }

  if (nextPassword.length < PASSWORD_MIN_LENGTH) {
    return {
      success: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  if (nextPassword === DEFAULT_PASSWORD) {
    return {
      success: false,
      code: "DEFAULT_PASSWORD_FORBIDDEN",
      message: "Default password cannot be reused.",
    };
  }

  const nextRecord = await createPasswordRecord(nextPassword);
  const savedRecord = savePasswordRecord(nextRecord);
  // Password change invalidates every existing cookie/session immediately.
  clearAllSessions();
  const session = createSessionToken(savedRecord.updatedAt);

  return {
    success: true,
    authenticated: true,
    requiresPasswordChange: false,
    passwordConfigured: true,
    passwordUpdatedAt: savedRecord.updatedAt,
    session,
  };
}

export function verifySessionToken(token) {
  return verifySessionTokenInternal(token);
}

export function revokeSessionToken(token) {
  removeSession(token);
}

export function getClearSessionCookie() {
  return serializeSessionCookie("", new Date(0), {});
}

/**
 * @param {string} token
 * @param {{ secure?: boolean, days?: number }} [options]
 */
export function getSessionCookie(token, options = {}) {
  const days = options.days ?? 0;
  const expiresAt = new Date(
    Date.now() + (days > 0 ? days * 24 * 60 * 60 * 1000 : getSessionDurationMs()),
  );
  return serializeSessionCookie(token, expiresAt, options);
}

function serializeSessionCookie(token, expiresAt, options) {
  const maxAgeSeconds = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `${AUTH_COOKIE_NAME}=${token}`,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  // Only over TLS: a Secure cookie on plain http is dropped by the browser.
  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

async function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = await derivePasswordHash(password, salt);

  return {
    algorithm: "scrypt",
    salt,
    hash,
  };
}

async function verifyPasswordAgainstRecord(password, record) {
  const derivedHash = await derivePasswordHash(password, record.salt);
  return crypto.timingSafeEqual(
    Buffer.from(derivedHash, "base64"),
    Buffer.from(record.hash, "base64"),
  );
}

async function derivePasswordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("base64"));
    });
  });
}

function createSessionToken(passwordUpdatedAt) {
  const expiresAt = new Date(Date.now() + getSessionDurationMs());
  const payload = Buffer.from(
    JSON.stringify({
      exp: expiresAt.toISOString(),
      iat: new Date().toISOString(),
      pwd: passwordUpdatedAt || "none",
    }),
    "utf8",
  ).toString("base64url");
  const signature = signPayload(payload);
  const token = `${payload}.${signature}`;
  const encryptionKey = createSessionEncryptionKey();

  registerSession(token, encryptionKey, expiresAt.toISOString());

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    encryptionKey: encryptionKey.toString("base64"),
  };
}

function verifySessionTokenInternal(token) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !signatureMatches(payload, signature)) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expiresAt = new Date(parsedPayload.exp);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const passwordRecord = getPasswordRecord();
    const expectedPwd = passwordRecord?.updatedAt || "none";
    if (parsedPayload.pwd !== expectedPwd) {
      return null;
    }

    return {
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    return null;
  }
}

/** Constant-time compare so a remote attacker cannot time the HMAC byte by byte. */
function signatureMatches(payload, signature) {
  const expected = Buffer.from(signPayload(payload), "utf8");
  const actual = Buffer.from(String(signature), "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function getSessionSecret() {
  return crypto
    .createHash("sha256")
    .update(Buffer.concat([Buffer.from(SESSION_SECRET_CONTEXT, "utf8"), getAuthKeyMaterial()]))
    .digest();
}
