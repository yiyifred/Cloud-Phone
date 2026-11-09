# plan · T-438

1. `utils/h264-decoder-config.js`：新增 `ACCEL_CANDIDATES` 与 `pickSupportedConfig(base, startIndex)`。
2. `utils/ws-scrcpy-annexb-player.js`：`#configureFromSps` 改走 `pickSupportedConfig`；`error` 回调命中配置类错误时 `#retryWithNextAccel()` 重建解码器并降档；`_configSeq` 防异步竞态。
3. `utils/h264-keyframe-guard.js`：把关键帧等待/节流抽成独立守卫，保持文件 ≤300 行。
4. 验证：CDP 插桩 `VideoDecoder` 观察 configure/out；对比 canvas 尺寸与中心像素。
5. 文档：`tasks/T-438.md`、CHANGELOG 1.28.1。
