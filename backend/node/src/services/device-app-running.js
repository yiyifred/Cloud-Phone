import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";

/**
 * Multi-app window presence: still running, and whether on a virtual display.
 *
 * ADB / dumpsys failures must NOT be reported as "not running"
 * (that falsely closes windows during resize / cast lock contention).
 *
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<{
 *   running: boolean | null,
 *   onVirtualDisplay: boolean | null,
 *   displayIds: number[],
 *   visible: boolean | null,
 *   pid: number | null,
 *   reason: string,
 *   uncertain?: boolean,
 * }>}
 */
export async function getPackageRunningState(serial, packageName) {
  const pkg = String(packageName || "").trim();
  if (!pkg) {
    return {
      running: false,
      onVirtualDisplay: false,
      displayIds: [],
      visible: false,
      pid: null,
      reason: "invalid_package",
    };
  }

  let pid = null;
  let presence = null;
  let checkFailed = false;

  try {
    pid = await readPackagePid(serial, pkg);
  } catch {
    checkFailed = true;
  }

  try {
    presence = await readPackageActivityPresence(serial, pkg);
  } catch {
    checkFailed = true;
    presence = null;
  }

  if (presence?.hasActivity) {
    return {
      running: true,
      onVirtualDisplay: presence.onVirtualDisplay,
      displayIds: presence.displayIds,
      visible: true,
      pid,
      reason: presence.onVirtualDisplay ? "on_virtual_display" : "on_main_display",
    };
  }

  if (checkFailed || presence == null) {
    return {
      running: null,
      onVirtualDisplay: null,
      displayIds: [],
      visible: null,
      pid,
      uncertain: true,
      reason: "check_failed",
    };
  }

  if (pid) {
    return {
      running: false,
      onVirtualDisplay: false,
      displayIds: [],
      visible: false,
      pid,
      reason: "process_alive",
    };
  }

  return {
    running: false,
    onVirtualDisplay: false,
    displayIds: [],
    visible: false,
    pid: null,
    reason: "not_found",
  };
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
async function readPackagePid(serial, packageName) {
  const { stdout } = await runWithAdbLock(
    () =>
      runAdb(["-s", serial, "shell", "pidof", "-s", packageName], {
        timeout: 8_000,
      }),
    { lockKey: serial },
  );
  const raw = String(stdout || "").trim().split(/\s+/)[0];
  const pid = Number.parseInt(raw, 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
async function readPackageActivityPresence(serial, packageName) {
  const { stdout } = await runWithAdbLock(
    () =>
      runAdb(["-s", serial, "shell", "dumpsys", "activity", "activities"], {
        timeout: 20_000,
        maxBuffer: 6 * 1024 * 1024,
      }),
    { lockKey: serial },
  );
  return parsePackageActivityPresence(stdout, packageName);
}

/**
 * @param {string} stdout
 * @param {string} packageName
 * @returns {{ hasActivity: boolean, onVirtualDisplay: boolean, onMainDisplay: boolean, displayIds: number[] }}
 */
export function parsePackageActivityPresence(stdout, packageName) {
  const text = String(stdout || "");
  if (!text || !packageName) {
    return { hasActivity: false, onVirtualDisplay: false, onMainDisplay: false, displayIds: [] };
  }

  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const recordRe = new RegExp(`ActivityRecord\\{[^\\n]*\\b${escaped}/[^\\n]*`, "g");
  const records = text.match(recordRe) || [];
  const displayIds = [];

  for (const record of records) {
    if (/finishing=true|state=DESTROYED/i.test(record)) {
      continue;
    }
    const match = record.match(/display(?:Id)?=(\d+)/i);
    if (!match) {
      continue;
    }
    const id = Number.parseInt(match[1], 10);
    if (Number.isFinite(id) && !displayIds.includes(id)) {
      displayIds.push(id);
    }
  }

  const resumedRe = new RegExp(
    `(?:topResumedActivity|mResumedActivity|ResumedActivity)[^\\n]*\\b${escaped}/`,
    "i",
  );
  const hasResumed = resumedRe.test(text);
  const hasActivity = displayIds.length > 0 || hasResumed || records.some((record) => {
    if (/finishing=true|state=DESTROYED/i.test(record)) {
      return false;
    }
    return /mVisible=true|isVisible=true|state=(?:RESUMED|STARTED|PAUSED|STOPPED)/i.test(record);
  });

  // Only report "left VD" when we positively see activities on display 0 only.
  // Missing displayId in dumpsys must not trigger relaunch.
  let onVirtualDisplay = false;
  if (displayIds.some((id) => id > 0)) {
    onVirtualDisplay = true;
  } else if (displayIds.includes(0)) {
    onVirtualDisplay = false;
  } else if (hasActivity) {
    onVirtualDisplay = true;
  }
  const onMainDisplay = displayIds.includes(0);

  return { hasActivity, onVirtualDisplay, onMainDisplay, displayIds };
}

/**
 * @deprecated Prefer parsePackageActivityPresence
 * @param {string} stdout
 * @param {string} packageName
 */
export function parsePackageVisibleInActivities(stdout, packageName) {
  return parsePackageActivityPresence(stdout, packageName).hasActivity;
}
