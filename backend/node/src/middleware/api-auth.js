import { AUTH_COOKIE_NAME } from "../config/auth.js";
import { getAuthStatus, verifySessionToken } from "../services/auth-service.js";
import { getSessionRecord, removeSession } from "../services/session-store.js";

export const PUBLIC_API_PATHS = new Set([
  "/api/auth/session",
  "/api/auth/login",
  "/api/ping",
]);

export function isPublicApiPath(pathname, method) {
  if (PUBLIC_API_PATHS.has(pathname)) {
    return true;
  }

  if (pathname === "/api/auth/change-password" && method === "POST") {
    return true;
  }

  return false;
}

export async function resolveApiSession(sessionToken) {
  const verified = verifySessionToken(sessionToken);

  if (!verified) {
    removeSession(sessionToken);
    return null;
  }

  const record = getSessionRecord(sessionToken);

  if (!record) {
    return null;
  }

  return {
    token: sessionToken,
    encryptionKey: record.encryptionKey,
    expiresAt: verified.expiresAt,
  };
}

export async function requireApiSession(sessionToken) {
  return resolveApiSession(sessionToken);
}

export function getSessionTokenFromCookies(cookies) {
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export async function getPublicAuthStatus(sessionToken) {
  return getAuthStatus(sessionToken);
}
