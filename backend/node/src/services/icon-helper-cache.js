import { createHash } from "node:crypto";

import { hasCachedAppIcon } from "./device-app-icons.js";

/**
 * @typedef {{ packageName: string, activity: string, label: string, iconFile: string | null, iconHash: string | null }} HelperAppRow
 * @typedef {{ phase: string, total: number, done: number, current: string, message: string, updatedAt: number, fingerprint?: string }} HelperProgress
 */

/** @type {Map<string, { apps: HelperAppRow[], fingerprint: string, expires: number }>} */
const appsSnapshotCache = new Map();

/** @type {Map<string, HelperProgress>} */
const progressCache = new Map();

/** @type {Set<string>} */
const extractInFlight = new Set();

/** Keep snapshots until fingerprint changes (long TTL as safety net). */
const APPS_TTL_MS = 24 * 60 * 60_000;

/**
 * @param {HelperAppRow[]} apps
 */
export function fingerprintHelperApps(apps) {
  const rows = (apps || [])
    .map((item) => `${item.packageName}|${item.activity || ""}|${item.label || ""}|${item.iconHash || ""}`)
    .sort();
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

/**
 * @param {string} serial
 */
export function getCachedHelperApps(serial) {
  const hit = appsSnapshotCache.get(serial);
  if (!hit || hit.expires < Date.now()) {
    return null;
  }
  return hit.apps;
}

/**
 * @param {string} serial
 */
export function getCachedHelperFingerprint(serial) {
  const hit = appsSnapshotCache.get(serial);
  if (!hit || hit.expires < Date.now()) {
    return "";
  }
  return hit.fingerprint || "";
}

/**
 * @param {string} serial
 * @returns {string[]}
 */
export function getCachedHelperPackages(serial) {
  const apps = getCachedHelperApps(serial) || [];
  return apps
    .map((item) => String(item?.packageName || "").trim())
    .filter(Boolean)
    .sort();
}

/**
 * @param {string} serial
 * @param {HelperAppRow[]} apps
 * @param {string} [fingerprint]
 */
export function setCachedHelperApps(serial, apps, fingerprint = "") {
  const fp = fingerprint || fingerprintHelperApps(apps);
  appsSnapshotCache.set(serial, {
    apps,
    fingerprint: fp,
    expires: Date.now() + APPS_TTL_MS,
  });
  return fp;
}

/**
 * @param {string} serial
 */
export function getIconHelperProgress(serial) {
  return (
    progressCache.get(serial) ?? {
      phase: "idle",
      total: 0,
      done: 0,
      current: "",
      message: "",
      updatedAt: 0,
      fingerprint: "",
    }
  );
}

/**
 * @param {string} serial
 * @param {HelperProgress} progress
 */
export function setIconHelperProgress(serial, progress) {
  progressCache.set(serial, { ...progress, updatedAt: Date.now() });
}

/**
 * @param {string} serial
 */
export function isExtractInFlight(serial) {
  return extractInFlight.has(serial);
}

/**
 * @param {string} serial
 */
export function markExtractInFlight(serial) {
  extractInFlight.add(serial);
}

/**
 * @param {string} serial
 */
export function clearExtractInFlight(serial) {
  extractInFlight.delete(serial);
}

/**
 * @param {string} serial
 * @param {HelperAppRow[]} apps
 */
export function allHelperIconsCached(serial, apps) {
  if (!apps?.length) {
    return false;
  }
  return apps.every(
    (item) => !item.iconFile || hasCachedAppIcon(serial, item.packageName, item.iconHash),
  );
}
