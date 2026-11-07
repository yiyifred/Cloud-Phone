import { APP_VERSION } from "../config/version.js";
import {
  appendStoredLog,
  clearStoredLogs,
  getStoredRuntimeState,
  getStoredSettings,
  listStoredLogs,
  listStoredLogsPage,
  patchStoredRuntimeState,
  patchStoredSettings,
} from "../services/local-persistence-store.js";
import {
  readLoginWireProtectedJsonBody,
  readProtectedJsonBody,
  sendLoginWireProtectedJson,
  sendProtectedJson,
} from "../utils/protected-http.js";

export async function handleLocalPersistenceRoute(req, res, method, pathname, url) {
  if (method === "GET" && pathname === "/api/public/preferences") {
    const settings = getStoredSettings();
    sendLoginWireProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      preferences: {
        theme: settings.theme,
        locale: settings.locale,
      },
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/public/preferences") {
    try {
      const body = await readLoginWireProtectedJsonBody(req);
      const settings = patchStoredSettings({
        theme: body?.theme,
        locale: body?.locale,
      });
      sendLoginWireProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        preferences: {
          theme: settings.theme,
          locale: settings.locale,
        },
      });
    } catch (error) {
      sendLoginWireProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "preferences_update_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "GET" && pathname === "/api/local-persistence") {
    // Default: do not embed logs (clients load /api/logs in pages).
    const rawLimit = url.searchParams.get("logLimit");
    const logLimit = rawLimit == null || rawLimit === "" ? 0 : Number(rawLimit);
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      settings: getStoredSettings(),
      runtimeState: getStoredRuntimeState(),
      logs: logLimit > 0 ? listStoredLogs(logLimit) : [],
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/local-persistence") {
    try {
      const body = await readProtectedJsonBody(req, res);
      const settings = body?.settings ? patchStoredSettings(body.settings) : getStoredSettings();
      const runtimeState = body?.runtimeState
        ? patchStoredRuntimeState(body.runtimeState)
        : getStoredRuntimeState();
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        settings,
        runtimeState,
      });
    } catch (error) {
      sendProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "local_persistence_update_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "GET" && pathname === "/api/logs") {
    const beforeRaw = url.searchParams.get("beforeId");
    const page = listStoredLogsPage({
      limit: url.searchParams.get("limit"),
      beforeId: beforeRaw == null || beforeRaw === "" ? null : beforeRaw,
    });
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      ...page,
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/logs") {
    try {
      const body = await readProtectedJsonBody(req, res);
      appendStoredLog(body?.entry ?? {});
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
      });
    } catch (error) {
      sendProtectedJson(res, 400, {
        success: false,
        version: APP_VERSION,
        error: "log_append_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "DELETE" && pathname === "/api/logs") {
    clearStoredLogs();
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
    });
    return true;
  }

  return false;
}
