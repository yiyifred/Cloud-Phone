/**
 * 本项目实际要采集的指标定义集中在这里。
 *
 * 标签取值必须来自「可枚举的小集合」：方法、模板化路由、状态码、失败原因、连接类型。
 * 设备序列号、包名、sessionKey、token 一律不进标签——它们是高基数且带隐私，
 * 需要按设备下钻时用日志，不要用指标。
 */

import { defineCollectedGauge, defineCounter, defineGauge, defineHistogram } from "./registry.js";
import { listCastSessions } from "../services/scrcpy-cast/session-store.js";

/** 请求总数：route 是模板化路径（如 /api/devices/:serial/cast/start）。 */
export const httpRequestsTotal = defineCounter(
  "cloud_phone_http_requests_total",
  "HTTP 请求总数，route 为模板化路径（不含设备序列号）",
);

/** 耗时直方图：bucket 覆盖「本机 adb 快返回」到「设备操作超时」的量级。 */
export const httpRequestDurationSeconds = defineHistogram(
  "cloud_phone_http_request_duration_seconds",
  "HTTP 请求耗时（秒）",
  [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
);

/** WS 连接数：kind=video/control/terminal，按通道区分才看得出是哪类流被占满。 */
export const wsConnections = defineGauge(
  "cloud_phone_ws_connections",
  "当前活跃的 WebSocket 连接数（kind=video/control/terminal）",
);

/** 登录失败：reason 区分「密码错」与「被节流挡住」，后者偏高说明有人在爆破。 */
export const loginFailuresTotal = defineCounter(
  "cloud_phone_login_failures_total",
  "登录失败次数（reason=bad_password/ip_lockout/global_lockout）",
);

/**
 * harmony / ios 的 session store 只按 serial 存取、不提供枚举，无法在采集时求和；
 * 这两类会话只能由路由层在「会话建立/结束」时增减。android(scrcpy) 走 session store 真值。
 */
let nonScrcpyCastSessions = 0;

/** @param {number} delta 建立 +1、结束 -1 */
export function noteNonScrcpyCastSession(delta) {
  nonScrcpyCastSessions = Math.max(0, nonScrcpyCastSessions + delta);
}

export const castSessions = defineCollectedGauge(
  "cloud_phone_cast_sessions",
  "当前活跃的投屏会话数（android 采集时读 session store，harmony/ios 由路由层增减）",
  () => listCastSessions().length + nonScrcpyCastSessions,
);
