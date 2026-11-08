import crypto from "node:crypto";

/**
 * 只读分享链接（viewer 角色）。
 *
 * 现在的认证只有「一个密码 = 全部权限」：想让同事看一眼某台设备的画面，
 * 只能把管理密码给出去，等于连安装/卸载/终端一起给了。
 *
 * 这里引入第二种凭据：管理员生成的一次性分享令牌，凭它进入的是 viewer 角色 ——
 * 只能读（设备列表、截图、投屏画面、日志），不能控制、不能写。
 *
 * 设计取舍：
 * - 令牌只存哈希：分享链接一旦生成，服务端只保留 sha256，泄库不等于泄令牌；
 * - 内存态：与租约一致，进程重启即失效，避免「重启后遗留的分享链接还活着」；
 * - 不需要用户系统：viewer 不是账号，只是「一张限时门禁卡」，与单密码体系兼容。
 */

const DEFAULT_TTL_MINUTES = 24 * 60;
const MAX_TTL_MINUTES = 30 * 24 * 60;
const MAX_LABEL_LENGTH = 40;

/** @type {Map<string, {id: string, label: string, createdAt: number, expiresAt: number, lastUsedAt: number}>} */
const shares = new Map();

export class ShareTokenError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = "ShareTokenError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function hashShareToken(token) {
  return crypto.createHash("sha256").update(String(token ?? "")).digest("hex");
}

function normalizeTtl(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_TTL_MINUTES;
  }

  return Math.min(Math.round(value), MAX_TTL_MINUTES);
}

export function createShareToken(options = {}) {
  const token = crypto.randomBytes(24).toString("base64url");
  const now = Date.now();
  const ttlMinutes = normalizeTtl(options.ttlMinutes);
  const record = {
    id: crypto.randomBytes(6).toString("hex"),
    label: String(options.label ?? "").trim().slice(0, MAX_LABEL_LENGTH) || "只读分享",
    createdAt: now,
    expiresAt: now + ttlMinutes * 60_000,
    lastUsedAt: 0,
    createdBy: String(options.createdBy ?? "").slice(0, 12),
  };

  shares.set(hashShareToken(token), record);

  // 明文令牌只在创建时返回一次，之后无法再取回
  return { token, share: toPublicShare(record) };
}

function toPublicShare(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    label: record.label,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastUsedAt: record.lastUsedAt || null,
    createdBy: record.createdBy || null,
  };
}

export function listShareTokens(now = Date.now()) {
  const result = [];

  for (const [hash, record] of shares) {
    if (record.expiresAt <= now) {
      shares.delete(hash);
      continue;
    }

    result.push(toPublicShare(record));
  }

  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeShareToken(id) {
  for (const [hash, record] of shares) {
    if (record.id === id) {
      shares.delete(hash);
      return true;
    }
  }

  return false;
}

/** 校验分享令牌；过期的顺手清掉。返回公开视图（不含哈希）。 */
export function resolveShareToken(token) {
  if (!token) {
    return null;
  }

  const hash = hashShareToken(token);
  const record = shares.get(hash);

  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    shares.delete(hash);
    return null;
  }

  record.lastUsedAt = Date.now();

  return toPublicShare(record);
}

export function clearAllShareTokens() {
  shares.clear();
}

export const SHARE_TTL_DEFAULT_MINUTES = DEFAULT_TTL_MINUTES;
export const SHARE_TTL_MAX_MINUTES = MAX_TTL_MINUTES;
