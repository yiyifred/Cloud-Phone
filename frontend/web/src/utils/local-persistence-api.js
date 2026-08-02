import { requestJson } from "./api.js";

export async function fetchPublicPreferences() {
  const result = await requestJson("/api/public/preferences", {
    plainJson: true,
    skipAuthExpire: true,
    allowFailure: true,
  });
  return result?.preferences ?? {};
}

export async function savePublicPreferences(preferences) {
  const result = await requestJson("/api/public/preferences", {
    method: "POST",
    body: preferences,
    plainJson: true,
    skipAuthExpire: true,
    allowFailure: true,
  });
  return result?.preferences ?? {};
}

export async function fetchLocalPersistence(logLimit = 0) {
  const result = await requestJson(`/api/local-persistence?logLimit=${encodeURIComponent(logLimit)}`);
  return {
    settings: result.settings ?? {},
    runtimeState: result.runtimeState ?? {},
    logs: Array.isArray(result.logs) ? result.logs : [],
  };
}

/**
 * @param {{ limit?: number, beforeId?: number|null }} [options]
 */
export async function fetchLogsPage(options = {}) {
  const limit = Math.max(1, Math.round(Number(options.limit) || 50));
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.beforeId != null && options.beforeId !== "") {
    params.set("beforeId", String(options.beforeId));
  }
  const result = await requestJson(`/api/logs?${params.toString()}`);
  return {
    logs: Array.isArray(result.logs) ? result.logs : [],
    nextBeforeId: result.nextBeforeId ?? null,
    hasMore: Boolean(result.hasMore),
    limit: result.limit ?? limit,
  };
}

export async function saveLocalPersistencePatch(payload) {
  const result = await requestJson("/api/local-persistence", {
    method: "POST",
    body: payload,
  });
  return {
    settings: result.settings ?? {},
    runtimeState: result.runtimeState ?? {},
  };
}

export async function appendPersistedLog(entry) {
  await requestJson("/api/logs", {
    method: "POST",
    body: { entry },
    allowFailure: true,
  });
}

export async function clearPersistedLogs() {
  await requestJson("/api/logs", {
    method: "DELETE",
    allowFailure: true,
  });
}
