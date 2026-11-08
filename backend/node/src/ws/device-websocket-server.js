import { WebSocketServer } from "ws";

import {
  handleCastControlWebSocket,
  handleCastWebSocket,
  parseCastWebSocketPath,
} from "../routes/device-cast-ws.js";
import {
  handleDeviceTerminalWebSocket,
  parseTerminalWebSocketPath,
} from "../routes/device-terminal-routes.js";
import { isAllowedWsOrigin, resolveWebSocketPrincipal } from "../middleware/ws-auth.js";
import {
  CONTROL_DENIED_CLOSE_CODE,
  clampCloseReason,
  describeTerminalDenial,
  installCastControlFrameGate,
} from "../services/control-guard.js";
import { logCastInfo, logCastWarn } from "../services/scrcpy-cast/cast-logger.js";
import { wsConnections } from "../metrics/definitions.js";

/** Terminal sockets spawn an adb shell each: a single session must not be able to fork-bomb the host. */
const TERMINAL_MAX_PER_DEVICE = 4;
const TERMINAL_MAX_TOTAL = 32;
const CAST_MAX_TOTAL = 64;
/** Client frames are control messages (touch/key/clipboard); 4 MiB is generous. */
const WS_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** @type {Map<string, number>} */
const terminalByDevice = new Map();
let terminalTotal = 0;
let castTotal = 0;

function acquireTerminalSlot(serial) {
  const current = terminalByDevice.get(serial) ?? 0;

  if (current >= TERMINAL_MAX_PER_DEVICE || terminalTotal >= TERMINAL_MAX_TOTAL) {
    return null;
  }

  terminalByDevice.set(serial, current + 1);
  terminalTotal += 1;

  return () => {
    const remaining = (terminalByDevice.get(serial) ?? 1) - 1;
    if (remaining <= 0) {
      terminalByDevice.delete(serial);
    } else {
      terminalByDevice.set(serial, remaining);
    }
    terminalTotal = Math.max(0, terminalTotal - 1);
  };
}

function acquireCastSlot() {
  if (castTotal >= CAST_MAX_TOTAL) {
    return null;
  }

  castTotal += 1;

  return () => {
    castTotal = Math.max(0, castTotal - 1);
  };
}

export function setupDeviceWebSocket(server) {
  const wss = new WebSocketServer({
    noServer: true,
    // H.264 is already compressed; deflate adds CPU and latency on the hot path.
    perMessageDeflate: false,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
  });

  server.on("upgrade", async (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const castRoute = parseCastWebSocketPath(requestUrl.pathname);
    const terminalRoute = parseTerminalWebSocketPath(requestUrl.pathname);

    if (!castRoute && !terminalRoute) {
      socket.destroy();
      return;
    }

    const serial = castRoute?.serial ?? terminalRoute?.serial ?? "unknown";

    if (!isAllowedWsOrigin(request)) {
      logCastWarn(serial, "ws.rejected", {
        reason: "origin_not_allowed",
        origin: request.headers.origin ?? null,
        path: requestUrl.pathname,
      });
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // 管理员会话优先，其次只读分享令牌（viewer）；两者都没有才是 401
    const principal = await resolveWebSocketPrincipal(request);

    if (!principal) {
      logCastWarn(serial, "ws.rejected", {
        reason: "unauthorized",
        path: requestUrl.pathname,
      });
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // 控制权租约要用「这条连接属于哪个会话」来判断；viewer 没有会话 token（分享凭据永远不持租约）
    const role = principal.role;
    const sessionToken = principal.sessionToken ?? null;

    const release = terminalRoute ? acquireTerminalSlot(serial) : acquireCastSlot();

    if (!release) {
      logCastWarn(serial, "ws.rejected", { reason: "connection_limit", path: requestUrl.pathname });
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    const channel = castRoute?.channel ?? "terminal";

    logCastInfo(serial, "ws.upgrade", { path: requestUrl.pathname, channel, role });

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.once("close", release);
      // 用 gauge 记「当前占着几个并发槽位」：上面 acquire*Slot 的上限告急要能提前看见；
      // kind 只取 video/control/terminal 三个固定值，序列数因此有界
      wsConnections.inc({ kind: channel });
      ws.once("close", () => wsConnections.dec({ kind: channel }));

      if (terminalRoute) {
        // strict 下非持有者不许开 shell：升级后立刻带原因关闭，避免先起 adb shell 再断
        // viewer 无论租约状态都不得开 shell：终端等于设备上的任意命令执行
        const denial = describeTerminalDenial(terminalRoute.serial, sessionToken, { role });

        if (denial) {
          logCastWarn(serial, "ws.terminal.denied", {
            code: denial.code,
            holder: denial.holder?.reference ?? null,
          });

          try {
            // reason 必须 ≤123 字节，否则 ws 抛 RangeError 且连接留在打开状态
            ws.close(CONTROL_DENIED_CLOSE_CODE, clampCloseReason(denial.message));
          } catch (error) {
            console.warn("[ws] 终端拒绝关闭失败，改用强制终止：", error?.message ?? error);
            ws.terminate();
          }

          return;
        }

        handleDeviceTerminalWebSocket(ws, terminalRoute.serial);
        return;
      }

      // 控制帧闸门必须在任何 message 监听器之前装好（管理员+advisory 下不打补丁）
      // viewer 照常收画面，但控制帧一律丢弃；管理员走 T-421 的租约判定
      installCastControlFrameGate(ws, { serial: castRoute.serial, sessionToken, role });

      if (castRoute.channel === "control") {
        void handleCastControlWebSocket(ws, castRoute.serial);
        return;
      }

      // Buffer client frames IMMEDIATELY — browser may send type 101 on open
      // before async handleCastWebSocket attaches its own listener.
      const earlyClientMessages = [];
      const onEarlyMessage = (data) => {
        earlyClientMessages.push(data);
      };
      ws.on("message", onEarlyMessage);

      void handleCastWebSocket(ws, castRoute.serial, {
        earlyClientMessages,
        detachEarlyMessage: () => ws.off("message", onEarlyMessage),
        sessionKey: requestUrl.searchParams.get("sessionKey") || castRoute.serial,
        sessionToken,
      });
    });
  });

  return wss;
}
