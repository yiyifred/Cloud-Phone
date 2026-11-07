import { LOGIN_THROTTLE } from "../config/auth.js";

/**
 * In-memory login throttle: per-IP exponential backoff plus a global budget
 * so a distributed guesser cannot spread the cost across addresses.
 * State is deliberately not persisted: a restart clearing a lockout is
 * acceptable, a restart wiping the password store is not.
 */
const ipBuckets = new Map();
let globalFailures = [];
let globalLockedUntil = 0;

const MAX_LOCK_MS = 60 * 60 * 1000;

function prune(timestamps, windowMs, now) {
  return timestamps.filter((value) => now - value < windowMs);
}

function pruneGlobal(now) {
  globalFailures = prune(globalFailures, LOGIN_THROTTLE.globalWindowMs, now);
  if (globalLockedUntil && globalLockedUntil <= now) {
    globalLockedUntil = 0;
  }
}

/**
 * @param {string} clientKey
 * @returns {{ allowed: boolean, retryAfterSeconds: number, reason?: string }}
 */
export function checkLoginAllowed(clientKey) {
  const now = Date.now();
  pruneGlobal(now);

  if (globalLockedUntil > now) {
    return {
      allowed: false,
      reason: "global_lockout",
      retryAfterSeconds: Math.ceil((globalLockedUntil - now) / 1000),
    };
  }

  const bucket = ipBuckets.get(clientKey);

  if (!bucket) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      reason: "ip_lockout",
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Record a wrong password; extends the per-IP lock exponentially. */
export function recordLoginFailure(clientKey) {
  const now = Date.now();
  pruneGlobal(now);

  const bucket = ipBuckets.get(clientKey) ?? { failures: [], lockedUntil: 0, lockLevel: 0 };
  bucket.failures = prune(bucket.failures, LOGIN_THROTTLE.ipWindowMs, now);
  bucket.failures.push(now);

  if (bucket.failures.length >= LOGIN_THROTTLE.ipMaxFailures) {
    const lockMs = Math.min(MAX_LOCK_MS, LOGIN_THROTTLE.ipBaseLockMs * 2 ** bucket.lockLevel);
    bucket.lockLevel = Math.min(bucket.lockLevel + 1, 4);
    bucket.lockedUntil = now + lockMs;
    bucket.failures = [];
  }

  ipBuckets.set(clientKey, bucket);
  globalFailures.push(now);

  if (globalFailures.length >= LOGIN_THROTTLE.globalMaxFailures) {
    globalLockedUntil = now + LOGIN_THROTTLE.globalWindowMs;
    globalFailures = [];
  }
}

/** Successful login resets the per-IP budget (not the global one). */
export function recordLoginSuccess(clientKey) {
  ipBuckets.delete(clientKey);
}

/** Ops/test helper: drop all throttle state. */
export function resetLoginThrottle() {
  ipBuckets.clear();
  globalFailures = [];
  globalLockedUntil = 0;
}
