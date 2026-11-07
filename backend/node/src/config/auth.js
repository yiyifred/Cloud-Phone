export const AUTH_COOKIE_NAME = "cloud_phone_session";
export const DEFAULT_PASSWORD = "admin";
export const PASSWORD_MIN_LENGTH = 6;

const DEFAULT_SESSION_DAYS = 30;
const MAX_SESSION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Session TTL is read lazily: .env is loaded after this module may be parsed,
 * and operators must be able to shorten the window without a rebuild.
 * Default is 30 days; the previous 150 days kept a sniffed cookie usable for
 * half a year.
 */
export function getSessionDurationDays() {
  const raw = Number(process.env.AUTH_SESSION_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_SESSION_DAYS;
  }
  return Math.min(MAX_SESSION_DAYS, Math.max(1, Math.round(raw)));
}

export function getSessionDurationMs() {
  return getSessionDurationDays() * DAY_MS;
}

/** Login brute-force budget; overridable for scripted installs. */
export const LOGIN_THROTTLE = {
  ipWindowMs: readNumber("LOGIN_IP_WINDOW_MS", 5 * 60 * 1000),
  ipMaxFailures: readNumber("LOGIN_IP_MAX_FAILURES", 5),
  ipBaseLockMs: readNumber("LOGIN_IP_LOCK_MS", 15 * 60 * 1000),
  globalWindowMs: readNumber("LOGIN_GLOBAL_WINDOW_MS", 10 * 60 * 1000),
  globalMaxFailures: readNumber("LOGIN_GLOBAL_MAX_FAILURES", 20),
};

function readNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
