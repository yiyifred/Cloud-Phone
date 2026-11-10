import fs from "node:fs";
import path from "node:path";

import { BACKEND_NODE_ROOT_PATH, PROJECT_ROOT_PATH } from "./paths.js";
import { firstExistingPath } from "./runtime-env.js";

const SCRCPY_SOURCE_ROOT = path.join(PROJECT_ROOT_PATH, "backend", "source", "scrcpy");
const SCRCPY_BIN_ROOT = path.join(PROJECT_ROOT_PATH, "backend", "bin", "scrcpy");

const PLATFORM_DIR = {
  win32: "windows",
  darwin: "macos",
  linux: "linux",
};

const SERVER_FILE_NAMES = ["scrcpy-server", "scrcpy-server.jar"];

function resolveConfiguredPath(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}

function resolveProjectRootCandidates() {
  const candidates = [];

  const configuredRoot = resolveConfiguredPath(process.env.CLOUD_PHONE_ROOT);

  if (configuredRoot) {
    candidates.push(configuredRoot);
  }

  candidates.push(PROJECT_ROOT_PATH);
  candidates.push(path.resolve(BACKEND_NODE_ROOT_PATH, "..", ".."));

  let dir = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(dir);
    const parent = path.dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return [...new Set(candidates)];
}

function resolvePlatformKeys() {
  // Prefer the host platform jar first so a freshly built windows/macos
  // server is not shadowed by a stale linux copy checked earlier.
  const keys = [getScrcpyPlatformKey()];

  for (const key of Object.values(PLATFORM_DIR)) {
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }

  return keys;
}

function appendServerCandidates(target, rootDir, platformKey) {
  for (const fileName of SERVER_FILE_NAMES) {
    target.push(path.join(rootDir, "backend", "bin", "scrcpy", platformKey, fileName));
    target.push(path.join(rootDir, "bin", "scrcpy", platformKey, fileName));
  }
}

export function getScrcpyPlatformKey() {
  return PLATFORM_DIR[process.platform] ?? process.platform;
}

export function listScrcpyServerJarCandidates() {
  const configured = resolveConfiguredPath(process.env.CLOUD_PHONE_SCRCPY_SERVER_JAR);
  const candidates = [];

  if (configured) {
    candidates.push(configured);
  }

  // Host platform first, then other packaged copies.
  for (const platformKey of resolvePlatformKeys()) {
    for (const fileName of SERVER_FILE_NAMES) {
      candidates.push(path.join(SCRCPY_BIN_ROOT, platformKey, fileName));
    }
  }

  for (const rootDir of resolveProjectRootCandidates()) {
    for (const platformKey of resolvePlatformKeys()) {
      appendServerCandidates(candidates, rootDir, platformKey);
    }
  }

  return [...new Set(candidates)];
}

export function resolveScrcpyServerJarPath() {
  return firstExistingPath(listScrcpyServerJarCandidates());
}

export function getScrcpyServerJarPath() {
  return (
    resolveScrcpyServerJarPath() ??
    path.join(SCRCPY_BIN_ROOT, getScrcpyPlatformKey(), "scrcpy-server")
  );
}

export function getScrcpySourceRoot() {
  return SCRCPY_SOURCE_ROOT;
}

export function getScrcpyBinaryPath() {
  const platformKey = getScrcpyPlatformKey();
  const binaryName = process.platform === "win32" ? "scrcpy.exe" : "scrcpy";
  const configured = process.env.CLOUD_PHONE_SCRCPY_BIN;

  if (configured) {
    return path.resolve(configured);
  }

  return path.join(SCRCPY_BIN_ROOT, platformKey, binaryName);
}

export function isScrcpyBinaryReady() {
  return fs.existsSync(getScrcpyBinaryPath());
}

export function isScrcpyServerReady() {
  return Boolean(resolveScrcpyServerJarPath());
}

export function getScrcpyServerDiagnostics() {
  const resolved = resolveScrcpyServerJarPath();
  const candidates = listScrcpyServerJarCandidates();

  return {
    ready: Boolean(resolved),
    resolvedPath: resolved,
    expectedPath: path.join(SCRCPY_BIN_ROOT, getScrcpyPlatformKey(), "scrcpy-server"),
    projectRoot: PROJECT_ROOT_PATH,
    backendNodeRoot: BACKEND_NODE_ROOT_PATH,
    cwd: process.cwd(),
    candidatesChecked: candidates.slice(0, 12),
  };
}

// Must match backend/source/scrcpy/server/build.gradle versionName exactly.
// Keep it "4.0" so the official scrcpy desktop client can run with this server jar.
export const SCRCPY_SERVER_VERSION = "5.0.1";

/** Cloud-Phone web cast uses device-side WebSocket (ws-scrcpy wire), not scrcpy TCP sockets. */
export const SCRCPY_WEB_CAST_MODE = true;
