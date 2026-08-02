import {
  appendPersistedLog,
  clearPersistedLogs,
  fetchLocalPersistence,
  fetchPublicPreferences,
  saveLocalPersistencePatch,
  savePublicPreferences,
} from "./local-persistence-api.js";

const LEGACY_SETTINGS_KEY = "cloud-phone-settings";
const LEGACY_THEME_KEY = "cloud-phone-theme";
const LEGACY_LOCALE_KEY = "cloud-phone-locale";
const LEGACY_GROUP_GRID_KEY = "cloud-phone.group-control.grid";
const LEGACY_GROUP_ACTIVE_KEY = "cloud-phone.group-control.active";
const LEGACY_GROUP_SERIALS_KEY = "cloud-phone.group-control.serials";

const ICON_PREF_KEY = "cloud-phone.icon-helper.preference";
const ICON_PREF_FULL_KEY = "cloud-phone.icon-helper.preference";
const ICON_CONSENT_PREFIX = "cloud-phone.icon-helper.consent.";
const ICON_DENY_COUNT_PREFIX = "cloud-phone.icon-helper.deny-count.";
const ICON_FIRST_SETUP_PREFIX = "cloud-phone.icon-helper.first-setup.";

const state = {
  settings: {
    deviceListIntervalSeconds: 1,
    screenshotIntervalSeconds: 5,
    theme: "light",
    locale: "zh-CN",
  },
  runtimeState: {
    activeTab: "devices",
    selectedDeviceSerial: "",
    groupControlGridSerials: [],
    groupControlActiveSerials: [],
  },
  logs: [],
  preferencesHydrated: false,
  localHydrated: false,
};

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function setSettings(next = {}) {
  state.settings = {
    ...state.settings,
    ...next,
  };
}

function setRuntimeState(next = {}) {
  state.runtimeState = {
    ...state.runtimeState,
    ...next,
    groupControlGridSerials: normalizeStringArray(
      next.groupControlGridSerials ?? state.runtimeState.groupControlGridSerials,
    ),
    groupControlActiveSerials: normalizeStringArray(
      next.groupControlActiveSerials ?? state.runtimeState.groupControlActiveSerials,
    ),
  };
}

function readLegacySettingsPatch() {
  if (typeof localStorage === "undefined") {
    return {};
  }
  const patch = {};
  const settings = safeJsonParse(localStorage.getItem(LEGACY_SETTINGS_KEY), null);
  if (settings && typeof settings === "object") {
    if (settings.deviceListIntervalSeconds != null) {
      patch.deviceListIntervalSeconds = settings.deviceListIntervalSeconds;
    }
    if (settings.screenshotIntervalSeconds != null) {
      patch.screenshotIntervalSeconds = settings.screenshotIntervalSeconds;
    }
  }
  const theme = String(localStorage.getItem(LEGACY_THEME_KEY) || "").trim();
  if (theme) {
    patch.theme = theme;
  }
  const locale = String(localStorage.getItem(LEGACY_LOCALE_KEY) || "").trim();
  if (locale) {
    patch.locale = locale;
  }
  return patch;
}

function readLegacyRuntimePatch() {
  if (typeof localStorage === "undefined") {
    return {};
  }
  let grid = safeJsonParse(localStorage.getItem(LEGACY_GROUP_GRID_KEY), null);
  const active = safeJsonParse(localStorage.getItem(LEGACY_GROUP_ACTIVE_KEY), null);
  if (!Array.isArray(grid)) {
    const legacy = safeJsonParse(localStorage.getItem(LEGACY_GROUP_SERIALS_KEY), null);
    if (Array.isArray(legacy)) {
      grid = legacy;
    }
  }
  const patch = {};
  if (Array.isArray(grid)) {
    patch.groupControlGridSerials = normalizeStringArray(grid);
  }
  if (Array.isArray(active)) {
    patch.groupControlActiveSerials = normalizeStringArray(active);
  }

  // Migrate Icon Helper consent preferences from browser localStorage.
  if (typeof localStorage !== "undefined") {
    const iconUpdates = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key === ICON_PREF_FULL_KEY
        || key.startsWith(ICON_CONSENT_PREFIX)
        || key.startsWith(ICON_DENY_COUNT_PREFIX)
        || key.startsWith(ICON_FIRST_SETUP_PREFIX)
      ) {
        iconUpdates[key] = localStorage.getItem(key);
      }
    }
    Object.assign(patch, iconUpdates);
  }
  return patch;
}

