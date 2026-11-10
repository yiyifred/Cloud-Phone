# Cloud Phone scrcpy 集成

源码自 `projects/scrcpy` 同步到 `backend/source/scrcpy`，并增加 Cloud Phone 调用入口。

## 网络投屏原理

### 官方 scrcpy

1. 主机通过 ADB 将 `scrcpy-server.jar` 推到设备 `/data/local/tmp/`
2. 在设备上启动 Java 服务，采集屏幕/摄像头并 H.264/H.265 编码
3. 通过 `adb reverse` 或 `adb forward` 建立 **视频套接字** 与 **控制套接字**
4. 桌面客户端 (C/SDL) 接收码流解码显示，键盘鼠标事件经控制通道注入

### ws-scrcpy（协议参考，不修改 `projects/ws-scrcpy`）

1. 浏览器/Node 使用 **`scrcpy_initial` / `scrcpy_message` 魔数** 与 Annex-B H.264（见 `frontend/web` 与 `backend/node/.../ws-scrcpy-protocol.js`）
2. 设备端需在 server 内嵌 **WebSocket 服务**（NetrisTV fork 实现），或通过 Node 把官方 **framed TCP** 转成 ws-scrcpy 协议

### NetrisTV fork（`projects/scrcpy-ws-scrcpy`，对照用，非最终产物）

基于 **scrcpy 1.19**（`versionName 1.19-ws7`），与仓库内 **官方 4.0**（`backend/source/scrcpy`）架构不同，仅作 diff 参考：

| 类别 | fork 新增/改动 | 官方 4.0 |
|------|----------------|----------|
| 入口 | `Server` 第二参数 `web` → `WSServer` | `Options.parse` 全 `key=value`，`scrcpy(options)` |
| 传输 | `WSServer` + `WebSocketConnection`（端口默认 **8886**） | `DesktopConnection` + `LocalSocket` / `tunnel_forward` |
| 编码输出 | `ScreenEncoder` → `Connection.send`（可选 12 字节 PTS 头） | `SurfaceEncoder` + `Streamer`（12 字节 packet flags） |
| 控制 | `TYPE_CHANGE_STREAM_PARAMETERS`(101)、`TYPE_PUSH_FILE`(102)、`VideoSettings` | 更多官方类型（UHID、相机等），**无** 101/102 |
| 依赖 | `Java-WebSocket`、slf4j | 无第三方网络库 |
| 包结构 | 扁平 `com.genymobile.scrcpy.*`（约 42 个类） | 子包 `device/` `video/` `control/` 等（约 89 个类） |

**Cloud-Phone 目标**：在 **`backend/source/scrcpy`（官方 4.0）** 上移植 WebSocket 能力与 ws-scrcpy 线协议，本地编译 `scrcpy-server`（版本号与官方桌面客户端一致：`5.0.1`），避免 `scrcpy.exe` 直连时报版本不匹配。**不要**长期依赖预编译的 `1.19-ws7` jar。

**当前运行时**：`SCRCPY_SERVER_VERSION=5.0.1`（设备端 server 源码已同步到上游 v5.0.1，见下节「与上游同步」）；`SCRCPY_WEB_CAST_MODE=true` 时 Node 走 `web DEBUG 8886` 与 `/cast/ws` 代理。启动前会 `pkill -f com.genymobile.scrcpy.Server` 清理残留进程，避免 `8886` 端口占用。

## Cloud Phone 扩展参数

| 参数 | 说明 |
|------|------|
| `--cloud-phone-config=<file>` | 合并键值配置（`key=value` 或布尔 `flag` 每行） |
| `--cloud-phone-capabilities` | 输出能力 JSON（可读 `CLOUD_PHONE_SCRCPY_CAPABILITIES` 文件） |
| 环境变量 `CLOUD_PHONE_SCRCPY_CONFIG` | 默认配置文件路径 |

## 构建（Windows / Linux / macOS）

### Web 投屏必需：魔改 scrcpy-server

`scrcpy-server` 是 Android 端 APK，**与宿主操作系统无关**，但需用本仓库 Gradle 编译（含 WebSocket / ws-scrcpy 线协议），**不要用**官方 release 里的 `scrcpy-server-v4.0` 代替。

```bash
# 在仓库根目录（当前系统需 JDK 17+、Android SDK）
node tools/build-scrcpy-server.mjs

# 一次写入 windows / linux / macos 三个目录（便于跨平台部署仓库）
node tools/build-scrcpy-server.mjs --all-platforms
```

产物：`backend/bin/scrcpy/<platform>/scrcpy-server`（三份内容相同，均为魔改 APK）。

| 系统 | JDK / SDK 提示 |
|------|----------------|
| **Linux** | `openjdk-17-jdk`、`android-sdk`；可设 `JAVA_HOME`、`ANDROID_HOME` |
| **macOS** | Android Studio 自带 JBR，或 Temurin 17；SDK 通常在 `~/Library/Android/sdk` |
| **Windows** | `Program Files\Java\jdk-*` 或 Android Studio `jbr`；可设 `CLOUD_PHONE_JAVA_HOME` |

