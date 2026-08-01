import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";
import {
  allHelperIconsCached,
  clearExtractInFlight,
  getCachedHelperApps,
  getCachedHelperPackages,
  getCachedHelperFingerprint,
  getIconHelperProgress,
  isExtractInFlight,
  markExtractInFlight,
  setIconHelperProgress,
} from "./icon-helper-cache.js";
import { ingestHelperOutputs, readRemoteJson } from "./icon-helper-ingest.js";
import { ICON_HELPER_SERVICE } from "./icon-helper-paths.js";
import { invalidateLauncherAppsCache } from "./device-launcher-apps.js";
import { removeCachedAppIcons } from "./device-app-icons.js";

export {
  getCachedHelperApps,
  getCachedHelperPackages,
  getIconHelperProgress,
} from "./icon-helper-cache.js";

async function ingestAndInvalidate(serial, options) {
  const previous = getCachedHelperApps(serial) || [];
  const apps = await ingestHelperOutputs(serial, options);
  if (apps?.length) {
    invalidateLauncherAppsCache(serial);
  }
  const delta = diffHelperApps(previous, apps || []);
  if (delta?.removed?.length) {
    removeCachedAppIcons(serial, delta.removed);
  }
  return { apps, delta };
}

/**
 * @param {string} serial
 * @param {{ force?: boolean }} [options]
 */
export async function startIconHelperExtract(serial, options = {}) {
  const force = Boolean(options.force);
  const cached = getCachedHelperApps(serial);
  const progress = getIconHelperProgress(serial);
  const hostFp = getCachedHelperFingerprint(serial);

  if (!force && cached?.length && progress.phase === "done" && allHelperIconsCached(serial, cached)) {
    return {
      started: false,
      skipped: true,
      reason: "memory_cache",
      progress,
      apps: cached,
      delta: emptyDelta(cached),
    };
  }

  const remoteManifest = await readRemoteJson(serial, "manifest.json").catch(() => null);
  const remoteFp = String(remoteManifest?.fingerprint || "");

  if (!force && remoteFp && remoteFp === hostFp && cached?.length && allHelperIconsCached(serial, cached)) {
    setIconHelperProgress(serial, {
      phase: "done",
      total: cached.length,
      done: cached.length,
      current: "",
      message: "unchanged",
      fingerprint: remoteFp,
    });
    return {
      started: false,
      skipped: true,
      reason: "fingerprint_match",
      progress: getIconHelperProgress(serial),
      apps: cached,
      delta: emptyDelta(cached),
    };
  }

  if (!force) {
    const remoteProgress = await readRemoteJson(serial, "progress.json").catch(() => null);
    if (remoteProgress?.phase === "done") {
      const pulled = await ingestAndInvalidate(serial, { onlyMissingIcons: true }).catch(() => ({
        apps: [],
        delta: emptyDelta(cached || []),
      }));
      if (pulled.apps?.length) {
        const fp = getCachedHelperFingerprint(serial);
        setIconHelperProgress(serial, {
          phase: "done",
          total: pulled.apps.length,
          done: pulled.apps.length,
          current: "",
          message: remoteFp && remoteFp === fp ? "unchanged" : "cached",
          fingerprint: fp,
        });
        return {
          started: false,
          skipped: true,
          reason: "remote_done",
          progress: getIconHelperProgress(serial),
          apps: pulled.apps,
          delta: pulled.delta,
        };
      }
    }
  }

  if (isExtractInFlight(serial) || progress.phase === "running") {
    return {
      started: false,
      progress,
      apps: cached,
      delta: emptyDelta(cached || []),
    };
  }

  markExtractInFlight(serial);
  setIconHelperProgress(serial, {
    phase: "running",
    total: 0,
    done: 0,
    current: "",
    message: "starting",
    fingerprint: hostFp,
  });

  void runExtractJob(serial).finally(() => clearExtractInFlight(serial));
  return {
    started: true,
    progress: getIconHelperProgress(serial),
    apps: cached,
    delta: emptyDelta(cached || []),
  };
}

/**
 * @param {string} serial
 */
export async function refreshIconHelperProgress(serial) {
  const remoteProgress = await readRemoteJson(serial, "progress.json").catch(() => null);
  if (remoteProgress && typeof remoteProgress === "object") {
    setIconHelperProgress(serial, {
      phase: String(remoteProgress.phase || "running"),
      total: Number(remoteProgress.total) || 0,
      done: Number(remoteProgress.done) || 0,
      current: String(remoteProgress.current || ""),
      message: String(remoteProgress.message || ""),
      fingerprint: getCachedHelperFingerprint(serial),
    });
  }

  const remoteManifest = await readRemoteJson(serial, "manifest.json").catch(() => null);
  const remoteFp = String(remoteManifest?.fingerprint || "");
  const hostFp = getCachedHelperFingerprint(serial);
  const progress = getIconHelperProgress(serial);

  if (remoteFp && remoteFp !== hostFp && progress.phase === "done") {
    await ingestAndInvalidate(serial, { onlyMissingIcons: false });
  } else if (progress.phase === "done" && !getCachedHelperApps(serial)) {
    await ingestAndInvalidate(serial, { onlyMissingIcons: true });
  }

  return getIconHelperProgress(serial);
}

