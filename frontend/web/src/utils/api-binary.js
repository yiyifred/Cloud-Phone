import {
  fetchWithLanFallback,
  parseEncryptedFetchResponse,
  requestJson,
} from "./api.js";

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

/**
 * PUT the bytes themselves as the request body (no base64 envelope).
 *
 * `File`/`Blob` bodies are streamed by the browser and never base64-inflated in
 * page memory, which is what the file upload path needs. The response is still
 * the normal encrypted JSON envelope, so session-expiry handling is shared.
 */
export async function putRawFileBody(url, file) {
  if (typeof Blob === "undefined" || !(file instanceof Blob)) {
    throw new Error("上传内容无效，请重新选择文件。");
  }

  const response = await fetchWithLanFallback(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  let result;

  try {
    result = await parseEncryptedFetchResponse(response);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`上传失败（HTTP ${response.status}）。`);
    }

    throw error;
  }

  if (!response.ok || result?.success === false) {
    throw new Error(result?.message ?? result?.error ?? `上传失败（HTTP ${response.status}）。`);
  }

  return result;
}
