import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BACKEND_DATA_PATH } from "../config/paths.js";

const DATABASE_PATH = path.resolve(BACKEND_DATA_PATH, "cloud-phone.db");
const KEY_PATH = path.resolve(BACKEND_DATA_PATH, "auth.key");

const DATA_DIRECTORY_MODE = 0o700;
const DATA_FILE_MODE = 0o600;

/**
 * 启动即收敛数据目录与密钥/数据库文件权限。
 *
 * 为什么单独抽一个函数并且只在顶部调用一次：
 * - mkdirSync 的 mode 只对「本次新建」的目录生效，存量目录仍是旧权限，必须 chmod 纠正；
 * - 数据库文件由 sqlite 打开时按 umask 创建（常见 0644/0666），因此先用 0600 预创建一次，
 *   让 sqlite 打开的是已有文件，避免出现权限过于宽松的窗口期；
 * - Windows 没有 POSIX 权限位，chmod 会失败，这里只 warn 不 throw，加固动作不能阻止服务启动。
 */
function ensureSecurePermissions() {
  try {
    fs.mkdirSync(BACKEND_DATA_PATH, { recursive: true, mode: DATA_DIRECTORY_MODE });
    fs.chmodSync(BACKEND_DATA_PATH, DATA_DIRECTORY_MODE);
  } catch (error) {
    console.warn("[auth] 数据目录权限加固失败（Windows 无权限位属正常）：", error?.message ?? error);
  }

  try {
    // "a" 打开不会截断已有数据库；mode 仅在文件不存在时生效。
    fs.closeSync(fs.openSync(DATABASE_PATH, "a", DATA_FILE_MODE));
    fs.chmodSync(DATABASE_PATH, DATA_FILE_MODE);
  } catch (error) {
    console.warn("[auth] 数据库文件权限加固失败：", error?.message ?? error);
  }

  try {
    if (fs.existsSync(KEY_PATH)) {
      fs.chmodSync(KEY_PATH, DATA_FILE_MODE);
    }
  } catch (error) {
    console.warn("[auth] 密钥文件权限加固失败：", error?.message ?? error);
  }
}

ensureSecurePermissions();

const database = new DatabaseSync(DATABASE_PATH);
database.exec(`
  CREATE TABLE IF NOT EXISTS auth_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    encryption_key TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

const selectSettingStatement = database.prepare(
  "SELECT value, updated_at FROM auth_settings WHERE key = ?",
);
const upsertSettingStatement = database.prepare(`
  INSERT INTO auth_settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);
const upsertSessionStatement = database.prepare(`
  INSERT INTO auth_sessions (token, encryption_key, expires_at)
  VALUES (?, ?, ?)
  ON CONFLICT(token) DO UPDATE SET
    encryption_key = excluded.encryption_key,
    expires_at = excluded.expires_at
`);
const selectAllSessionsStatement = database.prepare(
  "SELECT token, encryption_key, expires_at FROM auth_sessions",
);
const deleteSessionStatement = database.prepare("DELETE FROM auth_sessions WHERE token = ?");
const clearSessionsStatement = database.prepare("DELETE FROM auth_sessions");

const encryptionKey = loadOrCreateEncryptionKey();

export function getAuthKeyMaterial() {
  return encryptionKey;
}

export function getPasswordRecord() {
  const row = selectSettingStatement.get("password_record");

  if (!row) {
    return null;
  }

  try {
    const decrypted = decryptValue(row.value);
    return {
      ...JSON.parse(decrypted),
      updatedAt: row.updated_at,
    };
  } catch {
    console.warn("[auth] Password record is unreadable. Treating as not configured.");
    return null;
  }
}

export function savePasswordRecord(record) {
  const timestamp = new Date().toISOString();
  const encryptedValue = encryptValue(
    JSON.stringify({
      algorithm: record.algorithm,
      salt: record.salt,
      hash: record.hash,
    }),
  );

  upsertSettingStatement.run("password_record", encryptedValue, timestamp);

  return {
    ...record,
    updatedAt: timestamp,
  };
}

export function upsertPersistedSession(token, encryptionKeyBuffer, expiresAtIso) {
  upsertSessionStatement.run(
    token,
    encryptValue(encryptionKeyBuffer.toString("base64")),
    expiresAtIso,
  );
}

export function listPersistedSessions() {
  const rows = selectAllSessionsStatement.all();
  const out = [];

  for (const row of rows) {
    try {
      const encryptionKey = Buffer.from(decryptValue(row.encryption_key), "base64");
      out.push({
        token: row.token,
        encryptionKey,
        expiresAt: new Date(row.expires_at).getTime(),
      });
    } catch {
      deleteSessionStatement.run(row.token);
    }
  }

  return out;
}

export function deletePersistedSession(token) {
  if (token) {
    deleteSessionStatement.run(token);
  }
}

export function clearPersistedSessions() {
  clearSessionsStatement.run();
}

function loadOrCreateEncryptionKey() {
  if (fs.existsSync(KEY_PATH)) {
    return fs.readFileSync(KEY_PATH);
  }

  const nextKey = crypto.randomBytes(32);
  // 显式 0600：密钥一旦被同组/其他用户读到，加密的密码库与会话等同于明文。
  fs.writeFileSync(KEY_PATH, nextKey, { mode: DATA_FILE_MODE });
  return nextKey;
}

function encryptValue(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  });
}

function decryptValue(serializedValue) {
  const payload = JSON.parse(serializedValue);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(payload.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
