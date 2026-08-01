import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";
import { hasCachedAppIcon, setCachedAppIcon } from "./device-app-icons.js";
import {
  fingerprintHelperApps,
  setCachedHelperApps,
  setIconHelperProgress,
} from "./icon-helper-cache.js";
import { iconHelperRemotePath } from "./icon-helper-paths.js";

/**
 * @param {string} serial
 * @param {string} relative
 */
export async function readRemoteJson(serial, relative) {
  const remote = iconHelperRemotePath(relative);
  const { stdout } = await runWithAdbLock(
    () =>
      runAdb(["-s", serial, "shell", "cat", remote], {
        timeout: 15_000,
        maxBuffer: 8 * 1024 * 1024,
      }),
    { lockKey: serial },
  );

  const text = String(stdout || "").trim();
  if (!text || text.includes("No such file")) {
    return null;
  }

  return JSON.parse(text);
}

/**
 * @param {string} serial
 * @param {{ onlyMissingIcons?: boolean }} [options]
 */
export async function ingestHelperOutputs(serial, options = {}) {
  const onlyMissingIcons = options.onlyMissingIcons !== false;
  const apps = await readRemoteJson(serial, "apps.json");
  if (!Array.isArray(apps)) {
    return [];
  }

  const remoteManifest = await readRemoteJson(serial, "manifest.json").catch(() => null);
  const normalized = [];

  for (const row of apps) {
    const packageName = String(row?.packageName || "").trim();
    if (!packageName) {
      continue;
    }

    const iconFile = row?.iconFile ? String(row.iconFile) : null;
    const iconHash = row?.iconHash ? String(row.iconHash) : null;
    if (iconFile) {
      const shouldPull =
        !onlyMissingIcons ||
        // When iconHash is available, detect "same package but icon changed".
        !hasCachedAppIcon(serial, packageName, iconHash);
      if (shouldPull) {
        const dataUrl = await pullHelperIconDataUrl(serial, iconFile).catch(() => null);
        if (dataUrl) {
          setCachedAppIcon(serial, packageName, dataUrl, iconHash);
        }
      }
    }

    normalized.push({
      packageName,
      activity: String(row?.activity || ""),
      label: String(row?.label || packageName),
      iconFile,
      iconHash,
    });
  }

  const fingerprint =
    String(remoteManifest?.fingerprint || "") || fingerprintHelperApps(normalized);
  setCachedHelperApps(serial, normalized, fingerprint);
  setIconHelperProgress(serial, {
    phase: "done",
    total: normalized.length,
    done: normalized.length,
    current: "",
    message: "complete",
    fingerprint,
  });

  return normalized;
}

/**
 * @param {string} serial
 * @param {string} relative
 */
async function pullHelperIconDataUrl(serial, relative) {
  const remote = iconHelperRemotePath(relative);
  const tmpPath = path.join(
    os.tmpdir(),
    `cloud-phone-helper-icon-${Date.now()}-${Math.random().toString(16).slice(2)}.png`,
  );

  try {
    await runWithAdbLock(
      () => runAdb(["-s", serial, "pull", remote, tmpPath], { timeout: 30_000 }),
      { lockKey: serial },
    );
    const bytes = await fs.readFile(tmpPath);
    if (!bytes.length) {
      return null;
    }
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}
