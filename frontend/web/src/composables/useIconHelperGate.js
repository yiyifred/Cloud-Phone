import { computed, ref } from "vue";

import { requestJson } from "../utils/api.js";
import {
  isIconHelperFirstSetupDone,
  markIconHelperFirstSetupDone,
  recordSerialIconHelperDenial,
  resolveIconHelperConsent,
  setSerialIconHelperAllowed,
} from "../utils/icon-helper-consent.js";
import {
  mergeIconHelperProgress,
  pollIconHelperUntilDone,
} from "../utils/icon-helper-progress.js";

/**
 * Shared gate: consent → ensure/extract. Progress modal only on first setup.
 */
export function useIconHelperGate() {
  const consentDialogOpen = ref(false);
  const pendingSerial = ref("");
  const consentResolver = ref(null);

  const phase = ref("idle");
  const progress = ref({
    phase: "idle",
    total: 0,
    done: 0,
    current: "",
    message: "",
  });
  const errorMessage = ref("");
  const packageNamesOnly = ref(false);
  const warmedSerials = ref(new Set());
  const progressUiVisible = ref(false);

  const showProgressUi = computed(() => progressUiVisible.value);

  const progressText = computed(() => {
    const p = progress.value;
    if (phase.value === "ensuring") {
      return "installing";
    }
    if (p.phase === "running" && p.total > 0) {
      return `${p.done}/${p.total}`;
    }
    if (p.phase === "running") {
      return "extracting";
    }
    if (p.phase === "done") {
      return "done";
    }
    if (p.phase === "error") {
      return p.message || "error";
    }
    return "";
  });

  const progressPercent = computed(() => {
    const p = progress.value;
    if (!p.total) {
      if (phase.value === "ensuring") {
        return 5;
      }
      if (phase.value === "denied") {
        // Package-name-only mode doesn't provide per-item progress; show a visible bar.
        return 30;
      }
      return 0;
    }
    return Math.min(100, Math.round((p.done / p.total) * 100));
  });

  function ensureConsent(serial) {
    const existing = resolveIconHelperConsent(serial);
    if (existing === "allowed" || existing === "denied") {
      return Promise.resolve(existing);
    }
    pendingSerial.value = serial;
    consentDialogOpen.value = true;
    return new Promise((resolve) => {
      consentResolver.value = resolve;
    });
  }

  function answerConsent(allowed) {
    const serial = pendingSerial.value;
    if (serial) {
      if (allowed) {
        setSerialIconHelperAllowed(serial);
      } else {
        recordSerialIconHelperDenial(serial);
      }
    }
    consentDialogOpen.value = false;
    const resolve = consentResolver.value;
    consentResolver.value = null;
    pendingSerial.value = "";
    resolve?.(allowed ? "allowed" : "denied");
  }

  function markReady(serial) {
    markIconHelperFirstSetupDone(serial);
    warmedSerials.value = new Set([...warmedSerials.value, serial]);
  }

  function applyProgress(next) {
    progress.value = mergeIconHelperProgress(next, progress.value);
  }

  async function pollUntilDone(serial, options = {}) {
    await pollIconHelperUntilDone(requestJson, serial, {
      getProgress: () => progress.value,
      setProgress: (value) => {
        progress.value = value;
      },
      updateUi: options.updateUi,
    });
  }

  /**
   * @param {string} serial
   * @param {{ silent?: boolean, force?: boolean }} [options]
   */
  async function prepareIconHelper(serial, options = {}) {
    const force = Boolean(options.force);
    const firstDone = isIconHelperFirstSetupDone(serial);
    // force always shows progress UI and reloads from device
    const silent = force ? false : Boolean(options.silent) || firstDone;
    errorMessage.value = "";
    packageNamesOnly.value = false;
    progressUiVisible.value = false;

    if (!serial) {
      packageNamesOnly.value = true;
      return { ok: false, packageNamesOnly: true };
    }

    const consent = await ensureConsent(serial);
    if (consent === "denied") {
      packageNamesOnly.value = true;
      phase.value = "denied";
      return { ok: false, packageNamesOnly: true };
    }

    try {
      if (!silent) {
        progressUiVisible.value = true;
        phase.value = "ensuring";
      }

      const ensureQs = force ? "?force=1" : "";
      const ensureResult = await requestJson(
        `/api/devices/${encodeURIComponent(serial)}/icon-helper/ensure${ensureQs}`,
        { method: "POST" },
      );
      const extract = ensureResult?.extract || {};
      if (!silent) {
        applyProgress(extract.progress);
      }

      if (!force && extract.skipped && extract.progress?.phase === "done") {
        phase.value = "ready";
        packageNamesOnly.value = false;
        markReady(serial);
        return { ok: true, packageNamesOnly: false, skipped: true };
      }

      if (!silent) {
        phase.value = "extracting";
      }

      if (force || (!extract.started && extract.progress?.phase !== "done")) {
        const extractQs = force ? "?force=1" : "";
        await requestJson(
          `/api/devices/${encodeURIComponent(serial)}/icon-helper/extract${extractQs}`,
          { method: "POST" },
        );
      }

      await pollUntilDone(serial, { updateUi: !silent });
      phase.value = progress.value.phase === "error" ? "error" : "ready";

      if (progress.value.phase === "error") {
        errorMessage.value = progress.value.message || "extract failed";
        packageNamesOnly.value = true;
        return { ok: false, packageNamesOnly: true };
      }

      packageNamesOnly.value = false;
      markReady(serial);
      return { ok: true, packageNamesOnly: false, skipped: Boolean(extract.skipped) && !force };
    } catch (error) {
      phase.value = "error";
      errorMessage.value = error instanceof Error ? error.message : String(error);
      packageNamesOnly.value = true;
      return { ok: false, packageNamesOnly: true };
    } finally {
      progressUiVisible.value = false;
    }
  }

  async function warmIconHelper(serial, options = {}) {
    if (!serial) {
      return { ok: false, packageNamesOnly: true };
    }
    if (resolveIconHelperConsent(serial) === "denied") {
      return { ok: false, packageNamesOnly: true };
    }
    const force = Boolean(options.force);
    if (!force && warmedSerials.value.has(serial) && isIconHelperFirstSetupDone(serial)) {
      return { ok: true, packageNamesOnly: false, skipped: true };
    }
    return prepareIconHelper(serial, {
      silent: force ? false : isIconHelperFirstSetupDone(serial),
      force,
    });
  }

  async function syncIconHelper(serial) {
    if (!serial || resolveIconHelperConsent(serial) !== "allowed") {
      return { changed: false };
    }
    try {
      const result = await requestJson(
        `/api/devices/${encodeURIComponent(serial)}/icon-helper/sync`,
        { method: "POST" },
      );
      if (result.changed && result.started) {
        await pollUntilDone(serial, { updateUi: false });
      }
      if (result.apps?.length || result.progress?.phase === "done") {
        markIconHelperFirstSetupDone(serial);
      }
      return result;
    } catch {
      return { changed: false };
    }
  }

  function resetGate() {
    phase.value = "idle";
    progress.value = { phase: "idle", total: 0, done: 0, current: "", message: "" };
    errorMessage.value = "";
    progressUiVisible.value = false;
  }

  return {
    consentDialogOpen,
    phase,
    progress,
    progressText,
    progressPercent,
    showProgressUi,
    errorMessage,
    packageNamesOnly,
    ensureConsent,
    answerConsent,
    prepareIconHelper,
    warmIconHelper,
    syncIconHelper,
    resetGate,
  };
}
