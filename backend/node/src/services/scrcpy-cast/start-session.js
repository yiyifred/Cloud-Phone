import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  getScrcpyServerDiagnostics,
  getScrcpyServerJarPath,
  SCRCPY_SERVER_VERSION,
  SCRCPY_WEB_CAST_MODE,
} from "../../config/scrcpy-paths.js";
import { requireScrcpyServer } from "../scrcpy-build.js";
import { runWithAdbLock } from "../adb-lock.js";
import { adbForward, adbForwardTcp, adbPush, clearDeviceTunnels, listAdbForward } from "../adb-command.js";
import { logCastError, logCastInfo, logCastWarn } from "./cast-logger.js";
import { appendCastStartupLog } from "./startup-log.js";
import { resolveCastServerOptions } from "./cast-options.js";
import { connectControlSocket } from "./control-bridge.js";
import {
  buildSocketName,
  CAST_TUNNEL_FORWARD,
  DEFAULT_CAST_SCID,
  getRemoteJarPath,
} from "./server-args.js";
import { isPortBindAccessDenied, pickAvailableLocalPort } from "../local-port.js";
import { getCastSession, setCastSession } from "./session-store.js";
import {
  buildCastStartPayload,
  tryReuseCastSession,
  waitForCastSessionReady,
} from "./session-reuse.js";
import { stopScrcpyCast } from "./stop-session.js";
import { createStreamStats } from "./stream-stats.js";
import { connectVideoSocket } from "./video-bridge.js";
import { waitForLocalPortOpen } from "./wait-for-local-port.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function establishForwardWithRetry(session, socketName, isWsScrcpy) {
  const serial = session.serial;
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const port = session.localPort;
    try {
      if (isWsScrcpy) {
        await adbForwardTcp(serial, port, 8886);
      } else {
        await adbForward(serial, port, socketName);
      }
      const forwardList = await listAdbForward(serial);
      logCastInfo(serial, "adb.forward.done", {
        localPort: port,
        socketName,
        forwardList,
        attempt,
      });
      appendCastStartupLog(session, `adb：forward 隧道完成 (local:${port})`);
      return;
    } catch (error) {
      lastError = error;
      if (!isPortBindAccessDenied(error) || attempt >= 5) {
        throw error;
      }
      const nextPort = await pickAvailableLocalPort();
      logCastWarn(serial, "adb.forward.retry", {
        failedPort: port,
        nextPort,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
      appendCastStartupLog(
        session,
        `adb：端口 ${port} 不可用 (10013/权限)，改用 ${nextPort}`,
      );
      session.localPort = nextPort;
    }
  }

  throw lastError ?? new Error("adb forward failed");
}

/**
 * @param {string} jarPath
 */
function describeServerJar(jarPath) {
  try {
    const st = fs.statSync(jarPath);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(jarPath)).digest("hex").slice(0, 12);
    return {
      jarPath,
      jarBytes: st.size,
      jarMtime: st.mtime.toISOString(),
      jarSha256_12: hash,
      jarDiagnostics: getScrcpyServerDiagnostics(),
    };
  } catch (error) {
    return {
      jarPath,
      jarError: error instanceof Error ? error.message : "stat_failed",
      jarDiagnostics: getScrcpyServerDiagnostics(),
    };
  }
}

function tryAttachToLiveSession(serial, options) {
  const existing = getCastSession(serial);
  if (!existing || existing.stopping || existing.serverExited) {
    return null;
  }
  // Web cast: adb shell may detach (nohup) while server keeps running on :8886.
  if (existing.starting) {
    return null;
  }
  if (!existing.shellProcess && !existing.webCast && !existing.shellDetached) {
    return null;
  }
  return tryReuseCastSession(existing, serial, options);
}

