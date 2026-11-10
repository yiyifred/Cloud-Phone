import { fetchWithLanFallback, parseEncryptedFetchResponse, requestJson } from "./api.js";

export function getScrcpyServerStatus() {
  return requestJson("/api/scrcpy/server");
}

async function postRawFile(url, file) {
  const response = await fetchWithLanFallback(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  const result = await parseEncryptedFetchResponse(response);

  if (!response.ok || result?.success === false) {
    throw new Error(result?.message ?? `安装失败（HTTP ${response.status}）`);
  }

  return result;
}

export function uploadScrcpyServerJar(file) {
  return postRawFile("/api/scrcpy/server/upload", file);
}

export function downloadScrcpyServer(source) {
  return requestJson("/api/scrcpy/server/download", {
    method: "POST",
    body: { source },
  });
}
