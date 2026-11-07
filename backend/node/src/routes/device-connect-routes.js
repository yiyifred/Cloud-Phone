import { APP_VERSION } from "../config/version.js";
import {
  connectDeviceByHost,
  createQrPairingSession,
  pairDeviceByQrService,
  pairDeviceWithCode,
} from "../services/adb-service.js";
import { readProtectedJsonBody, sendProtectedJson } from "../utils/protected-http.js";

export async function handleDeviceConnectRoute(req, res, method, pathname) {
  if (method === "POST" && pathname === "/api/devices/connect") {
    try {
      const body = await readProtectedJsonBody(req, res);
      const host = String(body.host ?? "").trim();
      const port = Number(body.port);

      if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_connect_payload",
          message: "host and port are required.",
        });
        return true;
      }

      const connectResult = await connectDeviceByHost(host, port, { scanPorts: false });
      sendProtectedJson(res, connectResult.success ? 200 : 400, {
        success: connectResult.success,
        version: APP_VERSION,
        connect: connectResult,
        message: connectResult.success
          ? undefined
          : connectResult.attempts?.find((item) => !item.ok)?.output || "adb connect failed.",
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "connect_failed",
        message: error instanceof Error ? error.message : "Unknown error.",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/api/devices/pair-code") {
    try {
      const body = await readProtectedJsonBody(req, res);
      const host = String(body.host ?? "").trim();
      const port = Number(body.port);
      const pairingCode = String(body.pairingCode ?? "").trim();

      if (!host || !Number.isInteger(port) || port <= 0 || port > 65535 || !pairingCode) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_pair_payload",
          message: "host / port / pairingCode are required.",
        });
        return true;
      }

      const pairResult = await pairDeviceWithCode(host, port, pairingCode);
      const connectResult = pairResult.success ? await connectDeviceByHost(host, port) : null;
      sendProtectedJson(res, pairResult.success ? 200 : 400, {
        success: pairResult.success,
        version: APP_VERSION,
        message: pairResult.success ? undefined : pairResult.output,
        pair: pairResult,
        connect: connectResult,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "pair_code_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/api/devices/qr-session") {
    try {
      const session = await createQrPairingSession();
      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        ...session,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "qr_session_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/api/devices/pair-qr") {
    try {
      const body = await readProtectedJsonBody(req, res);
      const serviceName = String(body.serviceName ?? "").trim();
      const pairingCode = String(body.pairingCode ?? "").trim();

      if (!serviceName || !pairingCode) {
        sendProtectedJson(res, 400, {
          success: false,
          version: APP_VERSION,
          error: "invalid_qr_pair_payload",
          message: "serviceName / pairingCode are required.",
        });
        return true;
      }

      const result = await pairDeviceByQrService(serviceName, pairingCode);
      sendProtectedJson(res, result.success ? 200 : 400, {
        success: result.success,
        version: APP_VERSION,
        pair: result.pair,
        connect: result.connect,
        discovery: result.discovery,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "pair_qr_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  return false;
}
