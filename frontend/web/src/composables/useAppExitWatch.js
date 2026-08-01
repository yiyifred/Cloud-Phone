import { onBeforeUnmount, watch } from "vue";

import { requestJson } from "../utils/api.js";

/**
 * Poll multi-app package presence:
 * - exited → onExit
 * - still running but not on a virtual display → onOffVirtualDisplay (relaunch)
 *
 * @param {{
 *   getSerial: () => string,
 *   getPackageName: () => string,
 *   enabled: () => boolean,
 *   onExit: () => void,
 *   onOffVirtualDisplay?: () => void,
 *   intervalMs?: number,
 *   graceMs?: number,
 *   missLimit?: number,
 *   offVdMissLimit?: number,
 * }} options
 */
export function useAppExitWatch(options) {
  const intervalMs = options.intervalMs ?? 2500;
  const graceMs = options.graceMs ?? 12_000;
  const missLimit = options.missLimit ?? 4;
  const offVdMissLimit = options.offVdMissLimit ?? 2;

  let timer = null;
  let startedAt = 0;
  let pauseUntil = 0;
  let missCount = 0;
  let offVdMissCount = 0;
  let checking = false;

  function stop() {
    if (timer) {
      clearInterval(timer);
    }
    timer = null;
    missCount = 0;
    offVdMissCount = 0;
    checking = false;
  }

  /** Pause detection (e.g. while resizing VD / reconnecting / relaunching). */
  function bumpGrace(ms = graceMs) {
    const until = Date.now() + Math.max(0, Number(ms) || 0);
    pauseUntil = Math.max(pauseUntil, until);
    missCount = 0;
    offVdMissCount = 0;
  }

  async function tick() {
    if (checking || !options.enabled()) {
      return;
    }
    const serial = options.getSerial();
    const packageName = options.getPackageName();
    if (!serial || !packageName) {
      return;
    }
    const now = Date.now();
    if (now - startedAt < graceMs || now < pauseUntil) {
      return;
    }

    checking = true;
    try {
      const result = await requestJson(
        `/api/devices/${encodeURIComponent(serial)}/apps/${encodeURIComponent(packageName)}/running`,
      );
      if (result?.uncertain || result?.running == null) {
        return;
      }
      if (result.running) {
        missCount = 0;
        // App left the virtual display (e.g. migrated to the tablet) → relaunch.
        if (result.onVirtualDisplay === false && typeof options.onOffVirtualDisplay === "function") {
          offVdMissCount += 1;
          if (offVdMissCount >= offVdMissLimit) {
            offVdMissCount = 0;
            options.onOffVirtualDisplay();
          }
        } else {
          offVdMissCount = 0;
        }
        return;
      }
      offVdMissCount = 0;
      missCount += 1;
      if (missCount >= missLimit) {
        stop();
        options.onExit();
      }
    } catch {
      // Ignore transient ADB / network errors; do not close the window.
    } finally {
      checking = false;
    }
  }

  function start() {
    stop();
    startedAt = Date.now();
    pauseUntil = 0;
    missCount = 0;
    offVdMissCount = 0;
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
  }

  watch(
    () => options.enabled(),
    (enabled) => {
      if (enabled) {
        start();
      } else {
        stop();
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stop();
  });

  return { stop, start, bumpGrace };
}