export async function startScrcpyCast(serial, options = {}) {
  requireScrcpyServer();

  const jarPath = getScrcpyServerJarPath();
  const jarInfo = describeServerJar(jarPath);

  let existing = getCastSession(serial);

  if (
    existing &&
    existing.jarSha256_12 &&
    jarInfo.jarSha256_12 &&
    existing.jarSha256_12 !== jarInfo.jarSha256_12
  ) {
    logCastWarn(serial, "cast.start.jar_mismatch_restart", {
      sessionJar: existing.jarSha256_12,
      diskJar: jarInfo.jarSha256_12,
      consumerCount: existing.consumerCount ?? 0,
    });
    appendCastStartupLog(
      existing,
      `后端：scrcpy-server jar 已更新 (${existing.jarSha256_12} → ${jarInfo.jarSha256_12})，强制重建会话`,
    );
    await stopScrcpyCast(serial, { force: true });
    existing = null;
  }

  if (existing?.starting) {
    logCastInfo(serial, "cast.start.wait_inflight", {
      localPort: existing.localPort,
    });
    appendCastStartupLog(existing, "后端：等待进行中的 cast/start 完成以便复用");
    const ready = await waitForCastSessionReady(existing, serial);
    existing = getCastSession(serial);
    if (ready && existing) {
      const reused = tryReuseCastSession(existing, serial, options);
      if (reused) {
        return reused;
      }
    }
  } else {
    const reused = tryReuseCastSession(existing, serial, options);
    if (reused) {
      return reused;
    }
  }

  // Multi-app opens N windows → N cast/start. Never force-kill a still-live session
  // just because reuse raced; that would tear down every other window's virtual display.
  const liveReuse = tryAttachToLiveSession(serial, options);
  if (liveReuse) {
    return liveReuse;
  }

  existing = getCastSession(serial);
  if (existing) {
    const consumers = Math.max(0, Number(existing.consumerCount) || 0);
    const alive =
      !existing.serverExited &&
      !existing.stopping &&
      (Boolean(existing.shellProcess) ||
        Boolean(existing.webCast) ||
        Boolean(existing.shellDetached));
    if (consumers > 0 && alive) {
      logCastWarn(serial, "cast.start.busy_reuse_failed", {
        localPort: existing.localPort,
        consumerCount: consumers,
      });
      throw new Error("投屏会话正忙，无法为新窗口创建虚拟屏，请重试。");
    }

    logCastWarn(serial, "cast.start.replace_existing", {
      localPort: existing.localPort,
    });
    await stopScrcpyCast(serial, { force: true });
  }

  const scid = DEFAULT_CAST_SCID;
  const localPort = await pickAvailableLocalPort();
  const socketName = buildSocketName(scid);
  const serverOptions = resolveCastServerOptions(options);
  const isWsScrcpy = SCRCPY_WEB_CAST_MODE;

  logCastInfo(serial, "cast.start", {
    serverVersion: SCRCPY_SERVER_VERSION,
    scid: "default",
    localPort,
    socketName,
    tunnel: CAST_TUNNEL_FORWARD,
    options,
    ...jarInfo,
  });

  const session = {
    serial,
    scid,
    socketName,
    localPort,
    tunnelMode: CAST_TUNNEL_FORWARD,
    serverVersion: SCRCPY_SERVER_VERSION,
    webCast: SCRCPY_WEB_CAST_MODE,
    jarPath,
    jarSha256_12: jarInfo.jarSha256_12 ?? null,
    castOptions: { ...options, ...serverOptions },
    controlClients: new Set(),
    controlSocket: null,
    shellProcess: null,
    videoSocket: null,
    tcpServer: null,
    videoListenPromise: null,
    clients: new Set(),
    starting: true,
    stopping: false,
    streaming: false,
    streamStats: createStreamStats(),
    consumerCount: 1,
    serverExited: false,
    serverExitCode: null,
    serverExitSignal: null,
    startedAt: Date.now(),
    startupLogs: [],
  };

  appendCastStartupLog(session, "后端：开始 cast/start 会话");
  appendCastStartupLog(session, `后端：scrcpy-server 就绪 (${SCRCPY_SERVER_VERSION})`);

  setCastSession(serial, session);

  try {
    await runWithAdbLock(async () => {
      logCastInfo(serial, "adb.tunnels.clear", {});
      appendCastStartupLog(session, "adb：清理旧 forward 隧道");
      await clearDeviceTunnels(serial);

      logCastInfo(serial, "adb.push.begin", {
        remote: getRemoteJarPath(),
        ...jarInfo,
      });
      appendCastStartupLog(
        session,
        `adb：push scrcpy-server.jar 开始 (${path.basename(path.dirname(jarPath))}/${path.basename(jarPath)} ${jarInfo.jarBytes ?? "?"}B sha=${jarInfo.jarSha256_12 ?? "?"})`,
      );
      await adbPush(serial, jarPath, getRemoteJarPath());
      logCastInfo(serial, "adb.push.done", { remote: getRemoteJarPath() });
      appendCastStartupLog(session, "adb：push scrcpy-server.jar 完成");

      logCastInfo(serial, "adb.forward.begin", { localPort: session.localPort, socketName });
      appendCastStartupLog(session, "adb：建立 forward 隧道开始");
      await establishForwardWithRetry(session, socketName, isWsScrcpy);
    }, { lockKey: serial });

    if (isWsScrcpy) {
      const { ensureServerShell } = await import("./shell-launcher.js");
      appendCastStartupLog(session, "后端：预启动 scrcpy-server shell");
      await ensureServerShell(session, serverOptions);
    }
  } catch (error) {
    logCastError(serial, "cast.start.adb_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    await stopScrcpyCast(serial, { force: true });
    throw error;
  }

  session.starting = false;

  logCastInfo(serial, "cast.start.ready", {
    localPort: session.localPort,
    socketName,
    tunnel: CAST_TUNNEL_FORWARD,
    message: "Forward tunnel ready; scrcpy framed stream starts when WebSocket connects",
  });
  appendCastStartupLog(session, "后端：cast/start 完成，等待 WebSocket 连接");

  return buildCastStartPayload(session, options);
}

export async function ensureCastVideoPipe(sessionKey) {
  const session = getCastSession(sessionKey);

  if (!session) {
    throw new Error("Cast session is not active.");
  }

  const serial = session.serial;

  // ws-scrcpy modified server streams over its own WebSocket server, no scrcpy TCP sockets.
  if (session.webCast ?? SCRCPY_WEB_CAST_MODE) {
    const { ensureServerShell } = await import("./shell-launcher.js");
    logCastInfo(serial, "video.pipe.web_cast", {
      sessionKey,
      localPort: session.localPort,
      deviceWsPort: session.deviceWsPort ?? 8886,
      serverExited: session.serverExited ?? false,
    });
    appendCastStartupLog(session, "后端：准备 WebSocket 视频管道");
    await ensureServerShell(session, session.castOptions ?? {});

    if (session.serverExited) {
      throw new Error("scrcpy-server shell exited before the cast port became ready.");
    }

    const shouldAbort = () =>
      getCastSession(sessionKey) !== session || session.stopping || session.serverExited;

    await waitForLocalPortOpen(session.localPort, {
      timeoutMs: 15_000,
      shouldAbort,
    });

    if (shouldAbort()) {
      throw new Error("Cast session stopped while waiting for local port.");
    }

    logCastInfo(serial, "video.pipe.web_cast_ready", {
      sessionKey,
      localPort: session.localPort,
      shellPid: session.shellProcess?.pid ?? null,
      serverExited: session.serverExited ?? false,
    });
    appendCastStartupLog(session, "后端：WebSocket 视频管道就绪");
    return session;
  }

  if (session.videoSocket) {
    return session;
  }

  const { ensureServerShell } = await import("./shell-launcher.js");

  let lastError = new Error("Unable to connect scrcpy video socket.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    logCastInfo(serial, "video.pipe.retry", {
      attempt: attempt + 1,
      tunnel: CAST_TUNNEL_FORWARD,
      serverExited: session.serverExited ?? false,
    });

    try {
      if (session.serverExited || !session.shellProcess) {
        await ensureServerShell(session, session.castOptions ?? {});
        await delay(500);
      }

      await connectVideoSocket(session);

      if (resolveCastServerOptions(session.castOptions ?? {}).control) {
        await connectControlSocket(session);
      }

      return session;
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;

      if (session.videoSocket) {
        try {
          session.videoSocket.destroy();
        } catch {
          // ignore
        }

        session.videoSocket = null;
      }

      if (session.serverExited) {
        session.shellProcess = null;
      }

      await delay(300);
    }
  }

  logCastError(serial, "video.pipe.give_up", {
    message: lastError.message,
    forwardList: await listAdbForward(serial),
  });

  throw lastError;
}
