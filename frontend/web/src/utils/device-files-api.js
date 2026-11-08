import { DEVICE_FILES_DEFAULT_OPEN } from "./device-file-path.js";
import {
  fetchWithLanFallback,
  parseEncryptedFetchResponse,
  requestJson,
} from "./api.js";
import { putRawFileBody } from "./api-binary.js";

export async function fetchDeviceFiles(serial, devicePath = DEVICE_FILES_DEFAULT_OPEN) {
  const params = new URLSearchParams({ path: devicePath });
  return requestJson(`/api/devices/${encodeURIComponent(serial)}/files?${params}`);
}

/**
 * Download goes through the byte stream, so the body is never base64 in page
 * memory: `response.blob()` hands the browser the bytes and objectURL saves it.
 */
export async function downloadDeviceFile(serial, devicePath, filenameHint) {
  const params = new URLSearchParams({ path: devicePath });
  const response = await fetchWithLanFallback(
    `/api/devices/${encodeURIComponent(serial)}/files/download?${params}`,
    { method: "POST", credentials: "include" },
  );

  const contentType = response.headers.get("content-type") ?? "";

  // Errors keep the encrypted JSON envelope (401 included), so let the shared
  // helper decrypt, surface "session expired", and raise the server message.
  if (contentType.includes("application/json")) {
    const result = await parseEncryptedFetchResponse(response);
    throw new Error(result?.message ?? result?.error ?? "下载失败。");
  }

  if (!response.ok) {
    throw new Error(`下载失败（HTTP ${response.status}）。`);
  }

  const fileBlob = await response.blob();
  const name =
    filenameHint || devicePath.split("/").filter(Boolean).pop() || "download";
  const objectUrl = URL.createObjectURL(fileBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function uploadDeviceFile(serial, devicePath, file) {
  const params = new URLSearchParams({ path: devicePath });
  return putRawFileBody(
    `/api/devices/${encodeURIComponent(serial)}/files/upload?${params}`,
    file,
  );
}
