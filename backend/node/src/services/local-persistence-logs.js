import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { BACKEND_DATA_PATH } from "../config/paths.js";

const DATABASE_PATH = path.resolve(BACKEND_DATA_PATH, "cloud-phone.db");
const MAX_LOG_ENTRIES = 5000;
const DEFAULT_LOG_PAGE_SIZE = 50;
const MAX_LOG_PAGE_SIZE = 200;

const database = new DatabaseSync(DATABASE_PATH);
database.exec(`
  CREATE TABLE IF NOT EXISTS app_event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    event TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    device_serial TEXT,
    device_name TEXT
  );
`);

const insertLogStatement = database.prepare(`
  INSERT INTO app_event_logs (
    timestamp, level, category, event, message, details, device_serial, device_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectLogsStatement = database.prepare(`
  SELECT id, timestamp, level, category, event, message, details, device_serial, device_name
  FROM app_event_logs
  ORDER BY id DESC
  LIMIT ?
`);
const selectLogsBeforeStatement = database.prepare(`
  SELECT id, timestamp, level, category, event, message, details, device_serial, device_name
  FROM app_event_logs
  WHERE id < ?
  ORDER BY id DESC
  LIMIT ?
`);
const clearLogsStatement = database.prepare("DELETE FROM app_event_logs");
const trimLogsStatement = database.prepare(`
  DELETE FROM app_event_logs
  WHERE id NOT IN (
    SELECT id FROM app_event_logs ORDER BY id DESC LIMIT ?
  )
`);

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeString(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function mapLogRow(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    category: row.category,
    event: row.event,
    message: row.message,
    details: row.details ? safeParseJson(row.details, null) : null,
    deviceSerial: row.device_serial,
    deviceName: row.device_name,
  };
}

function trimLogsIfNeeded() {
  trimLogsStatement.run(MAX_LOG_ENTRIES);
}

export function appendStoredLog(entry = {}) {
  const timestamp = String(entry.timestamp || new Date().toISOString());
  insertLogStatement.run(
    timestamp,
    normalizeString(entry.level, "info"),
    normalizeString(entry.category, "ui"),
    normalizeString(entry.event, "event"),
    normalizeString(entry.message, ""),
    entry.details == null ? null : JSON.stringify(entry.details),
    entry.deviceSerial ? String(entry.deviceSerial) : null,
    entry.deviceName ? String(entry.deviceName) : null,
  );
  trimLogsIfNeeded();
}

/** @param {number} [limit] */
export function listStoredLogs(limit = 2000) {
  const rows = selectLogsStatement.all(Math.min(MAX_LOG_ENTRIES, Math.max(1, Number(limit) || 2000)));
  return rows.map(mapLogRow);
}

/**
 * Newest-first cursor page.
 * @param {{ limit?: number, beforeId?: number|null }} [options]
 */
export function listStoredLogsPage(options = {}) {
  const safeLimit = Math.min(
    MAX_LOG_PAGE_SIZE,
    Math.max(1, Math.round(Number(options.limit) || DEFAULT_LOG_PAGE_SIZE)),
  );
  const beforeRaw = options.beforeId;
  const beforeId = beforeRaw == null || beforeRaw === "" ? null : Number(beforeRaw);
  const fetchLimit = safeLimit + 1;

  const rows =
    beforeId != null && Number.isFinite(beforeId) && beforeId > 0
      ? selectLogsBeforeStatement.all(beforeId, fetchLimit)
      : selectLogsStatement.all(fetchLimit);

  const hasMore = rows.length > safeLimit;
  const page = hasMore ? rows.slice(0, safeLimit) : rows;
  const logs = page.map(mapLogRow);
  const nextBeforeId = hasMore && logs.length > 0 ? logs[logs.length - 1].id : null;

  return { logs, nextBeforeId, hasMore, limit: safeLimit };
}

export function clearStoredLogs() {
  clearLogsStatement.run();
}

export { DEFAULT_LOG_PAGE_SIZE, MAX_LOG_PAGE_SIZE };
