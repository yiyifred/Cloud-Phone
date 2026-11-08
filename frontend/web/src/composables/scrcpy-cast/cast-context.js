/**
 * 投屏（scrcpy）会话的共享状态容器（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么用「一个可变对象 + 多个模块写同一份字段」而不是每个模块各自持 ref：
 * 原实现是单个函数闭包，`socket` / `player` / `audioPlayback` / `openWebSocketReady`
 * 这些值在同一次会话里只有一份，各个函数读写的是同一个变量。拆文件后若各自
 * 声明一份，控制通道发出的帧就到不了真正的 socket、断流也清不掉真正的 player。
 * 因此这里保留「一个实例、多处引用」的语义，字段名与原来一一对应，便于对照。
 *
 * 注意：只有需要驱动视图的状态才用 ref；纯连接期的句柄（socket / timer）保持普通字段，
 * 避免无意义地触发响应式追踪。
 */
import { ref, shallowRef } from "vue";

import { createCastStartupLog } from "../../utils/cast-startup-log.js";

export function createCastContext() {
  return {
    // ---- 视图状态 ----
    status: ref("idle"),
    errorMessage: ref(""),
    startupLogText: ref("等待连接日志…"),
    showStartupLogs: ref(false),
    // player 内部持有解码器与 canvas 绑定，不能被深代理，否则 WebCodecs 对象会被劫持。
    player: shallowRef(null),
    screenSize: ref({ width: 0, height: 0 }),
    sessionMeta: ref(null),
    displayScreenOn: ref(true),

    // ---- 启动日志 ----
    startupLog: createCastStartupLog(),
    logPollTimer: null,
    logPollConsumed: 0,

    // ---- 连接期句柄（非响应式）----
    socket: null,
    stopRequest: null,
    unbindCanvas: null,
    unbindKeyboard: null,
    /** True after POST /cast/start succeeded (backend has a session). */
    backendSessionActive: false,
    audioPlayback: null,
    startAppTimer: null,
    startAppSent: false,
    openWebSocketReady: null,
    clipboardSequence: 0n,
    lastOutboundClipboard: "",
  };
}
