---
status: frozen
owner: lead
task: T-438
---

# 投屏首帧黑屏：解码配置降级

## 1 背景（≤5 行）
Web 工作区点「开始投屏」后，浏览器确实收到 Annex-B 视频帧（CDP 计数 14 个大帧 / 154 KB），但 `<canvas>` 停在默认 `300x150`，画面全黑。设备端编码正常，`ffprobe` 可解。

## 2 目标（1–3 条）
- 浏览器不支持 `hardwareAcceleration: "prefer-hardware"` 的 H.264 解码时，自动降级到 `prefer-software` / `no-preference` 并出首帧。

## 3 非目标
- 不改设备端采集与编码参数，不改后端 WS 代理，不引入软解 wasm 兜底。

## 4 用户路径与接口契约
- 路径：工作区 → 开始投屏 → WS `/api/devices/<serial>/cast/ws` → 收到 `scrcpy_initial` 与 type-101 应答 → Annex-B 帧。
- 契约：`VideoDecoder.configure()` 前用 `VideoDecoder.isConfigSupported()` 探测；未通过则换下一档；异步 `error` 回调里再降一档重试一次。

## 5 数据与状态模型
- `_configAttempt`：当前加速档位下标（0 prefer-hardware / 1 prefer-software / 2 no-preference）。
- `_configSeq`：配置代次，异步探测返回后若代次不一致则丢弃结果。
- 关键帧守卫状态：`needIdr` / `hadIdr`（`h264-keyframe-guard.js`）。

## 6 错误与边界
- 三档全不支持：`lastError` 写 `H.264 解码配置不受支持：<codec>`，不再发关键帧请求。
- `isConfigSupported` 抛错：视为不支持，继续降档。
- 解码器报错后 `state` 变 `closed`，重试前必须重建 `VideoDecoder`。

## 7 验收断言
- AC-1：`VideoDecoder.isConfigSupported({codec:"avc1.42c029",hardwareAcceleration:"prefer-hardware"})` 返回 `supported:false` 的环境下，UI 开播后 canvas 尺寸等于帧尺寸（1280x768），中心像素非纯黑。
- AC-2：`window.__dec` 中出现 `configure ... prefer-software`，随后出现 `out 1280x768`。
- AC-3：控制台无新增 `error` / `exception`。

## 8 依赖与假设
- 证据：`tools/.tmp/T-438/ui-cast-fixed.png`（修复后截图）、CDP 脚本 `/tmp/cdp8.mjs`（解码器插桩）、`/tmp/cdp9.mjs`（三档探测输出）。
- 假设：headless Chromium 156 无硬件 H.264 解码，故 `prefer-hardware` 必然不可用。

## 9 未决问题
- none
