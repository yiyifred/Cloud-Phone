import crypto from "node:crypto";

/**
 * 设备控制权租约（control lease）。
 *
 * 为什么需要：多个人同时打开同一台设备的投屏时，服务端目前会把每一路控制消息
 * 都转给设备——A 的点击会和 B 的滑动打架，而且日志里看不出是谁操作的。
 * 这里给每台设备一个「当前控制者」，并在需要独占的操作上校验持有者。
 *
 * 设计取舍：
 * - 内存态而非落库：租约是秒级活性信息，进程重启后一律重新申请即可，
 *   落库反而要处理「重启后遗留租约把设备锁死」的问题。
 * - TTL + 心跳：客户端每 20 秒续期一次，45 秒没动静视为掉线自动释放，
 *   避免浏览器崩掉之后设备被永久占用。
 * - 强制抢占只给管理员（当前单密码体系下就是有效会话持有者），
 *   普通「申请」在持有者仍在心跳时返回 409 并带上持有者标识。
 * - 强制模式由 CLOUD_PHONE_CONTROL_ENFORCE 控制：默认 advisory（只提示不拦），
 *   打开后写类操作与控制消息必须持租约。
 */

const LEASE_TTL_MS = 45_000;
const LEASE_SWEEP_INTERVAL_MS = 15_000;
const MAX_LABEL_LENGTH = 48;

/** @type {Map<string, {sessionKey: string, label: string, acquiredAt: number, renewedAt: number, expiresAt: number}>} */
const leases = new Map();

let sweepTimer = null;

export class ControlLeaseError extends Error {
  constructor(code, statusCode, holder) {
    super(code);
    this.name = "ControlLeaseError";
    this.code = code;
    this.statusCode = statusCode;
    this.holder = holder ?? null;
  }
}

/**
 * 会话令牌本身不落日志也不回显：只用哈希前 12 位作为「同一个人」的判定键。
 */
export function sessionKeyOf(sessionToken) {
  if (!sessionToken) {
    return "";
  }

  return crypto.createHash("sha256").update(String(sessionToken)).digest("hex").slice(0, 12);
}

export function normalizeLabel(label) {
  const text = String(label ?? "").trim();

  if (!text) {
    return "anonymous";
  }

  return text.slice(0, MAX_LABEL_LENGTH);
}

function isExpired(lease, now = Date.now()) {
  return !lease || lease.expiresAt <= now;
}

function toSnapshot(lease, sessionKey) {
  if (!lease) {
    return { held: false, mine: false, holder: null, expiresAt: null };
  }

  return {
    held: true,
    mine: Boolean(sessionKey) && lease.sessionKey === sessionKey,
    holder: { reference: lease.sessionKey, label: lease.label, acquiredAt: lease.acquiredAt },
    expiresAt: lease.expiresAt,
    ttlMs: LEASE_TTL_MS,
  };
}

export function getControlLease(serial, sessionKey = "") {
  const lease = leases.get(String(serial));

  if (isExpired(lease)) {
    if (lease) {
      leases.delete(String(serial));
    }
    return toSnapshot(null, sessionKey);
  }

  return toSnapshot(lease, sessionKey);
}

export function listControlLeases(now = Date.now()) {
  const result = [];

  for (const [serial, lease] of leases) {
    if (lease.expiresAt <= now) {
      leases.delete(serial);
      continue;
    }

    result.push({ serial, ...toSnapshot(lease, "") });
  }

  return result;
}

/**
 * @param {string} serial
 * @param {string} sessionKey
 * @param {{label?: string, force?: boolean}} options force 只应来自已确认的管理员会话
 */
export function acquireControlLease(serial, sessionKey, options = {}) {
  const key = String(serial);
  const now = Date.now();
  const current = leases.get(key);

  if (!isExpired(current) && current.sessionKey !== sessionKey) {
    if (!options.force) {
      throw new ControlLeaseError("control_lease_held", 409, toSnapshot(current, sessionKey).holder);
    }

    // 抢占：保留新持有者的信息，但在快照里标记之前是谁，方便前端提示
    leases.set(key, {
      sessionKey,
      label: normalizeLabel(options.label),
      acquiredAt: now,
      renewedAt: now,
      expiresAt: now + LEASE_TTL_MS,
      previousHolder: current.label,
    });

    return getControlLease(key, sessionKey);
  }

  if (!isExpired(current) && current.sessionKey === sessionKey) {
    current.renewedAt = now;
    current.expiresAt = now + LEASE_TTL_MS;

    if (options.label) {
      current.label = normalizeLabel(options.label);
    }

    return getControlLease(key, sessionKey);
  }

  leases.set(key, {
    sessionKey,
    label: normalizeLabel(options.label),
    acquiredAt: now,
    renewedAt: now,
    expiresAt: now + LEASE_TTL_MS,
  });

  return getControlLease(key, sessionKey);
}

export function renewControlLease(serial, sessionKey) {
  const lease = leases.get(String(serial));

  if (isExpired(lease)) {
    leases.delete(String(serial));
    throw new ControlLeaseError("control_lease_missing", 409, null);
  }

  if (lease.sessionKey !== sessionKey) {
    throw new ControlLeaseError("control_lease_held", 409, toSnapshot(lease, sessionKey).holder);
  }

  lease.renewedAt = Date.now();
  lease.expiresAt = lease.renewedAt + LEASE_TTL_MS;

  return toSnapshot(lease, sessionKey);
}

export function releaseControlLease(serial, sessionKey, options = {}) {
  const key = String(serial);
  const lease = leases.get(key);

  if (!lease) {
    return { released: false };
  }

  if (lease.sessionKey !== sessionKey && !options.force) {
    throw new ControlLeaseError("control_lease_held", 409, toSnapshot(lease, sessionKey).holder);
  }

  leases.delete(key);

  return { released: true };
}

/**
 * 写类操作入口：advisory 模式下不拦，strict 模式下要求持租约。
 */
export function isControlEnforced() {
  const value = String(process.env.CLOUD_PHONE_CONTROL_ENFORCE ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "strict";
}

/**
 * @param {string} serial
 * @param {string} sessionToken
 * @param {{action?: string}} options
 */
export function assertControlPermission(serial, sessionToken, options = {}) {
  const snapshot = getControlLease(serial, sessionKeyOf(sessionToken));

  if (snapshot.mine) {
    return snapshot;
  }

  if (!isControlEnforced()) {
    return snapshot;
  }

  if (!snapshot.held) {
    throw new ControlLeaseError("control_lease_required", 409, null);
  }

  throw new ControlLeaseError("control_lease_held", 409, snapshot.holder);
}

export function startControlLeaseSweeper() {
  if (sweepTimer) {
    return;
  }

  sweepTimer = setInterval(() => {
    const now = Date.now();

    for (const [serial, lease] of leases) {
      if (lease.expiresAt <= now) {
        leases.delete(serial);
      }
    }
  }, LEASE_SWEEP_INTERVAL_MS);

  // 定时器不应阻止进程退出
  sweepTimer.unref?.();
}

export function stopControlLeaseSweeper() {
  if (!sweepTimer) {
    return;
  }

  clearInterval(sweepTimer);
  sweepTimer = null;
}

export const CONTROL_LEASE_TTL_MS = LEASE_TTL_MS;
