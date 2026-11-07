import { requestJson } from "./api.js";

async function blobToBase64(bytesOrBlob) {
  const blob =
    bytesOrBlob instanceof Blob
      ? bytesOrBlob
      : new Blob([bytesOrBlob], { type: "application/octet-stream" });
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/** PUT encrypted JSON envelope `{ data: base64, ...extra }` (APK / file upload). */
export async function putEncryptedBinary(url, bytesOrBlob, extra = {}) {
  const data = await blobToBase64(bytesOrBlob);
  return requestJson(url, {
    method: "PUT",
    body: { data, ...extra },
  });
}
