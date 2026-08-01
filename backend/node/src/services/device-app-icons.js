/**
 * Cached icon binary as dataUrl plus a stable hash for change detection.
 * Hash comes from Android Icon Helper.
 *
 * @type {Map<string, string | null>}
 */
const iconDataCache = new Map();

/**
 * @type {Map<string, string | null>}
 */
const iconHashCache = new Map();

/** @type {Set<string>} */
const iconLoading = new Set();

/**
 * @param {string} serial
 * @param {string} packageName
 */
export function getCachedAppIcon(serial, packageName) {
  return iconDataCache.get(iconCacheKey(serial, packageName)) ?? null;
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @param {string | null} iconDataUrl
 * @param {string | null} iconHash
 */
export function setCachedAppIcon(serial, packageName, iconDataUrl, iconHash) {
  const key = iconCacheKey(serial, packageName);
  iconDataCache.set(key, iconDataUrl);
  iconHashCache.set(key, iconHash ?? null);
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @param {string | null} [expectedIconHash]
 */
export function hasCachedAppIcon(serial, packageName, expectedIconHash = null) {
  const key = iconCacheKey(serial, packageName);
  const dataUrl = iconDataCache.get(key);
  if (!(typeof dataUrl === "string" && dataUrl.length > 0)) {
    return false;
  }
  if (!expectedIconHash) {
    return true;
  }
  return iconHashCache.get(key) === expectedIconHash;
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @returns {string | null}
 */
export function getCachedAppIconHash(serial, packageName) {
  return iconHashCache.get(iconCacheKey(serial, packageName)) ?? null;
}

/**
 * @param {string} serial
 * @param {string[]} packages
 */
export function removeCachedAppIcons(serial, packages) {
  for (const packageName of packages || []) {
    const key = iconCacheKey(serial, packageName);
    iconDataCache.delete(key);
    iconHashCache.delete(key);
  }
}

/**
 * Load icons that were already extracted by Icon Helper (cache only).
 * Full APK pull extraction has been removed in favor of the helper service.
 *
 * @param {string} serial
 * @param {string[]} packages
 */
export async function loadMissingAppIcons(serial, packages) {
  for (const packageName of packages) {
    const key = iconCacheKey(serial, packageName);
    if (!iconDataCache.has(key)) {
      iconDataCache.set(key, null);
      iconHashCache.set(key, null);
    }
  }
}

/**
 * @param {string} serial
 * @param {string[]} packages
 * @param {number} [limit]
 */
export function warmupMissingAppIcons(serial, packages, limit = 4) {
  void serial;
  void packages;
  void limit;
  // Icons are populated by icon-helper extract ingest; no background APK pulls.
}

/**
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<string | null>}
 */
export async function loadOneAppIcon(serial, packageName) {
  const key = iconCacheKey(serial, packageName);
  if (iconDataCache.has(key)) {
    return iconDataCache.get(key) ?? null;
  }

  iconLoading.add(key);
  try {
    iconDataCache.set(key, null);
    iconHashCache.set(key, null);
    return null;
  } finally {
    iconLoading.delete(key);
  }
}

function iconCacheKey(serial, packageName) {
  return `${serial}::${packageName}`;
}
