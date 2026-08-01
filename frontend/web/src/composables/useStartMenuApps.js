import { computed, onBeforeUnmount, ref, unref, watch } from "vue";

import { useIconHelperGate } from "./useIconHelperGate.js";
import { getErrorMessage } from "../utils/api.js";
import {
  isIconHelperFirstSetupDone,
  resolveIconHelperConsent,
} from "../utils/icon-helper-consent.js";
import {
  fetchAndCacheLauncherApps,
  refreshLauncherAppsBrowserCache,
  readLauncherAppsBrowserCache,
} from "../utils/launcher-apps-browser-resolve.js";
import {
  clearLauncherAppsCache,
  getStoredLauncherFingerprint,
} from "../utils/launcher-icon-browser-cache.js";
import {
  appDisplayName,
  appInitials,
  appLaunchPayload,
  mergeAppIcons,
} from "../utils/start-menu-app-helpers.js";

function resolveString(value) {
  return String(unref(value) || "").trim();
}

function resolveBool(value) {
  return Boolean(unref(value));
}

/**
 * Start menu apps: IndexedDB cache-first; first open forces reload + progress UI.
 * @param {{ serial: unknown, active: unknown, t: Function }} options
 */
export function useStartMenuApps(options) {
  const t = options.t;
  const gate = useIconHelperGate();
  const {
    consentDialogOpen,
    phase,
    progress,
    progressPercent,
    showProgressUi,
    packageNamesOnly,
    answerConsent,
    prepareIconHelper,
    syncIconHelper,
  } = gate;

  const searchQuery = ref("");
  const apps = ref([]);
  const loading = ref(false);
  const errorMessage = ref("");
  const hasLoadedOnce = ref(false);
  const gateBusy = ref(false);
  const cacheFingerprint = ref("");

  let inFlight = false;
  let loadGeneration = 0;
  let syncTimer = null;

  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
  const isSearching = computed(() => normalizedQuery.value.length > 0);
  const hasVisibleIcons = computed(() =>
    apps.value.some((app) => Boolean(app?.iconDataUrl)),
  );
  const showDeniedHint = computed(() => {
    const serial = resolveString(options.serial);
    // Only when user/settings actually disabled the helper — not on extract failures.
    if (resolveIconHelperConsent(serial) !== "denied") {
      return false;
    }
    return packageNamesOnly.value && hasLoadedOnce.value && !gateBusy.value && !loading.value;
  });
  // Progress only when the UI still has nothing useful; with icons already painted,
  // sync/extract continues silently in the background.
  const showLoadProgress = computed(() => {
    if (hasVisibleIcons.value) {
      return false;
    }
    return Boolean(
      showProgressUi.value ||
        gateBusy.value ||
        (loading.value && !hasLoadedOnce.value),
    );
  });
  const progressIndeterminate = computed(() => {
    if (phase.value === "ensuring") {
      return true;
    }
    if (phase.value === "denied" || packageNamesOnly.value) {
      return true;
    }
    return !(progress.value.phase === "running" && Number(progress.value.total) > 0);
  });
  const progressLabel = computed(() => {
    if (phase.value === "ensuring") {
      return t("iconHelper.installing");
    }
    if (phase.value === "denied" || packageNamesOnly.value) {
      return t("iconHelper.loadingPackageNames");
    }
    if (progress.value.phase === "running") {
      return t("iconHelper.extractingProgress", {
        done: progress.value.done,
        total: progress.value.total || "?",
      });
    }
    return t("iconHelper.extracting");
  });
  const filteredApps = computed(() => {
    if (!isSearching.value) {
      return apps.value;
    }
    const query = normalizedQuery.value;
    return apps.value.filter((app) => {
      const label = String(app.label || "").toLowerCase();
      const pkg = String(app.packageName || "").toLowerCase();
      return label.includes(query) || pkg.includes(query);
    });
  });

  watch(
    () => [resolveBool(options.active), resolveString(options.serial)],
    ([isActive, serial]) => {
      if (isActive && serial) {
        void bootstrapAndLoad();
        startSyncPoll();
        return;
      }
      stopSyncPoll();
      if (!isActive) {
        searchQuery.value = "";
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    loadGeneration += 1;
    stopSyncPoll();
  });

  function startSyncPoll() {
    stopSyncPoll();
    if (!resolveString(options.serial)) {
      return;
    }
    syncTimer = setInterval(() => {
      void syncAndReload();
    }, 12_000);
  }

  function stopSyncPoll() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  async function syncAndReload() {
    const serial = resolveString(options.serial);
    if (!serial || !resolveBool(options.active) || gateBusy.value) {
      return;
    }
    const result = await syncIconHelper(serial);
    const remoteFp = String(result?.progress?.fingerprint || result?.fingerprint || "");
    const localFp = cacheFingerprint.value || getStoredLauncherFingerprint(serial);
    const changed =
      Boolean(result?.changed) || Boolean(remoteFp && localFp && remoteFp !== localFp);
    if (!changed && hasLoadedOnce.value && apps.value.length) {
      return;
    }
    await refreshFromNetwork({ packageNamesOnly: packageNamesOnly.value });
  }

  async function paintFromBrowserCache(generation) {
    try {
      const cached = await readLauncherAppsBrowserCache(resolveString(options.serial));
      // Accept package-name-only cache (ADB warm); icons enrich later.
      if (generation !== loadGeneration || !cached.fromCache || !cached.apps.length) {
        return false;
      }
      apps.value = cached.apps;
      cacheFingerprint.value = cached.fingerprint || "";
      errorMessage.value = "";
      hasLoadedOnce.value = true;
      loading.value = false;
      return true;
    } catch {
      return false;
    }
  }

  async function needsForcedFirstLoad(serial) {
    if (!isIconHelperFirstSetupDone(serial)) {
      const cached = await readLauncherAppsBrowserCache(serial);
      // Connect-time ADB warm already filled cache — do not wipe it.
      if (cached.fromCache && cached.apps.length) {
        return false;
      }
      return true;
    }
    const cached = await readLauncherAppsBrowserCache(serial);
    return !cached.fromCache || !cached.apps.length;
  }

  async function bootstrapAndLoad() {
    const serial = resolveString(options.serial);
    if (!serial || gateBusy.value) {
      return;
    }

    gateBusy.value = true;
    const generation = ++loadGeneration;
    const forceFirst = await needsForcedFirstLoad(serial);

    try {
      let painted = false;
      if (forceFirst) {
        await clearLauncherAppsCache(serial);
        cacheFingerprint.value = "";
        apps.value = [];
        hasLoadedOnce.value = false;
        loading.value = true;
      } else {
        painted = await paintFromBrowserCache(generation);
      }
      if (!painted) {
        loading.value = true;
      }

      // Icons already on screen → keep updating secretly (no progress modal/bar).
      const silent = painted && hasVisibleIcons.value ? true : !forceFirst;

      const result = await prepareIconHelper(serial, {
        silent,
        force: forceFirst,
      });
      if (generation !== loadGeneration) {
        return;
      }

      await refreshFromNetwork({
        packageNamesOnly: Boolean(result.packageNamesOnly),
        generation,
        skipIfUnchanged: painted && !forceFirst,
        force: forceFirst,
      });
    } finally {
      if (generation === loadGeneration) {
        gateBusy.value = false;
        loading.value = false;
      }
    }
  }

  async function refreshFromNetwork({
    packageNamesOnly: namesOnly = false,
    generation = loadGeneration,
    skipIfUnchanged = false,
    force = false,
  } = {}) {
    const serial = resolveString(options.serial);
    if (!serial || inFlight) {
      return;
    }
    inFlight = true;
    try {
      const result =
        !force && skipIfUnchanged
          ? await refreshLauncherAppsBrowserCache(serial, {
              packageNamesOnly: namesOnly,
              knownFingerprint: cacheFingerprint.value,
            })
          : await fetchAndCacheLauncherApps(serial, { packageNamesOnly: namesOnly });

      if (generation !== loadGeneration) {
        return;
      }
      if (skipIfUnchanged && result.changed === false && result.fromCache) {
        return;
      }
      if (!result.apps.length) {
        if (!hasLoadedOnce.value) {
          apps.value = [];
        }
        errorMessage.value = t("iconHelper.loadFailed");
        return;
      }
      apps.value = mergeAppIcons(apps.value, result.apps);
      cacheFingerprint.value = result.fingerprint || cacheFingerprint.value;
      errorMessage.value = "";
      hasLoadedOnce.value = true;
    } catch (error) {
      if (generation !== loadGeneration) {
        return;
      }
      if (!hasLoadedOnce.value) {
        apps.value = [];
      }
      errorMessage.value = getErrorMessage(error) || t("iconHelper.loadFailed");
    } finally {
      inFlight = false;
    }
  }

  return {
    consentDialogOpen,
    phase,
    progress,
    progressPercent,
    showProgressUi,
    packageNamesOnly,
    answerConsent,
    searchQuery,
    apps,
    loading,
    errorMessage,
    hasLoadedOnce,
    gateBusy,
    showDeniedHint,
    progressLabel,
    showLoadProgress,
    progressIndeterminate,
    filteredApps,
    isSearching,
    initialsFor: appInitials,
    displayName: (app) => appDisplayName(app, packageNamesOnly.value),
    launchPayload: (app) => appLaunchPayload(app, packageNamesOnly.value),
  };
}
