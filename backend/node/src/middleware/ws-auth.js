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

export async function verifyWebSocketSession(request) {
  const cookies = parseCookies(request.headers.cookie);
  const session = await requireApiSession(getSessionTokenFromCookies(cookies));

  return Boolean(session);
}
