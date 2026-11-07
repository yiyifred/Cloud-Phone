import { APP_VERSION } from "../config/version.js";
import { serverConfig } from "../config/env.js";
import { getHostRuntimeInfo } from "../config/runtime-env.js";
import { getScrcpyServerDiagnostics } from "../config/scrcpy-paths.js";
import { getHostNetworkSummary } from "../utils/host-networks.js";
import { sendJson } from "../utils/http.js";
import { sendLoginWireProtectedJson, sendProtectedJson } from "../utils/protected-http.js";

export function handleHostRoute(req, res, method, pathname) {
  if (method === "GET" && pathname === "/health") {
    // Minimal readiness probe only (no host/network/scrcpy details).
    sendJson(res, 200, {
      status: "ok",
      service: "cloud-phone-node",
      version: APP_VERSION,
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/ping") {
    sendLoginWireProtectedJson(res, 200, {
      success: true,
      service: "cloud-phone-node",
      version: APP_VERSION,
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/host/networks") {
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      ...getHostNetworkSummary(serverConfig.host),
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/host/diagnostics") {
    sendProtectedJson(res, 200, {
      success: true,
      version: APP_VERSION,
      host: getHostRuntimeInfo(),
      network: getHostNetworkSummary(serverConfig.host),
      scrcpyServer: getScrcpyServerDiagnostics(),
    });
    return true;
  }

  return false;
}
