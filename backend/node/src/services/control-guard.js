import { APP_VERSION } from "../config/version.js";
import { getSessionTokenFromCookies } from "../middleware/api-auth.js";
import { parseCookies } from "../utils/cookies.js";
import { sendProtectedJson } from "../utils/protected-http.js";
import {
  ControlLeaseError,
  assertControlPermission,
  getControlLease,
  isControlEnforced,
  sessionKeyOf,
} from "./device-control-lease.js";
import { summarizeWsPacket } from "./scrcpy-cast/ws-packet-summary.js";

/**
 * 控制权租约在「会互相打架」的入口上的接线层（T-421）。
 *
 * 默认 advisory（CLOUD_PHONE_CONTROL_ENFORCE 未开）时本模块**完全不改变既有行为**：
 * HTTP 走 assertControlPermission 不抛，投屏连 emit 补丁都不打，终端不拦。
 * 只有 strict 才进入拒绝分支，避免单用户场景被租约机制打断。
 */

/** 非持有者被拦时的回执间隔：拖动是 60fps，每帧回执会变成回执风暴。 */
const DENY_NOTICE_INTERVAL_MS = 2_000;
/** WS 正常关闭码之外的自定义码，前端可据此提示「没有控制权」而不是「连接坏了」。 */
export const CONTROL_DENIED_CLOSE_CODE = 4403;

/**
 * WebSocket 关闭帧的 reason 上限是 123 字节（RFC 6455 控制帧 125 字节减去 2 字节码），
 * 超了 ws 会抛 RangeError、连接留在打开状态——中文一条提示就可能超。
 * 这里按字节裁剪且不切坏 UTF-8 码点。
 *
 * @param {string} text
 * @param {number} [maxBytes]
 */
export function clampCloseReason(text, maxBytes = 123) {
  const full = String(text ?? "");
  const buffer = Buffer.from(full, "utf8");

  if (buffer.length <= maxBytes) {
    return full;
  }

  let end = maxBytes;

  // 110xxxxx / 10xxxxxx 是 UTF-8 续字节，回退到码点起点，避免解出替换字符
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) {
    end -= 1;
  }

  return buffer.subarray(0, end).toString("utf8");
}

/**
 * 只影响「自己这条视频管线」的控制类型：RESET_VIDEO 是某一路观众解码卡住时
 * 请求关键帧用的，CHANGE_STREAM_PARAMETERS 是观众自己调整清晰度用的。
 * 拦掉它们会让旁观者连画面都看不到，而它们并不抢占设备输入，因此放行。
 */
const VIEW_ONLY_CONTROL_TYPES = new Set(["RESET_VIDEO", "CHANGE_STREAM_PARAMETERS"]);

/** @param {import("node:http").IncomingMessage} req */
export function getRequestSessionToken(req) {
  return getSessionTokenFromCookies(parseCookies(req?.headers?.cookie));
}

/**
 * 判断浏览器发来的帧是不是「会改变设备状态/抢占输入」的控制帧。
 * 复用 ws-packet-summary 的类型解析，避免自己再维护一份 scrcpy 控制类型表。
 */
export function isDeviceControlFrame(data) {
  const summary = summarizeWsPacket(data);

  if (summary.kind !== "control") {
    return false;
  }

  return !VIEW_ONLY_CONTROL_TYPES.has(summary.controlType);
}

function denialMessage(code, serial, holder) {
  if (code === "control_lease_held") {
    const who = holder?.label ? `（${holder.label}）` : "";
    return `设备 ${serial} 正被其他会话控制${who}，请先申请控制权或稍后重试。`;
  }

  return `设备 ${serial} 尚未分配控制权，请先申请控制权再执行该操作。`;
}

/**
 * HTTP 写类路由闸门。
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} serial
 * @param {string} action 用于日志与响应体，例如 "app_uninstall"
 * @returns {boolean} true = 已发送 409 拒绝响应，调用方应立即 return
 */
export function denyWriteIfNotController(req, res, serial, action) {
  try {
    assertControlPermission(serial, getRequestSessionToken(req), { action });
    return false;
  } catch (error) {
    // 租约模块以外的异常不能伪装成「没权限」，交回路由既有 catch 处理
    if (!(error instanceof ControlLeaseError)) {
      throw error;
    }

    sendProtectedJson(res, error.statusCode ?? 409, {
      success: false,
      version: APP_VERSION,
      serial,
      action,
      error: error.code,
      message: denialMessage(error.code, serial, error.holder),
      holder: error.holder ?? null,
      enforced: true,
    });

    return true;
  }
}

/**
 * 终端 WS 的开壳前置判断。
 *
 * viewer（只读分享）无论租约如何都不得开 shell：终端等于设备上的任意命令执行。
 *
 * @param {string} serial
 * @param {string|null} sessionToken
 * @param {{role?: "admin"|"viewer"}} [options]
 * @returns {null | {code: string, message: string, holder: object|null}}
 */