### 可选：本机 scrcpy 桌面客户端

需 Meson + Ninja。脚本会用**已编译的魔改 server** 作为 `-Dprebuilt_server`，不再走官方 `install_release.sh`（避免 sudo 安装且避免官方未魔改 server）。

```bash
# 编译本机平台的 scrcpy + 同步魔改 server 到对应 bin 目录
node tools/build-scrcpy.mjs

# 仅编译魔改 server（无 meson 时自动走此路径）
node tools/build-scrcpy.mjs --server-only
```

产物：`backend/bin/scrcpy/<platform>/scrcpy[.exe]` 与 `scrcpy-server`。

**注意**：`node tools/build-scrcpy.mjs --download` 仅下载官方预编译包，**server 无魔改**，不适合 Cloud Phone Web 投屏。

依赖详见官方 `doc/linux.md` / `doc/macos.md` / `doc/windows.md`。

## 后端 API（前端暂未对接）

- `GET /api/scrcpy/capabilities` — 能力清单
- `GET /api/scrcpy/sessions` — 会话列表
- `POST /api/scrcpy/sessions` — 启动（body 为选项对象，如 `{ "serial": "xxx", "maxSize": 1024, "noAudio": true }`）
- `GET /api/scrcpy/sessions/:id` — 查询
- `DELETE /api/scrcpy/sessions/:id` — 停止

## 同步上游源码

上游对照仓库：`projects/scrcpy`（官方 tag **v4.0**，与 `master` 一致）。

```bash
# 1. 更新上游（首次 clone）
git clone --depth 1 --branch v4.0 https://github.com/Genymobile/scrcpy projects/scrcpy
cd projects/scrcpy && git pull origin master

# 2. 比对（不含 Cloud Phone 魔改层）
node tools/compare-scrcpy-upstream.mjs

# 3. 同步官方基线到 backend/source/scrcpy（保留 ws/、cloud_phone/、Options/Controller 等魔改）
node tools/sync-scrcpy-from-upstream.mjs
# 兼容旧命令：
node tools/sync-scrcpy-source.mjs

# 4. 重编魔改 server
node tools/build-scrcpy-server.mjs --all-platforms
```

保留清单见 `tools/scrcpy-upstream-manifest.js`（WebSocket、`list_all_apps`、Controller 拆分等不会被子覆盖）。

## 与上游同步（v5.0.1）

设备端 server 源码基线由 4.0 升到 **v5.0.1**（2026-10-08），保留本仓库全部 WebSocket / ws-scrcpy 线协议改造。同步进来的上游能力：

| 来源版本 | 能力 | 落地文件 |
|---|---|---|
| 4.1 | VP8 / VP9 视频编码器 | `video/VideoCodec.java`（新增 `VP8(0x00767038)`、`VP9(0x00767039)`） |
| 4.1 | 编码器尺寸约束改为「先失败再收紧」，新增 `--ignore-video-encoder-constraints` | `video/VideoConstraints.java`、`video/SurfaceEncoder.java`、`model/Size.java`、`util/BinarySearch.java`、`Options.java`、`OptionsParsing.java` |
| 4.1 | 推文件后触发 MediaStore 扫描（控制消息 22） | `control/ControlMessage.java`、`control/ControlMessageReader.java`、`control/ControllerMessageHandler.java`（`TYPE_SCAN_FILE`）、`device/Device.java`（`sendBroadcast`） |
| 4.1 | 摄像头目标尺寸自适应、停止时避免 `camera capture failed` 噪声 | `video/CameraCapture.java` |
| 5.0 | 播放音频采集覆盖所有 usage | `audio/AudioPlaybackCapture.java` |
| 5.0 | 新显示器 resize 时用 `constrain(..., false)` 并固定 dpi | `video/NewDisplayCapture.java` |

未同步的部分：`app/`（桌面 C/SDL 客户端）与 `doc/` 仍是 4.0 源码 —— 本仓库只构建设备端 `scrcpy-server`，桌面客户端从不编译，故未移植其 5.0 硬解代码（`--hwdec`）。若以后要构建桌面客户端，需整目录同步并重做 `app/src/cloud_phone` 的接缝。

保留的本仓库改造（升级后逐项复核，行为不变）：

- `ws/`（10 个类）：WebSocket 服务、`scrcpy_initial` 握手、type-101 流参数、Annex-B 组帧、PCM 音频通道
- `video/VideoSink.java`：把 `Streamer` 抽象成接口，WebSocket 与 TCP 两种出口
- `SurfaceEncoder`：`INFO_OUTPUT_FORMAT_CHANGED` 时用 MediaFormat 的 csd-0/csd-1 拼完整 SPS+PPS；`applyStreamTuning()` 不做采集重建；虚拟屏被拒时不再重试降分辨率
- `Controller.resetVideo()`：客户端要关键帧改 `requestSyncFrame()`，不重建采集（Waydroid 重建后只出 CSD 的老问题）
