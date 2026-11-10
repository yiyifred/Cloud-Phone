---
status: frozen
owner: lead
task: T-441
---

# scrcpy 设备端 4.0 → v5.0.1 升级（保留 WebSocket 投屏改造）

## 1 背景
`backend/source/scrcpy` 基线是上游 4.0（2026-05）。上游已到 v5.0.1（2026-10-08），中间 4.1、5.0 两个版本带设备端能力（VP8/VP9、尺寸约束算法、推文件后扫描、播放音频 usage 覆盖等）。本仓库在该目录上做了 WebSocket 投屏改造，不能直接覆盖。

## 2 目标
- 设备端 server 源码基线升到 5.0.1，`SCRCPY_SERVER_VERSION=5.0.1`。
- 保留 `ws/` 全部改造与三处关键修补（CSD 补全、type-101 不重建采集、虚拟屏被拒不重试）。
- 重新编译三平台 `scrcpy-server` 并在 Waydroid 上实跑出帧。

## 3 非目标
- 不移植 `app/`（桌面 SDL 客户端）的 5.0 硬解代码：本仓库从不构建桌面客户端。
- 不改前端播放器的编解码能力（VP8/VP9 仅设备端可协商）。

## 4 用户路径与接口契约
- 后端 `cast/start` → adb push 新 jar → 设备端 ws 服务（8886）→ 客户端发 type-101 → 出 Annex-B 帧。
- `serverVersion` 字段由 `backend/node/src/config/scrcpy-paths.js` 的 `SCRCPY_SERVER_VERSION` 提供，必须与 `server/build.gradle` 的 `versionName` 一致。

## 5 数据与状态模型
- 新增 `Options.ignoreVideoEncoderConstraints`，键 `ignore_video_encoder_constraints`。
- 新增控制消息 `TYPE_SCAN_FILE=22`，设备端 `Controller.scanFile()` 触发 `ACTION_MEDIA_SCANNER_SCAN_FILE`。

## 6 错误与边界
- 编码器不认约束时 5.0.1 不再预先把尺寸收窄，失败后才降级；`--ignore-video-encoder-constraints` 可完全跳过。
- 虚拟屏被系统拒绝（`virtual_display_denied`）时不重试：降分辨率无意义，直接上报。

## 7 验收断言
- AC-1 `backend/source/scrcpy/meson.build` version = `5.0.1`；`server/build.gradle` versionName = `5.0.1`。
- AC-2 `node tools/build-scrcpy-server.mjs` 成功，三平台产物 819490 B。
- AC-3 Waydroid ws 投屏出帧：h264 12 帧 / 101450 B、h265 23 帧 / 380505 B、vp9 12 帧（`tools/.tmp/T-441/`）。
- AC-4 重复 type-101（`MODE=diff`）仍 12 帧，未回退成 0 帧。
- AC-5 `npx vite build` 通过。

## 8 依赖与假设
- 上游 tarball `/tmp/scrcpy-4.0`、`/tmp/scrcpy-5.0.1`；gradle 9.3.1 + JDK 21 + Android SDK 36。
- 依赖 `org.java-websocket:Java-WebSocket:1.5.6` 需保留在 `server/build.gradle`（上游没有）。

## 9 未决问题
- desktop 客户端（`app/`）未同步，若以后要发布桌面版需单独一单，并把 `app/src/cloud_phone` 的接缝重做。
