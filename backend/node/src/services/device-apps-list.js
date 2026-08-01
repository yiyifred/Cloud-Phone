import { runAdb } from "./adb-command.js";
import { runWithAdbLock } from "./adb-lock.js";
import { fetchScrcpyAppLabels } from "./device-apps-scrcpy-labels.js";
import { getCachedAppIcon } from "./device-app-icons.js";

/**
 * @param {string} stdout
 * @returns {Map<string, string>} packageName -> apkPath (prefers base.apk)
 */
function parsePmListPackages(stdout) {
  /** @type {Map<string, string>} */
  const byPackage = new Map();

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.startsWith("package:")) {
      continue;
    }

    const withoutPrefix = line.slice("package:".length);
    const eq = withoutPrefix.lastIndexOf("=");

    if (eq <= 0) {
      continue;
    }

    const apkPath = withoutPrefix.slice(0, eq);
    const packageName = withoutPrefix.slice(eq + 1);

    if (!packageName || !apkPath) {
      continue;
    }

    const prev = byPackage.get(packageName);

    if (!prev) {
      byPackage.set(packageName, apkPath);
      continue;
    }

    if (prev.includes("base.apk") && !apkPath.includes("base.apk")) {
      continue;
    }

    if (!prev.includes("base.apk") && apkPath.includes("base.apk")) {
      byPackage.set(packageName, apkPath);
    }
  }

  return byPackage;
}

function isSystemApkPath(apkPath) {
  const p = apkPath.toLowerCase();
  return (
    p.includes("/system/") ||
    p.includes("/vendor/") ||
    p.includes("/product/") ||
    p.includes("/system_ext/")
  );
}

/**
 * @param {string} serial
 * @returns {Promise<Array<{ packageName: string, label: string, apkPath: string, system: boolean, enabled: boolean }>>}
 */
export async function listInstalledApps(serial) {
  return runWithAdbLock(async () => {
    const [{ stdout: allOut }, { stdout: disabledOut }, scrcpyLabels] = await Promise.all([
      runAdb(["-s", serial, "shell", "pm", "list", "packages", "-f"], { timeout: 120_000 }),
      runAdb(["-s", serial, "shell", "pm", "list", "packages", "-f", "-d"], { timeout: 120_000 }),
      fetchScrcpyAppLabels(serial).catch(() => new Map()),
    ]);

    const all = parsePmListPackages(allOut);
    const disabled = new Set(parsePmListPackages(disabledOut).keys());

    const rows = [...all.entries()].map(([packageName, apkPath]) => {
      const scrcpyApp = scrcpyLabels.get(packageName);

      return {
        packageName,
        label: scrcpyApp?.label ?? packageName,
        iconDataUrl: getCachedAppIcon(serial, packageName),
        apkPath,
        system: scrcpyApp?.system ?? isSystemApkPath(apkPath),
        enabled: !disabled.has(packageName),
      };
    });

    rows.sort((a, b) => a.label.localeCompare(b.label, "zh-CN") || a.packageName.localeCompare(b.packageName));
    return rows;
  }, { lockKey: serial });
}

/**
 * @param {string} serial
 * @param {string} packageName
 */
export async function isPackageDisabledForUser(serial, packageName) {
  const { stdout } = await runAdb(["-s", serial, "shell", "pm", "list", "packages", "-f", "-d"], {
    timeout: 120_000,
  });

  return parsePmListPackages(stdout).has(packageName);
}