function clearLegacyBrowserPersistence() {
  if (typeof localStorage === "undefined") {
    return;
  }
  for (const key of [
    LEGACY_SETTINGS_KEY,
    LEGACY_THEME_KEY,
    LEGACY_LOCALE_KEY,
    LEGACY_GROUP_GRID_KEY,
    LEGACY_GROUP_ACTIVE_KEY,
    LEGACY_GROUP_SERIALS_KEY,
    ICON_PREF_FULL_KEY,
  ]) {
    localStorage.removeItem(key);
  }

  // Also remove per-serial icon helper keys by prefix.
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith(ICON_CONSENT_PREFIX)
      || key.startsWith(ICON_DENY_COUNT_PREFIX)
      || key.startsWith(ICON_FIRST_SETUP_PREFIX)
    ) {
      localStorage.removeItem(key);
    }
  }
}

export function getCachedSettings() {
  return { ...state.settings };
}

export function getCachedRuntimeState() {
  return {
    ...state.runtimeState,
    groupControlGridSerials: [...state.runtimeState.groupControlGridSerials],
    groupControlActiveSerials: [...state.runtimeState.groupControlActiveSerials],
  };
}

export function getCachedLogs() {
  return [...state.logs];
}

export function replaceCachedLogs(entries = []) {
  state.logs = Array.isArray(entries) ? [...entries] : [];
}

export async function hydratePublicPreferences() {
  const preferences = await fetchPublicPreferences();
  setSettings({
    theme: preferences.theme ?? state.settings.theme,
    locale: preferences.locale ?? state.settings.locale,
  });
  state.preferencesHydrated = true;
  return getCachedSettings();
}

export function hydratePublicPreferencesFromCache() {
  return getCachedSettings();
}

export async function persistPublicPreferences(patch) {
  setSettings(patch);
  const preferences = await savePublicPreferences({
    theme: patch.theme,
    locale: patch.locale,
  });
  setSettings(preferences);
  return getCachedSettings();
}

export async function hydrateLocalPersistence() {
  const payload = await fetchLocalPersistence();
  setSettings(payload.settings);
  setRuntimeState(payload.runtimeState);
  replaceCachedLogs(payload.logs);
  state.localHydrated = true;
  return {
    settings: getCachedSettings(),
    runtimeState: getCachedRuntimeState(),
    logs: getCachedLogs(),
  };
}

export async function persistLocalStatePatch(payload) {
  if (payload?.settings) {
    setSettings(payload.settings);
  }
  if (payload?.runtimeState) {
    setRuntimeState(payload.runtimeState);
  }
  const saved = await saveLocalPersistencePatch(payload);
  setSettings(saved.settings);
  setRuntimeState(saved.runtimeState);
  return {
    settings: getCachedSettings(),
    runtimeState: getCachedRuntimeState(),
  };
}

export async function migrateLegacyBrowserPersistence() {
  const settingsPatch = readLegacySettingsPatch();
  const runtimePatch = readLegacyRuntimePatch();
  if (!Object.keys(settingsPatch).length && !Object.keys(runtimePatch).length) {
    return false;
  }
  await persistLocalStatePatch({
    settings: settingsPatch,
    runtimeState: runtimePatch,
  });
  clearLegacyBrowserPersistence();
  return true;
}

export async function persistLogEntry(entry) {
  await appendPersistedLog(entry);
}

export async function clearAllPersistedLogs() {
  state.logs = [];
  await clearPersistedLogs();
}
