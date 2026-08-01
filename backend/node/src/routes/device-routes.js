import { handleDeviceAppsRoute } from "./device-apps-routes.js";
import {
  handleDeviceAppForceStopRoute,
  handleDeviceAppStopRoute,
} from "./device-app-force-stop-routes.js";
import { handleDeviceAppRunningRoute } from "./device-app-running-routes.js";
import { handleDeviceFilesRoute } from "./device-files-routes.js";
import { handleDeviceNotificationsRoute } from "./device-notifications-routes.js";
import { handleDeviceQuickSettingsRoute } from "./device-quick-settings-routes.js";
import { handleDeviceLauncherAppsRoute } from "./device-launcher-apps-routes.js";
import { handleDeviceIconHelperRoute } from "./device-icon-helper-routes.js";
import { APP_VERSION } from "../config/version.js";
import { disconnectWirelessDevice } from "../services/adb-service.js";
import { getDeviceMirrorOptions } from "../services/device-mirror-options.js";
import { listDeviceCameras } from "../services/device-cameras.js";
import { listDeviceEncoders } from "../services/device-video-encoders.js";
import { sendProtectedJson } from "../utils/protected-http.js";

export async function handleDeviceRoute(req, res, method, pathname, url) {
  if (await handleDeviceAppRunningRoute(req, res, method, pathname)) {
    return true;
  }

  if (await handleDeviceAppStopRoute(req, res, method, pathname)) {
    return true;
  }

  if (await handleDeviceAppForceStopRoute(req, res, method, pathname)) {
    return true;
  }

  if (await handleDeviceAppsRoute(req, res, method, pathname, url)) {
    return true;
  }

  if (await handleDeviceIconHelperRoute(req, res, method, pathname)) {
    return true;
  }

  if (await handleDeviceLauncherAppsRoute(req, res, method, pathname, url)) {
    return true;
  }

  if (await handleDeviceNotificationsRoute(req, res, method, pathname, url)) {
    return true;
  }

  if (await handleDeviceQuickSettingsRoute(req, res, method, pathname)) {
    return true;
  }

  const mirrorOptionsMatch = pathname.match(/^\/api\/devices\/([^/]+)\/mirror-options$/);
  const videoEncodersMatch = pathname.match(/^\/api\/devices\/([^/]+)\/video-encoders$/);
  const camerasMatch = pathname.match(/^\/api\/devices\/([^/]+)\/cameras$/);

  if (await handleDeviceFilesRoute(req, res, method, pathname, url)) {
    return true;
  }

  if (method === "GET" && camerasMatch) {
    const serial = decodeURIComponent(camerasMatch[1]);

    try {
      const cameras = await listDeviceCameras(serial);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        cameras,
        requiresSdk: 31,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        serial,
        cameras: [],
        error: "cameras_list_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "GET" && videoEncodersMatch) {
    const serial = decodeURIComponent(videoEncodersMatch[1]);

    try {
      const { videoEncoders, audioEncoders } = await listDeviceEncoders(serial);

      const usedFallback = videoEncoders.some((item) =>
        String(item.label ?? "").includes("(fallback)"),
      );

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        videoEncoders,
        audioEncoders,
        warning: usedFallback
          ? "无法读取设备真实编码器列表，已使用通用列表；停止投屏后刷新页面可重试。"
          : undefined,
      });
    } catch (error) {
      const fallbackEncoders = error?.encoders;
      const status = fallbackEncoders?.length ? 200 : 500;

      sendProtectedJson(res, status, {
        success: status === 200,
        version: APP_VERSION,
        serial,
        videoEncoders: fallbackEncoders ?? [],
        warning: error instanceof Error ? error.message : "Unknown error",
        error: status === 500 ? "video_encoders_failed" : undefined,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  if (method === "GET" && mirrorOptionsMatch) {
    const serial = decodeURIComponent(mirrorOptionsMatch[1]);

    try {
      const options = await getDeviceMirrorOptions(serial);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial,
        ...options,
      });
    } catch (error) {
      sendProtectedJson(res, 500, {
        success: false,
        version: APP_VERSION,
        error: "Failed to load mirror options.",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  const deviceRootMatch = pathname.match(/^\/api\/devices\/([^/]+)$/);

  if (method === "DELETE" && deviceRootMatch) {
    const serial = decodeURIComponent(deviceRootMatch[1]);

    try {
      const result = await disconnectWirelessDevice(serial);

      sendProtectedJson(res, 200, {
        success: true,
        version: APP_VERSION,
        serial: result.serial,
        output: result.output,
      });
    } catch (error) {
      const code = error?.code;
      const status = code === "usb_device_not_disconnectable" ? 400 : 500;

      sendProtectedJson(res, status, {
        success: false,
        version: APP_VERSION,
        serial,
        error: code ?? "device_disconnect_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  }

  return false;
}
