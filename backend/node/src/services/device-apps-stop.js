import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";
import { forceStopPackage } from "./device-apps-mutate.js";

/**
 * Close a package for multi-app windows.
 *
 * Soft-stop first (so the app can finish / save), then always force-stop.
 * Multi-app cast uses noVdDestroyContent: tearing down the virtual display
 * moves surviving tasks onto the physical screen if the process is not killed.
 *
 * @param {string} serial
 * @param {string} packageName
 * @returns {Promise<{ ok: boolean, method: string, forced: boolean, message?: string }>}
 */
export async function stopPackage(serial, packageName) {
  const pkg = String(packageName || "").trim();
  if (!pkg) {
    const err = new Error("包名无效。");
    err.code = "invalid_package";
    throw err;
  }

  const soft = await trySoftStop(serial, pkg);
  // Short pause so stop-app can finish activities before force-stop.
  await sleep(120);

  const forced = await forceStopPackage(serial, pkg);
  return {
    ok: true,
    method: soft.ok ? `${soft.method}+force-stop` : "force-stop",
    forced: true,
    message: forced.message || "force-stop",
  };
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
async function trySoftStop(serial, packageName) {
  return runWithAdbLock(async () => {
    // Android 12+: finish activities without marking the package force-stopped.
    try {
      const { stdout, stderr } = await runAdb(
        ["-s", serial, "shell", "cmd", "activity", "stop-app", packageName],
        { timeout: 15_000 },
      );
      const out = `${stdout}\n${stderr}`.trim();
      if (!looksLikeCommandFailure(out)) {
        return { ok: true, method: "stop-app", message: out || "stop-app" };
      }
    } catch {
      // fall through
    }

    // Older / fallback: am kill (often no-op while foregrounded; force-stop follows).
    try {
      const { stdout, stderr } = await runAdb(
        ["-s", serial, "shell", "am", "kill", packageName],
        { timeout: 15_000 },
      );
      const out = `${stdout}\n${stderr}`.trim();
      if (!looksLikeCommandFailure(out)) {
        return { ok: true, method: "am-kill", message: out || "am-kill" };
      }
    } catch {
      // caller always force-stops
    }

    return { ok: false, method: "none", message: "" };
  }, { lockKey: serial });
}

function looksLikeCommandFailure(out) {
  return /unknown command|error:|exception|not found|denied|Can't find/i.test(String(out || ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