/**
 * @param {string} serial
 */
export async function syncIconHelperIfChanged(serial) {
  const remoteManifest = await readRemoteJson(serial, "manifest.json").catch(() => null);
  const remoteFp = String(remoteManifest?.fingerprint || "");
  const hostFp = getCachedHelperFingerprint(serial);
  const cached = getCachedHelperApps(serial);

  if (remoteFp && remoteFp === hostFp && cached?.length && allHelperIconsCached(serial, cached)) {
    return {
      changed: false,
      apps: cached,
      progress: getIconHelperProgress(serial),
      delta: emptyDelta(cached),
    };
  }

  if (remoteFp && remoteFp !== hostFp) {
    const result = await startIconHelperExtract(serial, { force: true });
    return { changed: true, ...result };
  }

  const remoteProgress = await readRemoteJson(serial, "progress.json").catch(() => null);
  if (remoteProgress?.phase === "done") {
    const pulled = await ingestAndInvalidate(serial, { onlyMissingIcons: true });
    return {
      changed: Boolean(
        pulled.apps?.length &&
          (!cached || cached.length !== pulled.apps.length || pulled.delta.changed.length),
      ),
      apps: pulled.apps,
      progress: getIconHelperProgress(serial),
      delta: pulled.delta,
    };
  }

  return {
    changed: false,
    apps: cached,
    progress: getIconHelperProgress(serial),
    delta: emptyDelta(cached || []),
  };
}

async function runExtractJob(serial) {
  try {
    await runWithAdbLock(async () => {
      try {
        await runAdb(
          ["-s", serial, "shell", "am", "start-foreground-service", "-n", ICON_HELPER_SERVICE],
          { timeout: 20_000 },
        );
      } catch {
        await runAdb(
          ["-s", serial, "shell", "am", "startservice", "-n", ICON_HELPER_SERVICE],
          { timeout: 20_000 },
        );
      }
    }, { lockKey: serial });

    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await sleep(700);
      const progress = await refreshIconHelperProgress(serial);
      if (progress.phase === "done" || progress.phase === "error") {
        break;
      }
    }

    const finalProgress = getIconHelperProgress(serial);
    if (finalProgress.phase === "done") {
      await ingestAndInvalidate(serial, { onlyMissingIcons: true });
    } else if (finalProgress.phase !== "error") {
      setIconHelperProgress(serial, {
        ...finalProgress,
        phase: "error",
        message: finalProgress.message || "extract timeout",
      });
    }
  } catch (error) {
    setIconHelperProgress(serial, {
      phase: "error",
      total: 0,
      done: 0,
      current: "",
      message: error instanceof Error ? error.message : "extract failed",
      fingerprint: "",
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyDelta(apps) {
  return {
    added: [],
    changed: [],
    removed: [],
    cachedPackages: (apps || [])
      .map((item) => String(item?.packageName || "").trim())
      .filter(Boolean)
      .sort(),
  };
}

function diffHelperApps(previous, next) {
  const before = new Map();
  for (const row of previous || []) {
    const pkg = String(row?.packageName || "").trim();
    if (!pkg) continue;
    const hash = row?.iconHash ? String(row.iconHash) : "";
    before.set(pkg, hash || String(row?.iconFile || ""));
  }
  const after = new Map();
  for (const row of next || []) {
    const pkg = String(row?.packageName || "").trim();
    if (!pkg) continue;
    const hash = row?.iconHash ? String(row.iconHash) : "";
    after.set(pkg, hash || String(row?.iconFile || ""));
  }
  const added = [];
  const changed = [];
  const removed = [];
  for (const [pkg, icon] of after.entries()) {
    if (!before.has(pkg)) {
      added.push(pkg);
      continue;
    }
    if (before.get(pkg) !== icon) {
      changed.push(pkg);
    }
  }
  for (const pkg of before.keys()) {
    if (!after.has(pkg)) {
      removed.push(pkg);
    }
  }
  return {
    added: added.sort(),
    changed: changed.sort(),
    removed: removed.sort(),
    cachedPackages: [...after.keys()].sort(),
  };
}
