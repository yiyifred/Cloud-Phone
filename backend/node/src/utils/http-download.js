import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Download a URL into a Buffer.
 *
 * curl is preferred because it already understands HTTPS_PROXY, redirects and
 * corporate certificate stores on every host OS this project ships to. The
 * global fetch fallback keeps the endpoint usable when curl is not installed.
 */
export async function downloadBuffer(url, { maxBytes = 32 * 1024 * 1024, timeoutMs = 60000 } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-scrcpy-dl-"));
  const target = path.join(tmpDir, "asset.bin");

  try {
    const result = spawnSync(
      "curl",
      ["-fsSL", "--max-time", String(Math.round(timeoutMs / 1000)), "--max-filesize", String(maxBytes), "-o", target, url],
      { timeout: timeoutMs + 5000, encoding: "utf8" },
    );

    if (result.error?.code === "ENOENT") {
      return await fetchFallback(url, maxBytes);
    }

    if (result.status !== 0) {
      const detail = (result.stderr || result.error?.message || "").trim().split("\n").pop();
      throw new Error(`download failed: ${detail || `curl exit ${result.status}`}`);
    }

    const buffer = fs.readFileSync(target);

    if (!buffer.length) {
      throw new Error("download failed: empty body");
    }

    return { buffer, url };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function fetchFallback(url, maxBytes) {
  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > maxBytes) {
    throw new Error(`download too large (> ${maxBytes} bytes)`);
  }

  return { buffer, url };
}
