import { getCachedRuntimeState, persistLocalStatePatch } from "./local-persistence-state.js";

const CONSENT_PREFIX = "cloud-phone.icon-helper.consent.";
const DENY_COUNT_PREFIX = "cloud-phone.icon-helper.deny-count.";
const FIRST_SETUP_PREFIX = "cloud-phone.icon-helper.first-setup.";
const PREFERENCE_KEY = "cloud-phone.icon-helper.preference";

const MAX_DENY_PROMPTS = 2;

/**
 * @param {string} serial
 */
function consentKey(serial) {
  return `${CONSENT_PREFIX}${serial}`;
}

/**
 * @param {string} serial
 */
function denyCountKey(serial) {
  return `${DENY_COUNT_PREFIX}${serial}`;
}

/**
 * @param {string} serial
 */
function firstSetupKey(serial) {
  return `${FIRST_SETUP_PREFIX}${serial}`;
}

/**
 * Global preference: ask | allow | never
 * @returns {"ask" | "allow" | "never"}
 */
export function getIconHelperPreference() {
  const rt = getCachedRuntimeState();
  const value = rt[PREFERENCE_KEY];
  if (value === "allow" || value === "never" || value === "ask") {
    return value;
  }
  return "ask";
}

/**
 * @param {"ask" | "allow" | "never"} preference
 */
export function setIconHelperPreference(preference) {
  if (preference !== "ask" && preference !== "allow" && preference !== "never") {
    return;
  }
  void persistLocalStatePatch({
    runtimeState: {
      [PREFERENCE_KEY]: preference,
    },
  });

  if (preference === "ask" || preference === "allow") {
    clearAllSerialDenials();
  }
}

/**
 * @param {string} serial
 * @returns {"allowed" | "denied" | null}
 */
export function getSerialIconHelperConsent(serial) {
  if (!serial) {
    return null;
  }
  const rt = getCachedRuntimeState();
  const value = rt[consentKey(serial)];
  if (value === "allowed" || value === "denied") {
    return value;
  }
  return null;
}

/**
 * Effective consent after applying global preference.
 * @param {string} serial
 * @returns {"allowed" | "denied" | null} null means should prompt
 */
export function resolveIconHelperConsent(serial) {
  const preference = getIconHelperPreference();
  if (preference === "allow") {
    return "allowed";
  }
  if (preference === "never") {
    return "denied";
  }
  return getSerialIconHelperConsent(serial);
}

/**
 * @param {string} serial
 */
export function setSerialIconHelperAllowed(serial) {
  if (!serial) {
    return;
  }
  void persistLocalStatePatch({
    runtimeState: {
      [consentKey(serial)]: "allowed",
      [denyCountKey(serial)]: null,
    },
  });
}

/**
 * Record a denial. After 2 denials, marks serial as permanently denied (until settings reset).
 * @param {string} serial
 * @returns {{ denyCount: number, permanentlyDenied: boolean }}
 */
export function recordSerialIconHelperDenial(serial) {
  if (!serial) {
    return { denyCount: 0, permanentlyDenied: false };
  }

  const next = Math.min(MAX_DENY_PROMPTS, getSerialDenyCount(serial) + 1);

  if (next >= MAX_DENY_PROMPTS) {
    void persistLocalStatePatch({
      runtimeState: {
        [denyCountKey(serial)]: next,
        [consentKey(serial)]: "denied",
      },
    });
    return { denyCount: next, permanentlyDenied: true };
  }

  void persistLocalStatePatch({
    runtimeState: {
      [denyCountKey(serial)]: next,
      [consentKey(serial)]: null,
    },
  });

  return { denyCount: next, permanentlyDenied: false };
}

/**
 * @param {string} serial
 */
export function getSerialDenyCount(serial) {
  if (!serial) {
    return 0;
  }
  const rt = getCachedRuntimeState();
  const raw = rt[denyCountKey(serial)];
  const next = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

/**
 * First successful extract completed for this device (progress modal only once).
 * @param {string} serial
 */
export function isIconHelperFirstSetupDone(serial) {
  if (!serial) {
    return false;
  }
  const rt = getCachedRuntimeState();
  return rt[firstSetupKey(serial)] === "1" || rt[firstSetupKey(serial)] === 1 || rt[firstSetupKey(serial)] === true;
}

/**
 * @param {string} serial
 */
export function markIconHelperFirstSetupDone(serial) {
  if (!serial) {
    return;
  }
  void persistLocalStatePatch({
    runtimeState: {
      [firstSetupKey(serial)]: "1",
    },
  });
}

function clearAllSerialDenials() {
  const rt = getCachedRuntimeState();
  const updates = {};
  for (const key of Object.keys(rt)) {
    if (key.startsWith(CONSENT_PREFIX) || key.startsWith(DENY_COUNT_PREFIX)) {
      updates[key] = null;
    }
    // Do not clear first-setup completion; keep the progress modal only once.
  }
  const hasUpdates = Object.keys(updates).length > 0;
  if (!hasUpdates) {
    return;
  }
  void persistLocalStatePatch({ runtimeState: updates });
}
