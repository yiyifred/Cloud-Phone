import { SHARE_COOKIE_NAME } from "../config/auth.js";
import { resolveShareToken } from "../services/share-tokens.js";
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
 * 只要管理员会话（viewer 视为无会话）。语义与改造前一致：判空即「没有管理员凭据」。
 * 复用 resolveWebSocketPrincipal，避免两处各写一遍 cookie 解析。
 *
 * @returns {Promise<{token: string, encryptionKey: Buffer, expiresAt: number} | null>}
 */
export async function verifyWebSocketSession(request) {
  const principal = await resolveWebSocketPrincipal(request);

  return principal?.role === "admin" ? principal.session : null;
}

/**
 * WS 握手身份解析：管理员会话优先，其次只读分享令牌（viewer）。
 *
 * 为什么管理员优先：同一个浏览器可能既有管理员会话又有分享 cookie（开发者点了别人的分享链接），
 * 此时按权限更高的身份放行，与 HTTP 侧 app.js 的判定顺序保持一致。
 *
 * 顺序也保证了「有会话但会话已失效」时不会凭空降级成 viewer：
 * requireApiSession 返回 null 才继续尝试分享令牌。
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<null | {role: "admin", sessionToken: string, session: object}
 *                        | {role: "viewer", sessionToken: null, share: object}>}
 */
export async function resolveWebSocketPrincipal(request) {
  const cookies = parseCookies(request.headers.cookie);
  const session = await requireApiSession(getSessionTokenFromCookies(cookies));

  if (session) {
    return { role: "admin", sessionToken: session.token ?? null, session };
  }

  const share = resolveShareToken(cookies[SHARE_COOKIE_NAME]);

  if (share) {
    return { role: "viewer", sessionToken: null, share };
  }

  return null;
}
