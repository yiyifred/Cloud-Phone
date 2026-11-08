import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { BACKEND_DATA_PATH } from "../config/paths.js";

const DATABASE_PATH = path.resolve(BACKEND_DATA_PATH, "cloud-phone.db");
const MAX_LOG_ENTRIES = 5000;
const DEFAULT_LOG_PAGE_SIZE = 50;
const MAX_LOG_PAGE_SIZE = 200;
/** 单条日志的 message 上限；日志会被前端整页加载，防止单条超长文本拖垮渲染与传输。 */
const MAX_LOG_MESSAGE_LENGTH = 4096;
/** details 序列化后的上限；超长对象同样会放大存储与响应体积。 */
const MAX_LOG_DETAILS_LENGTH = 16384;
const DEFAULT_LOG_ACTOR = "local";
/** actor 是身份标签（admin / viewer:<分享标签>），不需要长文本。 */
const MAX_LOG_ACTOR_LENGTH = 64;

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
    actor TEXT DEFAULT 'local',
    device_serial TEXT,
    device_name TEXT
  );
`);

/**
 * 存量库升级：CREATE TABLE IF NOT EXISTS 不会给已存在的表补列，
 * 因此用 PRAGMA 探测后再 ALTER。DEFAULT 'local' 让历史行为保持可解释。
 */
function ensureActorColumn() {
  const columns = database.prepare("PRAGMA table_info(app_event_logs)").all();
  const hasActor = columns.some((column) => String(column.name) === "actor");

  if (hasActor) {
    return;
  }

  database.exec("ALTER TABLE app_event_logs ADD COLUMN actor TEXT DEFAULT 'local'");
}

ensureActorColumn();

const insertLogStatement = database.prepare(`
  INSERT INTO app_event_logs (
    timestamp, level, category, event, message, details, actor, device_serial, device_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectLogsStatement = database.prepare(`
  SELECT id, timestamp, level, category, event, message, details, actor, device_serial, device_name
  FROM app_event_logs
  ORDER BY id DESC
  LIMIT ?
`);
const selectLogsBeforeStatement = database.prepare(`
  SELECT id, timestamp, level, category, event, message, details, actor, device_serial, device_name
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

/** 超长文本按字符截断（不切坏代理对，避免写出非法 UTF-8 片段）。 */
function truncateText(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }

  let end = maxLength;
  const lastCode = text.charCodeAt(end - 1);

  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    end -= 1;
  }

  return text.slice(0, end);
}

/**
 * details 序列化 + 截断。
 *
 * 为什么截断后要包一层 { truncated: true, excerpt }：
 * 直接截断 JSON 字符串会得到非法 JSON，前端 JSON.parse 会整页报错；
 * 包成对象后 details 始终合法，同时用 truncated 标记让使用者知道内容不完整。
 */
function serializeDetails(value) {
  if (value == null) {
    return null;
  }

  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    // 循环引用 / BigInt 等无法序列化的输入：保留标记而不是抛错中断整条日志。
    return JSON.stringify({ truncated: true, reason: "unserializable" });
  }

  if (typeof serialized !== "string") {
    return null;
  }

  if (serialized.length <= MAX_LOG_DETAILS_LENGTH) {
    return serialized;
  }

  const overhead = JSON.stringify({ truncated: true, excerpt: "" }).length;
  let budget = Math.max(0, MAX_LOG_DETAILS_LENGTH - overhead);
  let result = JSON.stringify({ truncated: true, excerpt: serialized.slice(0, budget) });

  // 重新转义会让长度膨胀（引号、反斜杠），必要时继续收缩，保证最终不超过上限。
  while (result.length > MAX_LOG_DETAILS_LENGTH && budget > 0) {
    budget = Math.floor(budget / 2);
    result = JSON.stringify({ truncated: true, excerpt: serialized.slice(0, budget) });
  }

  return result;
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
    actor: row.actor ? String(row.actor) : DEFAULT_LOG_ACTOR,
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
    truncateText(normalizeString(entry.message, ""), MAX_LOG_MESSAGE_LENGTH),
    serializeDetails(entry.details),
    truncateText(normalizeString(entry.actor, DEFAULT_LOG_ACTOR), MAX_LOG_ACTOR_LENGTH),
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
