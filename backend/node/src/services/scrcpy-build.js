import { getScrcpyServerJarPath, isScrcpyServerReady } from "../config/scrcpy-paths.js";
import { ScrcpyServerMissingError } from "./scrcpy-server-install.js";

/**
 * Return the installed scrcpy-server path.
 *
 * The server jar is a build artifact that is not shipped with the repository:
 * the operator installs it once through the Web console (upload, download or a
 * manual copy). A missing jar is a normal, recoverable state, so it is reported
 * as ScrcpyServerMissingError instead of starting a background build.
 */
export function requireScrcpyServer() {
  if (!isScrcpyServerReady()) {
    throw new ScrcpyServerMissingError();
  }

  return getScrcpyServerJarPath();
}
