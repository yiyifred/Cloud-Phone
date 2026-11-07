import {
  clearSessionEncryptionKey,
  hasSessionEncryptionKey,
  requestJson,
} from "../utils/api.js";
import { resetSessionExpiredGate } from "../utils/auth-session-bridge.js";
import { logInfo } from "../utils/app-event-logger.js";

/**
 * @param {{
 *   syncAuthState: (result: object) => void,
 *   sessionValidText: string,
 * }} deps
 */
export function createCookieSessionRestorer({ syncAuthState, sessionValidText }) {
  return async function tryRestoreFromCookie() {
    try {
      const result = await requestJson("/api/auth/session", {
        allowFailure: true,
        skipAuthExpire: true,
      });
      if (!result?.authenticated) {
        return false;
      }

      // Session payload is encrypted with the existing session key; key is never resent in cleartext.
      if (!hasSessionEncryptionKey()) {
        return false;
      }

      syncAuthState(result);
      return { ok: true, result };
    } catch {
      return false;
    }
  };
}

/**
 * @param {{
 *   state: object,
 *   remember: { resetAutoLogin: () => void, runRememberedLogin: Function, prefillRememberedPassword: () => void },
 *   tryRestoreFromCookie: () => Promise<false | { ok: true, result: object }>,
 *   texts: { sessionChecking: string, sessionMissing: string, sessionValid: string },
 *   logWarn: Function,
 * }} deps
 */
export async function softRecoverSession(deps) {
  const { state, remember, tryRestoreFromCookie, texts, logWarn } = deps;

  if (state.reauthenticating || state.booting) {
    return;
  }

  state.reauthenticating = true;
  state.sessionStateText = texts.sessionChecking;
  logWarn("auth", "auth.session.recover", "会话失效，尝试静默恢复");

  try {
    remember.resetAutoLogin();
    const restored = await tryRestoreFromCookie();
    if (restored) {
      state.sessionStateText = texts.sessionValid;
      resetSessionExpiredGate();
      logInfo("auth", "auth.session.restore", "通过 Cookie 恢复登录会话", {
        details: { sessionExpiresAt: restored.result.sessionExpiresAt },
      });
      return;
    }

    state.authenticated = false;
    const rememberedOk = await remember.runRememberedLogin({ manageBooting: false });
    if (rememberedOk) {
      resetSessionExpiredGate();
      return;
    }

    clearSessionEncryptionKey();
    state.requiresPasswordChange = false;
    state.sessionExpiresAt = null;
    state.sessionStateText = texts.sessionMissing;
    state.loginFeedback = "";
    remember.prefillRememberedPassword();
  } finally {
    state.reauthenticating = false;
    state.booting = false;
  }
}
