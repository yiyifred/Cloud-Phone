/**
 * 启动日志通道（T-433 从 useDeviceScrcpyCast 抽出）。
 *
 * 为什么单独成模块：启动日志的写入点分散在连接、流参数、错误三条路径上，
 * 而它同时承担两件事——(1) 面板上滚动的文本；(2) 通过 bridgeCastStreamLog
 * 把同一行转发到「日志」页。集中在一处才能保证两边内容永远一致。
 * 后端日志轮询也放这里，因为它唯一的消费者就是这块文本。
 */
import { bridgeCastStreamLog } from "../../utils/cast-stream-log-bridge.js";
import { getDeviceCastStatus } from "../../utils/cast-api.js";

export function createCastStartupLogChannel({ ctx, serialRef }) {
  function sync() {
    ctx.startupLogText.value = ctx.startupLog.textValue();
  }

  function append(message) {
    ctx.startupLog.append(message);
    bridgeCastStreamLog(message, {
      castType: "scrcpy",
      deviceSerial: serialRef.value,
      source: "scrcpy-startup-log",
    });
    sync();
  }

  /** 只把「新出现」的行转发到日志页，避免每轮轮询重复写整段历史。 */
  function ingest(entries) {
    const before = ctx.startupLog.lines.length;
    ctx.startupLog.ingest(entries);
    if (ctx.startupLog.lines.length !== before) {
      for (const line of ctx.startupLog.lines.slice(before)) {
        const message = line.replace(/^\d{1,2}:\d{2}:\d{2}\s+/, "");
        bridgeCastStreamLog(message, {
          castType: "scrcpy",
          deviceSerial: serialRef.value,
          source: "scrcpy-backend-log",
        });
      }
      sync();
    }
  }

  function reset() {
    ctx.startupLog.reset();
    sync();
  }

  function stopPolling() {
    if (ctx.logPollTimer) {
      clearInterval(ctx.logPollTimer);
      ctx.logPollTimer = null;
    }
    ctx.logPollConsumed = 0;
  }

  function startPolling(serial) {
    stopPolling();
    ctx.logPollTimer = window.setInterval(async () => {
      try {
        const payload = await getDeviceCastStatus(serial);
        const entries = payload?.startupLogs;
        if (!Array.isArray(entries) || entries.length <= ctx.logPollConsumed) {
          return;
        }
        ingest(entries.slice(ctx.logPollConsumed));
        ctx.logPollConsumed = entries.length;
      } catch {
        // 轮询失败不打断投屏：后端 404/超时都会走到这里，下一轮自然重试。
      }
    }, 600);
  }

  function hide() {
    ctx.showStartupLogs.value = false;
    stopPolling();
  }

  return { sync, append, ingest, reset, stopPolling, startPolling, hide };
}
