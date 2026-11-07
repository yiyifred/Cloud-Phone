import { APP_VERSION } from "../config/version.js";
import { DEFAULT_PASSWORD } from "../config/auth.js";
import {
  changePassword,
  getAuthStatus,
  getClearSessionCookie,
  getSessionCookie,
  loginWithPassword,
  revokeSessionToken,
} from "../services/auth-service.js";
import { requireApiSession } from "../middleware/api-auth.js";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "../services/login-throttle.js";
import { getClientIp, isSecureRequest } from "../utils/request-https.js";
import {
  attachResponseEncryption,
  readLoginWireProtectedJsonBody,
  readPasswordProtectedJsonBody,
  readProtectedJsonBody,
  sendLoginWireProtectedJson,
  sendPasswordProtectedJson,
  sendProtectedJson,
} from "../utils/protected-http.js";

export async function handleAuthRoute(req, res, method, pathname, sessionToken) {
  if (method === "GET" && pathname === "/api/auth/session") {
    try {
      const session = await requireApiSession(sessionToken);
      const authStatus = await getAuthStatus(sessionToken);

      if (session) {
        attachResponseEncryption(res, session.encryptionKey);
        sendProtectedJson(res, 200, {
          success: true,
          version: APP_VERSION,
          ...authStatus,
        });
      } else {
        sendLoginWireProtectedJson(res, 200, {
          success: true,
          version: APP_VERSION,
          ...authStatus,
        });
      }
    } catch (error) {
      sendLoginWireProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "auth_session_failed",
        message: error instanceof Error ? error.message : "Failed to read auth session.",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const clientKey = getClientIp(req);
    const gate = checkLoginAllowed(clientKey);

    if (!gate.allowed) {
      // 429 before touching the password store: no scrypt work, no oracle.
      sendLoginWireProtectedJson(
        res,
        429,
        {
          success: false,
          version: APP_VERSION,
          code: "LOGIN_THROTTLED",
          message: "Too many failed attempts. Try again later.",
          retryAfterSeconds: gate.retryAfterSeconds,
        },
        { "Retry-After": String(gate.retryAfterSeconds) },
      );
      return true;
    }

    try {
      const body = await readLoginWireProtectedJsonBody(req);
      const password = String(body.password ?? "");
      const result = await loginWithPassword(password);

      if (!result.success) {
        recordLoginFailure(clientKey);
        sendLoginWireProtectedJson(res, 401, {
          success: false,
          version: APP_VERSION,
          code: result.code,
          message: result.message,
        });
        return true;
      }

      if (result.session) {
        recordLoginSuccess(clientKey);
      }

      const headers = result.session
        ? { "Set-Cookie": getSessionCookie(result.session.token, { secure: isSecureRequest(req) }) }
        : {};

      sendPasswordProtectedJson(
        res,
        200,
        {
          success: true,
          version: APP_VERSION,
          authenticated: result.authenticated,
          requiresPasswordChange: result.requiresPasswordChange,
          passwordConfigured: result.passwordConfigured,
          sessionExpiresAt: result.session?.expiresAt ?? null,
          encryptionKey: result.session?.encryptionKey ?? null,
        },
        password,
        headers,
      );
    } catch (error) {
      sendLoginWireProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "invalid_request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/change-password") {
    await handleChangePassword(req, res, sessionToken);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    revokeSessionToken(sessionToken);
    sendProtectedJson(
      res,
      200,
      { success: true, version: APP_VERSION },
      {
        // Clear both variants: the https one carries Secure and would otherwise
        // survive sign-out.
        "Set-Cookie": [getClearSessionCookie(), `${getClearSessionCookie()}; Secure`],
      },
    );
    return true;
  }

  return false;
}

async function handleChangePassword(req, res, sessionToken) {
  try {
    const session = await requireApiSession(sessionToken);
    let body;

    if (session) {
      attachResponseEncryption(res, session.encryptionKey);
      body = await readProtectedJsonBody(req, res);
    } else {
      body = await readPasswordProtectedJsonBody(req, DEFAULT_PASSWORD);
    }

    const result = await changePassword(
      String(body.currentPassword ?? ""),
      String(body.nextPassword ?? ""),
    );

    if (!result.success) {
      const payload = {
        success: false,
        version: APP_VERSION,
        code: result.code,
        message: result.message,
      };
      if (session) {
        sendProtectedJson(res, 400, payload);
      } else {
        sendPasswordProtectedJson(res, 400, payload, DEFAULT_PASSWORD);
      }
      return;
    }

    const responsePayload = {
      success: true,
      version: APP_VERSION,
      authenticated: true,
      requiresPasswordChange: false,
      passwordConfigured: true,
      sessionExpiresAt: result.session.expiresAt,
      passwordUpdatedAt: result.passwordUpdatedAt,
      encryptionKey: result.session.encryptionKey,
    };
    const headers = {
      "Set-Cookie": getSessionCookie(result.session.token, { secure: isSecureRequest(req) }),
    };

    if (session) {
      sendProtectedJson(res, 200, responsePayload, headers);
    } else {
      sendPasswordProtectedJson(
        res,
        200,
        responsePayload,
        String(body.currentPassword ?? DEFAULT_PASSWORD),
        headers,
      );
    }
  } catch (error) {
    const session = await requireApiSession(sessionToken);
    const payload = {
      success: false,
      version: APP_VERSION,
      error: "invalid_request",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    if (session) {
      attachResponseEncryption(res, session.encryptionKey);
      sendProtectedJson(res, 400, payload);
    } else {
      sendLoginWireProtectedJson(res, 400, payload);
    }
  }
}
