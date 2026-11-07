import { fetchEncryptedBinary, requestJson } from "./api.js";
import { putEncryptedBinary } from "./api-binary.js";

export async function fetchDeviceApps(serial) {
  const result = await requestJson(`/api/devices/${encodeURIComponent(serial)}/apps`);
  return result.apps ?? [];
}

export async function fetchDeviceAppDetail(serial, packageName) {
  const result = await requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}`,
  );
  return result.detail ?? null;
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<"portrait" | "landscape">}
 */
export async function fetchAppOrientation(serial, packageName) {
  const result = await requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/orientation`,
  );
  return result?.orientation === "landscape" ? "landscape" : "portrait";
}

export async function uninstallDeviceApp(serial, packageName) {
  return requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}?confirm=1`,
    { method: "DELETE" },
  );
}

export async function setDeviceAppFrozen(serial, packageName, frozen) {
  return requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/state`,
    {
      method: "POST",
      body: { frozen },
    },
  );
}

/** Soft exit then force-stop if still running (multi-app window close). */
export async function stopDeviceApp(serial, packageName) {
  return requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/stop`,
    { method: "POST" },
  );
}

export async function forceStopDeviceApp(serial, packageName) {
  return requestJson(
    `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/force-stop`,
    { method: "POST" },
  );
}

export async function downloadDeviceAppApk(serial, packageName, filenameHint) {
  const url = `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/apk`;
  const blob = await fetchEncryptedBinary(url, {
    mime: "application/vnd.android.package-archive",
  });
  const name =
    filenameHint ||
    `${String(packageName).replace(/[^\w.-]+/g, "_")}.apk`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function installDeviceApk(serial, file) {
  return putEncryptedBinary(`/api/devices/${encodeURIComponent(serial)}/apps/install`, file);
}
