import { DEVICE_FILES_DEFAULT_OPEN } from "./device-file-path.js";
import { requestJson } from "./api.js";
import { putEncryptedBinary } from "./api-binary.js";

export async function fetchDeviceFiles(serial, devicePath = DEVICE_FILES_DEFAULT_OPEN) {
  const params = new URLSearchParams({ path: devicePath });
  return requestJson(`/api/devices/${encodeURIComponent(serial)}/files?${params}`);
}

export async function downloadDeviceFile(serial, devicePath, filenameHint) {
  const result = await requestJson(`/api/devices/${encodeURIComponent(serial)}/files/download`, {
    method: "POST",
    body: { path: devicePath },
  });

  if (!result?.data) {
    throw new Error("缺少加密文件数据。");
  }

  const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
  const mime = result.contentType ?? "application/octet-stream";
  const fileBlob = new Blob([bytes], { type: mime });
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
  return putEncryptedBinary(
    `/api/devices/${encodeURIComponent(serial)}/files/upload`,
    file,
    { path: devicePath },
  );
}
