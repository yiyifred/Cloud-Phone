import { SCRCPY_SERVER_VERSION } from "../config/scrcpy-paths.js";
import { adbExecOut, adbPush } from "./adb-command.js";
import { requireScrcpyServer } from "./scrcpy-build.js";
import { getRemoteJarPath } from "./scrcpy-cast/server-args.js";

const REMOTE_JAR_PATH = getRemoteJarPath();
const LIST_TIMEOUT_MS = 180_000;
const CACHE_TTL_MS = 60_000;

/** @type {Map<string, { expires: number, labels: Map<string, { label: string, system: boolean }> }>} */
const labelCache = new Map();

/**
 * Parse scrcpy server `LogUtils.buildAppListMessage()` output.
 * @param {string} stdout
 * @returns {Map<string, { label: string, system: boolean }>}
 */
export function parseScrcpyAppListOutput(stdout) {
  /** @type {Map<string, { label: string, system: boolean }>} */
  const apps = new Map();
  let inList = false;
  let pendingName = null;
  let pendingSystem = false;

  for (const rawLine of stdout.split(/\r?\n/)) {
    if (rawLine.includes("List of apps:")) {
      inList = true;
      continue;
    }

    if (!inList) {
      continue;
    }

    const entryMatch = rawLine.match(/^\s([*-])\s+(.*)$/);

    if (entryMatch) {
      pendingSystem = entryMatch[1] === "*";
      const rest = entryMatch[2].trim();
      const pkgOnLine = rest.match(/^(.+?)\s+([a-zA-Z][\w.]*)\s*$/);

      if (pkgOnLine) {
        apps.set(pkgOnLine[2], { label: pkgOnLine[1].trim(), system: pendingSystem });
        pendingName = null;
      } else {
        pendingName = rest;
      }

      continue;
    }

    if (pendingName !== null) {
      const pkgMatch = rawLine.match(/\s([a-zA-Z][\w.]*)\s*$/);

      if (pkgMatch) {
        apps.set(pkgMatch[1], { label: pendingName, system: pendingSystem });
        pendingName = null;
      }
    }
  }

  return apps;
}

export async function pushScrcpyServer(serial) {
  const jarPath = requireScrcpyServer();
  await adbPush(serial, jarPath, REMOTE_JAR_PATH);
}

/**
 * Same approach as `scrcpy --list-apps`, but lists every installed package via PackageManager.
 * @param {string} serial
 * @returns {Promise<Map<string, { label: string, system: boolean }>>}
 */
export async function fetchScrcpyAppLabels(serial) {
  const cached = labelCache.get(serial);

  if (cached && cached.expires > Date.now()) {
    return cached.labels;
  }

  await pushScrcpyServer(serial);

  const remoteCommand = [
    `CLASSPATH=${REMOTE_JAR_PATH}`,
    "app_process",
    "/",
    "com.genymobile.scrcpy.Server",
    SCRCPY_SERVER_VERSION,
    "list_all_apps=true",
  ].join(" ");

  const { stdout } = await adbExecOut(serial, remoteCommand, {
    timeout: LIST_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });

  const labels = parseScrcpyAppListOutput(stdout);

  labelCache.set(serial, {
    expires: Date.now() + CACHE_TTL_MS,
    labels,
  });

  return labels;
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
export async function fetchScrcpyAppLabel(serial, packageName) {
  const labels = await fetchScrcpyAppLabels(serial);
  return labels.get(packageName)?.label ?? "";
}
