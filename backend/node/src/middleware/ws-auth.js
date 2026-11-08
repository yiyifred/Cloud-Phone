import { parseCookies } from "../utils/cookies.js";
import { isAllowedOrigin } from "../utils/http.js";
import { getSessionTokenFromCookies, requireApiSession } from "./api-auth.js";

/**
 * Cross-site WebSocket hijacking guard.
 *
 * Browsers always send Origin on a WS handshake, so a missing Origin means a
 * non-browser client (adb bridge, CLI, native app) — those already need
 * network access and carry no ambient cookie from a browsing context.
 * When an Origin is present it must either be the host we are serving or an
 * explicitly configured origin.
 */
export function isAllowedWsOrigin(request) {
  const origin = request.headers.origin;

  if (!origin) {
    return true;
  }

  if (isAllowedOrigin(origin)) {
    return true;
  }

  try {
    const originHost = new URL(origin).hostname;
    const requestHost = String(request.headers.host ?? "").split(":")[0];
    return Boolean(originHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

/**
 * 返回 session 对象而不是布尔值：控制权租约需要 sessionToken 才能判断「这条连接是谁」。
 * 既有调用点的 `if (!session)` 判空语义不变（无会话仍返回 null）。
 *
 * @returns {Promise<{token: string, encryptionKey: Buffer, expiresAt: number} | null>}
 */
export async function verifyWebSocketSession(request) {
  const cookies = parseCookies(request.headers.cookie);
  const session = await requireApiSession(getSessionTokenFromCookies(cookies));

  return session ?? null;
}
