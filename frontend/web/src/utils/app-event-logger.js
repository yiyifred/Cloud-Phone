import { reactive, readonly } from "vue";

import { fetchLogsPage } from "./local-persistence-api.js";
import {
  clearAllPersistedLogs,
  persistLogEntry,
  replaceCachedLogs,
} from "./local-persistence-state.js";

/** @typedef {"debug" | "info" | "warn" | "error"} LogLevel */
/** @typedef {"auth" | "navigation" | "device" | "cast" | "stream" | "settings" | "ui"} LogCategory */

export const LOG_LEVELS = ["debug", "info", "warn", "error"];
export const LOG_CATEGORIES = ["auth", "navigation", "device", "cast", "stream", "settings", "ui"];
export const LOG_PAGE_SIZE = 50;

let nextId = 1;
/** When true, newly written events are prepended to the in-memory UI list. */
let panelHydrated = false;

const state = reactive({
  entries: [],
  hasMore: false,
  nextBeforeId: null,
  loading: false,
});

function formatDisplayTime(date = new Date()) {
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeDetails(details) {
  if (details == null) {
    return null;
  }
  if (typeof details === "string") {
    return { text: details };
  }
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return { text: String(details) };
  }
}

function decorateServerEntry(entry) {
  const timestamp = entry?.timestamp ? new Date(entry.timestamp) : new Date();
  const id = Number(entry?.id) || nextId++;
  nextId = Math.max(nextId, id + 1);
  return {
    id,
    timestamp: entry?.timestamp || timestamp.toISOString(),
    displayTime: formatDisplayTime(Number.isNaN(timestamp.getTime()) ? new Date() : timestamp),
    level: entry?.level || "info",
    category: entry?.category || "ui",
    event: entry?.event || "event",
    message: entry?.message || "",
    details: normalizeDetails(entry?.details),
    // actor 由服务端按会话身份写入（admin / viewer:<分享标签>），客户端只展示不修改。
    actor: entry?.actor ? String(entry.actor) : null,
    deviceSerial: entry?.deviceSerial ?? null,
    deviceName: entry?.deviceName ?? null,
  };
}

function mergeUnique(front, back) {
  const seen = new Set();
  const out = [];
  for (const entry of [...front, ...back]) {
    const key = Number(entry?.id);
    if (!Number.isFinite(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * @param {object} input
 */
export function logAppEvent({
  level,
  category,
  event,
  message,
  details = null,
  deviceSerial = null,
  deviceName = null,
}) {
  const timestamp = new Date();
  const entry = {
    id: nextId++,
    timestamp: timestamp.toISOString(),
    displayTime: formatDisplayTime(timestamp),
    level,
    category,
    event,
    message,
    details: normalizeDetails(details),
    deviceSerial,
    deviceName,
  };

  if (panelHydrated) {
    state.entries.unshift(entry);
  }

  void persistLogEntry(entry);
  return entry;
}

export function logDebug(category, event, message, options = {}) {
  return logAppEvent({ level: "debug", category, event, message, ...options });
}

export function logInfo(category, event, message, options = {}) {
  return logAppEvent({ level: "info", category, event, message, ...options });
}

export function logWarn(category, event, message, options = {}) {
  return logAppEvent({ level: "warn", category, event, message, ...options });
}

export function logError(category, event, message, options = {}) {
  return logAppEvent({ level: "error", category, event, message, ...options });
}

export async function clearAppEventLog() {
  state.entries.length = 0;
  state.hasMore = false;
  state.nextBeforeId = null;
  panelHydrated = true;
  replaceCachedLogs([]);
  await clearAllPersistedLogs();
}

/** @deprecated Prefer loadAppEventLogPage / loadMoreAppEventLogs */
export function replaceAppEventLog(entries) {
  const nextEntries = Array.isArray(entries) ? entries.map(decorateServerEntry) : [];
  state.entries.splice(0, state.entries.length, ...nextEntries);
  replaceCachedLogs(nextEntries);
  panelHydrated = true;
  state.hasMore = false;
  state.nextBeforeId = null;
}

export async function loadAppEventLogPage() {
  if (state.loading) {
    return;
  }
  state.loading = true;
  try {
    const page = await fetchLogsPage({ limit: LOG_PAGE_SIZE });
    const decorated = page.logs.map(decorateServerEntry);
    state.entries.splice(0, state.entries.length, ...decorated);
    state.hasMore = page.hasMore;
    state.nextBeforeId = page.nextBeforeId;
    panelHydrated = true;
    replaceCachedLogs(state.entries);
  } finally {
    state.loading = false;
  }
}

export async function loadMoreAppEventLogs() {
  if (state.loading || !state.hasMore || state.nextBeforeId == null) {
    return;
  }
  state.loading = true;
  try {
    const page = await fetchLogsPage({
      limit: LOG_PAGE_SIZE,
      beforeId: state.nextBeforeId,
    });
    const decorated = page.logs.map(decorateServerEntry);
    state.entries.splice(0, state.entries.length, ...mergeUnique(state.entries, decorated));
    state.hasMore = page.hasMore;
    state.nextBeforeId = page.nextBeforeId;
    replaceCachedLogs(state.entries);
  } finally {
    state.loading = false;
  }
}

export function getAppEventLogState() {
  return readonly(state);
}

export function getAppEventLogEntries() {
  return state.entries;
}