export function describeTerminalDenial(serial, sessionToken, options = {}) {
  if (options.role === "viewer") {
    return {
      code: "viewer_forbidden",
      holder: null,
      message: "只读分享不能使用终端。",
    };
  }

  if (!isControlEnforced()) {
    return null;
  }

  const snapshot = getControlLease(serial, sessionKeyOf(sessionToken));

  if (snapshot.mine) {
    return null;
  }

  const code = snapshot.held ? "control_lease_held" : "control_lease_required";

  return {
    code,
    holder: snapshot.holder ?? null,
    message: `${denialMessage(code, serial, snapshot.holder)}终端已拒绝打开。`,
  };
}

/** 回执帧：viewer 与「不持租约」两种拒绝共用 type，用 reason / error 区分来源。 */
function buildDeniedPayload(serial, verdict, deniedFrames) {
  if (verdict.kind === "viewer") {
    return {
      type: "control-denied",
      reason: "viewer",
      serial,
      message: "当前是只读分享访问，不能操作设备。",
      deniedFrames,
    };
  }

  return {
    type: "control-denied",
    serial,
    error: verdict.code,
    message: denialMessage(verdict.code, serial, verdict.holder),
    holder: verdict.holder ?? null,
    deniedFrames,
  };
}

function sendControlDenied(ws, serial, verdict, deniedFrames) {
  if (ws.readyState !== 1) {
    return;
  }

  try {
    ws.send(JSON.stringify(buildDeniedPayload(serial, verdict, deniedFrames)));
  } catch (error) {
    // 回执发不出去不能静默：日志里必须留下「有人在无权限状态下操作」的证据
    console.warn("[control-guard] control-denied 回执发送失败：", error?.message ?? error);
  }
}

/**
 * 在 ws.emit 这一层拦帧的通用实现。
 *
 * 为什么改 emit 而不是加一个 message 监听器：Node 的 EventEmitter 没有
 * stopPropagation，而同一个投屏 socket 上有三路 message 监听（首帧早缓冲、
 * ws-scrcpy 代理、legacy 桥接）。只在 emit 这一层拦下，才能保证三路都拿不到被拒的帧。
 *
 * @param {import("ws").WebSocket} ws
 * @param {(data: unknown) => null | {kind: string, code?: string, holder?: object|null}} decide
 * @param {(ws: any, verdict: any, deniedFrames: number) => void} notify
 */
function installEmitGate(ws, decide, notify) {
  const state = { deniedFrames: 0, lastNoticeAt: 0 };
  const originalEmit = ws.emit;

  ws.emit = function emitWithControlGate(event, ...args) {
    if (event !== "message") {
      return originalEmit.call(this, event, ...args);
    }

    const verdict = decide(args[0]);

    if (!verdict) {
      return originalEmit.call(this, event, ...args);
    }

    state.deniedFrames += 1;

    const now = Date.now();

    if (now - state.lastNoticeAt >= DENY_NOTICE_INTERVAL_MS) {
      state.lastNoticeAt = now;
      notify(this, verdict, state.deniedFrames);
    }

    // 丢弃：不返回 false 之外的任何信号，避免下游把「已拦下」误当成「已转发」
    return false;
  };

  return state;
}

/**
 * 投屏 WS 的控制帧闸门。
 *
 * 两种拒绝来源共用一条管线（限流、回执格式都一致）：
 * - viewer（只读分享）：任何控制帧都丢，不参与租约判定 —— 分享凭据永远没有控制权；
 * - 管理员 + strict：非租约持有者的控制帧丢弃；
 * - 管理员 + advisory：直接返回 null 且不打补丁，保证既有行为逐字节一致。
 *
 * @param {import("ws").WebSocket} ws
 * @param {{serial: string, sessionToken?: string|null, role?: "admin"|"viewer"}} options
 */
export function installCastControlFrameGate(ws, { serial, sessionToken = null, role = "admin" } = {}) {
  if (typeof ws?.emit !== "function") {
    return null;
  }

  const isViewer = role === "viewer";

  if (!isViewer && !isControlEnforced()) {
    return null;
  }

  const sessionKey = sessionKeyOf(sessionToken);

  const decide = isViewer
    ? (data) => (isDeviceControlFrame(data) ? { kind: "viewer" } : null)
    : (data) => {
        const snapshot = getControlLease(serial, sessionKey);

        if (snapshot.mine || !isDeviceControlFrame(data)) {
          return null;
        }

        return {
          kind: "lease",
          code: snapshot.held ? "control_lease_held" : "control_lease_required",
          holder: snapshot.holder ?? null,
        };
      };

  return installEmitGate(ws, decide, (socket, verdict, deniedFrames) =>
    sendControlDenied(socket, serial, verdict, deniedFrames),
  );
}
