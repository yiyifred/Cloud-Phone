<div align="center">

# Cloud Phone

**用浏览器连真机：投屏、触控、文件、应用、终端，都在一个页面里；另有 Android 伴侣 App，在手机上管理设备与全屏投屏。**

当前版本：**v0.12.13** · Node 后端 + Vue 3 Web + Android 客户端 · 基于 [scrcpy](https://github.com/Genymobile/scrcpy) 4.0 自编译 WebSocket 投屏

[English](README.EN.md) · **中文**

</div>

---

## 相关链接

| 平台 | 地址 |
|------|------|
| **GitHub** | [github.com/yiyifred/Cloud-Phone](https://github.com/yiyifred/Cloud-Phone) |
| **Gitee** | [gitee.com/yiyifred/Cloud-Phone](https://gitee.com/yiyifred/Cloud-Phone) |
| **LINUX DO** | [linux.do](https://linux.do/) |

---

## 目录

- [相关链接](#相关链接)
- [为什么做这个项目](#为什么做这个项目)
- [亮点](#亮点)
- [截图（预留）](#截图预留)
- [功能一览](#功能一览)
- [Android 客户端](#android-客户端)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [API 摘要](#api-摘要)
- [构建 scrcpy](#构建-scrcpy)
- [环境变量](#环境变量)
- [社区准则](#社区准则)
- [致谢](#致谢)
- [赞助](#赞助)
- [English](README.EN.md)

---

## 为什么做这个项目

手里连着几台 Android 调试机，经常要在电脑上改配置、装包、看日志。命令行 `adb` 够用，但投屏参数一长串就烦；桌面版 scrcpy 很强，可我想在**浏览器**里统一管设备列表、投屏、文件和应用。

Cloud Phone 就是把这件事做成一个本地 Web 控制台：后端用内置 ADB + 改过的 scrcpy-server 推流，前端用 WebCodecs 解码 H.264，协议对齐 [ws-scrcpy](https://github.com/NetrisTV/ws-scrcpy)。镜像参数面板参考了 [escrcpy](https://github.com/viarotel-org/escrcpy) 的分组习惯，但代码是本仓库自己写的，不依赖 escrcpy 运行时。

**适合谁用**

- 需要可调编码器、虚拟屏、摄像头投屏、录屏的人
- 想在同一界面里顺便开文件管理、应用管理、Shell 的人
- 想在手机上查看设备画廊、改投屏参数并全屏遥控的人（Android 伴侣 App）

---

## 亮点

| 点 | 说明 |
|---|---|
| **浏览器投屏** | H.264 经 WebSocket 推到画布，WebCodecs 硬解；触摸/鼠标按 scrcpy 4.0 协议注入 |
| **官方 4.0 底座** | 在 `backend/source/scrcpy` 上移植 WebSocket，server 版本与桌面客户端一致，避免 jar 版本打架 |
| **参数够全** | 镜像：裁剪、采集方向、虚拟屏预设、音频源/编码器、关屏保活等；摄像头模式：手电、变焦（Android 12+） |
| **不投屏也能干活** | 文件管理、应用管理、ADB 终端、画廊截屏——设备在线即可，不必先开 cast |
| **投屏顶栏顺手** | 多任务/主屏/返回/电源/音量/旋转/剪贴板/录屏/截屏；导航键支持按住与手机同步 |
| **交互更统一** | 常用图标迁移 Lucide 图标库，统一线稿风格；补充焦点可见态与 hover 反馈 |
| **一键开发** | 根目录 `npm run dev` 先等后端 `/health` 再起 Vite，代理失败有明确提示 |
| **主题** | 左下角浅色/深色切换，偏好写本地 |
| **多语言** | 设置页切换界面语言（简中 / English / 繁中 / 日本語 / 한국어），核心界面即时切换 |
| **API 安全** | 登录后会话鉴权；JSON 接口 AES-GCM 加密；WebSocket 需有效会话 |
| **设备入口** | 画廊右上角提供「添加设备」弹窗；安卓 USB 引导 + 配对码配对（IP/端口/配对码，自动扫描连接），鸿蒙/苹果暂未开发 |
| **Android 伴侣 App** | 连接同一后端：设备画廊、完整设置页、投屏参数工作区、横屏全屏 H.264 投屏；流参数与 Web 对齐 |
| **移动投屏** | Android 端镜像导航键 / 摄像头手电变焦；Material 动效、工具栏自动隐藏；画布触控与黑边适配 |

---

## 截图

| 位置 | 建议文件名 | 放什么 |
|---|---|---|
| 设备画廊 | `images/readme/gallery.png` | 多设备卡片、在线数、实时截图 |
| 镜像投屏 | `images/readme/mirror-cast.png` | 左侧参数 + 右侧画面 + 顶栏 |
| 摄像头投屏 | `images/readme/camera-cast.png` | 摄像头模式与手电/变焦 |
| 文件管理 | `images/readme/files.png` | 地址栏、目录列表 |
| 应用管理 | `images/readme/apps.png` | 应用列表与详情弹窗 |
| 终端 | `images/readme/terminal.png` | xterm 彩色 Shell |

```text
images/readme/
├── gallery.png
├── mirror-cast.png
├── camera-cast.png
├── files.png
├── apps.png
└── terminal.png
```

图片已插入到下方对应功能小节中；这里仅列出文件名与建议用途。

---

## 功能一览

### 设备画廊

![设备画廊](images/readme/gallery.png)

- 左侧 Tab：**设备**、**设置**
- 自动发现 ADB 设备（内置 `platform-tools`），展示型号、厂商、IP、Android 版本、序列号、产品名
- 每台设备约 **5 秒**刷新截图（可调），列表约 **1 秒**刷新；刷新时保留上一帧，不闪全屏 loading
- 汇总在线/离线数量、最近刷新时间，支持手动刷新
- 点击卡片进入**设备工作区**

### 设置与登录（Web）

- 设置页横向布局，左侧二级菜单：**账号**、**外观**、**刷新**
- **账号**：密码状态（默认 / 已更新）、会话到期时间、修改密码
- **外观**：界面语言（简中 / English / 繁中 / 日本語 / 한국어）、浅色/深色主题；偏好写入浏览器 `localStorage`
- **刷新**：设备列表与截图自动刷新间隔（1–120 秒，默认 1s / 5s），保存后立即生效
- 会话登录（默认密码 `admin`，首次使用请改密）；JSON API 登录后 AES-GCM 加密
- **后端本地数据**：`backend/node/data/` 存放 `auth.key` 与 `cloud-phone.db`，仅本机使用，勿提交到 Git

> **说明**：文件管理、应用管理、ADB 终端目前仅在 **Web 设备工作区** 提供；Android App 聚焦设备发现、投屏参数与全屏遥控，见下文 [Android 客户端](#android-客户端)。

### 设备工作区 · 镜像投屏（默认）

![镜像投屏](images/readme/mirror-cast.png)

**左侧参数**（Naive UI 折叠分组；下拉带顶部搜索 `MirrorSearchableSelect`）：

| 分组 | 能力 |
|---|---|
| **视频** | 分辨率（长边）、码率、帧率、编码器（设备 `list_encoders`，超时回退通用列表）、采集方向、预览旋转（仅浏览器侧） |
| **音频** | 开关、音频源、`audio-code`、码率、`audio-dup`（Android 13+）；可「禁用视频」仅音频（画布波形 + PCM，Android 11+） |
| **设备** | 显示 ID、关屏投屏、保持唤醒、显示触摸点、关屏超时等 |
| **屏幕** | 虚拟屏预设、`--new-display` 自定义分辨率/DPI、`--flex-display`、IME 策略、系统装饰；`--start-app` 在虚拟屏上启动应用 |

**投屏过程**

- `POST .../cast/start` 启动；浏览器连 `WebSocket .../cast/ws`
- 设备端自编译 **scrcpy-server 4.0**（缺 jar 时后端 Gradle 自动编译）；启动前 `pkill` 残留进程，避免 **8886** 占用
- 参数经 WebSocket **type 101** 热更新（`codecOptions` / stream extras）；投屏中会锁定左侧表单，防止误改
- 画布触控：坐标按**解码后视频尺寸**映射（与 server `PositionMapper` 一致）；鼠标悬停/按下/拖动/抬起走 scrcpy SDK 协议

**顶栏控制**（图标上图标下文字，Lucide 风格）

- 多任务、主屏幕、返回、关闭屏幕、电源、旋转（同步左侧「预览旋转」+90°）
- 音量：点击展开「增加 / 减小」
- 剪贴板：粘贴到设备 / 从设备复制；支持文本输入框发字
- 截屏：下载 PNG（可不投屏）；投屏时画布四边白光闪烁反馈
- 录屏：有画面存 **MP4**，仅音频存 **MP3**；结束投屏自动保存
- **文件管理**、**应用管理**、**终端**：见下文（无需正在投屏）

### 设备工作区 · 摄像头投屏（Android 12+）

![摄像头投屏](images/readme/camera-cast.png)

- 左侧「摄像头」：朝向、摄像头 ID、采集尺寸、宽高比、帧率、高速模式、手电筒、变焦、编码与音频
- `GET /api/devices/:serial/cameras` 列出设备摄像头
- 投屏中可开关手电、变焦；**摄像头模式不注入画布触摸**（避免误触）

### 文件管理

![文件管理](images/readme/files.png)

- 根目录 `/`，默认打开 `/storage/emulated/0`；地址栏显示真实绝对路径
- 后退 / 前进 / 向上 / 刷新；无权限时提示「权限不足」
- **上传**：将本地文件推到当前目录（`PUT .../files/upload?path=`）
- **下载**：将设备上的文件保存到电脑（`GET .../files/download?path=`）
- `GET /api/devices/:serial/files?path=...` 列出目录

### 应用管理

![应用管理](images/readme/apps.png)

- 列表：应用名（经 scrcpy-server `PackageManager` 取 label）、包名、系统/冻结标记
- 详情弹窗：版本、SDK、数据目录等
- 卸载（二次确认）、用户级冻结/解冻、导出 APK、在文件管理中打开 `dataDir`
- 本地上传 APK 安装：`PUT .../apps/install`

### 终端

![终端](images/readme/terminal.png)

- xterm.js：Tab、方向键、ANSI 彩色；自动 `stty` 行列
- `WebSocket .../terminal/ws` 桥接 `adb shell -tt`

### 后端与其他

- `GET /health`、`GET /api/devices`、`GET .../screenshot`
- scrcpy 会话 API：`/api/scrcpy/*`（能力查询、会话启停，供脚本集成）
- 工具：`tools/build-scrcpy-server.mjs`、`build-scrcpy.mjs`、`download-scrcpy.mjs`、`sync-scrcpy-source.mjs`、`test-scrcpy-cast.mjs`
- 已移除 OTG / UHID 投屏模式；当前仅**镜像**与**摄像头**

更细的版本记录见 [CHANGELOG.md](CHANGELOG.md)。

---

## Android 客户端

源码目录：`frontend/android/`。与 Web 共用同一 Node 后端与会话体系，适合在局域网内用手机查看设备画面并全屏操控。

### 连接与登录

- 首次启动配置服务器：**地址**默认为本机网段网关（末段 `.1`，如 `192.168.31.1`），**端口**默认 `3000`
- 流程与 Web 一致：检测在线 → 首次仍为 `admin` 时强制改密 → 登录；密码经 **EncryptedSharedPreferences** 加密保存，下次自动登录
- 设置页可 **退出登录** 或 **更换服务器**（清除会话与已保存密码后回到连接页）

### 设备画廊（底部 Tab · 设备）

- 横向设备卡片，展示型号、在线状态与实时截图（默认约 5s 刷新，可在设置中修改）
- 设备列表约 **1s** 轮询；下拉手动刷新；保留上一帧截图，减少闪烁
- 右上角 **「+」**：USB 连接引导、无线 **配对码**、**二维码** 配对（对齐 Web「添加设备」）
- 图标使用 **Community Material**（Android-Iconics），风格与 Web MDI 一致

### 设置（底部 Tab · 设置）

与 Web `SettingsPanel` 分区一致：

| 分区 | 能力 |
|---|---|
| **账号** | 密码状态、会话到期、修改密码（底部弹窗）、退出登录 |
| **外观** | 界面语言（5 种 locale 偏好）、浅色/深色主题（Material3 DayNight） |
| **刷新** | 设备列表 / 截图刷新间隔（1–120 秒），保存后设备页轮询立即按新间隔运行 |
| **服务器** | 显示当前 `host:port`，一键更换并重新登录 |

### 设备工作区

- 点击设备卡片进入：顶部返回、设备名、**开始** 按钮
- **投屏模式**：镜像（默认）/ 摄像头（Android 12+）
- **多标签参数**（与 Web 工作区左侧面板同结构，按设备序列号持久化）：
  - 镜像：视频、音频、设备、屏幕（含虚拟屏预设 Desktop/Mac/iPad 等、`__main__`/`__custom__`、DPI 建议、`start_app` 包名）
  - 摄像头：摄像头、视频、音频（含 `audioCode`、`bufferMs` 等，流 extra 与 Web 对齐）
- 修改参数在离开页面时自动保存

### 全屏投屏

- 点击 **开始** 进入横屏全屏：`POST .../cast/start` + `WebSocket .../cast/ws`，**MediaCodec** 解码 H.264，画布 **letterbox** 与预览旋转
- **镜像模式**：多任务 / 主屏 / 返回 / 电源 / 音量 / 旋转 / 停止；画布触控注入（scrcpy 协议）
- **摄像头模式**：手电筒、缩小、放大、停止；画布不注入触控
- 顶栏与底栏 **自动隐藏**（约 3.5s），点击画面切换；进入/退出淡入淡出、直播状态点动画
- 流参数（`codecOptions`、虚拟屏、`audioDup` SDK 33+ 等）与 Web/桌面端 **同一套规则**

### 构建与安装

**环境**：Android Studio 或 JDK 11+、Android SDK（`minSdk 28`）。

```powershell
cd frontend/android
.\gradlew :app:assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

真机需能访问运行后端的局域网地址；HTTP 明文已在 `network_security_config` 中允许（本地开发用）。

### Web 与 Android 能力对照

| 能力 | Web | Android App |
|---|---|---|
| 设备画廊 / 截图轮询 | ✅ | ✅ |
| 设置（账号/外观/刷新） | ✅ | ✅ |
| 添加设备（USB/配对/二维码） | ✅ | ✅ |
| 投屏参数工作区 | ✅ | ✅ |
| 全屏投屏 + 触控/工具栏 | ✅ | ✅ |
| 文件管理 | ✅ | — |
| 应用管理 | ✅ | — |
| ADB 终端 | ✅ | — |
| 剪贴板 / 录屏 / 浏览器截屏下载 | ✅ | — |

---

## 快速开始

**环境（Web）**：Node.js 18+、已授权 ADB 的 Android 设备、支持 WebCodecs 的 Chromium 系浏览器（Chrome / Edge 等）。

**环境（Android App）**：与后端同一局域网；手机安装 `frontend/android` 构建的 APK（见 [Android 客户端 · 构建与安装](#构建与安装)）。

**自动安装（命令行伪图形向导）**：

| 系统 | 命令 |
|------|------|
| Linux（Debian/Ubuntu/Alpine/Fedora/Arch 等） | `bash scripts/install-linux.sh` |
| macOS | `bash scripts/install-macos.sh` |
| Windows | `powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1` |
| Unix 自动分流 | `bash scripts/install.sh` |

```powershell
# 克隆后
cd Cloud-Phone
copy .env.example .env   # 按需改端口

# 推荐：根目录一键启动（先后端、再前端）
npm run dev

# 浏览器打开 http://localhost:5173（以 .env 中 FRONTEND_PORT 为准）
```

分开启动：

```powershell
npm run dev:backend   # 默认 3000
npm run dev:frontend  # 默认 5173
```

生产预览：

```powershell
cd frontend/web
npm run start   # build 后托管 dist/
```

首次投屏若提示 server 未编译，需 **JDK 17+** 与 Android SDK，执行：

```powershell
node tools/build-scrcpy-server.mjs
```

---

## 目录结构

```text
Cloud-Phone/
├── scripts/               # 三平台自动安装向导（install-linux/macos/windows）
├── backend/node/          # Node HTTP + WebSocket API
├── backend/source/scrcpy/ # scrcpy 4.0 源码 + WebSocket 改造
├── backend/bin/           # adb、scrcpy 预编译产物
├── frontend/web/          # Vue 3 + Vite + Naive UI（Web 控制台）
├── frontend/android/      # Android 伴侣 App（设备画廊、设置、全屏投屏）
├── tools/                 # 构建、同步、开发启动脚本
├── images/qr/             # 赞助二维码
└── CHANGELOG.md
```

---

## API 摘要

除 `GET /api/auth/session`、`POST /api/auth/login`、`POST /api/auth/change-password` 外，均需先登录（会话 Cookie）。登录后 JSON 请求/响应使用 AES-256-GCM 加密；WebSocket 升级需有效会话；大文件/APK 上传为 `PUT` 二进制流（仅鉴权，响应 JSON 仍加密）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/api/devices` | 设备列表 |
| GET | `/api/devices/:serial/screenshot` | 设备截图 |
| GET | `/api/devices/:serial/mirror-options` | 镜像选项（显示器、应用等） |
| GET | `/api/devices/:serial/video-encoders` | 音视频编码器列表 |
| GET | `/api/devices/:serial/cameras` | 摄像头列表 |
| GET | `/api/devices/:serial/files?path=` | 目录列表 |
| GET | `/api/devices/:serial/files/download?path=` | 下载文件 |
| PUT | `/api/devices/:serial/files/upload?path=` | 上传到设备 |
| GET/DELETE | `/api/devices/:serial/apps` | 应用列表 / 卸载 |
| GET | `/api/devices/:serial/apps/:pkg` | 应用详情 |
| POST | `/api/devices/:serial/apps/:pkg/state` | 冻结/解冻 |
| GET | `/api/devices/:serial/apps/:pkg/apk` | 导出 APK |
| PUT | `/api/devices/:serial/apps/install` | 安装 APK |
| POST/DELETE | `/api/devices/:serial/cast/start\|stop` | 投屏会话 |
| WS | `/api/devices/:serial/cast/ws` | 投屏流 + 控制 |
| WS | `/api/devices/:serial/terminal/ws` | ADB Shell |
| * | `/api/scrcpy/*` | scrcpy 会话与能力（见 `backend/source/scrcpy/CLOUD_PHONE.md`） |

---

## 构建 scrcpy

**Web 投屏**依赖魔改 `scrcpy-server`（与 Windows/Linux/macOS 无关，但须在任一系统上用 Gradle 编出）：

```powershell
# 魔改 server（当前系统需 JDK 17+、Android SDK）
node tools/build-scrcpy-server.mjs

# 同时写入 backend/bin/scrcpy/windows|linux|macos/（跨平台部署推荐）
node tools/build-scrcpy-server.mjs --all-platforms
```

**Linux / macOS** 上若只跑 Node 后端 + 浏览器，执行 `--all-platforms` 即可；**不必**在本机再编 scrcpy 客户端。

可选：在本机用 Meson 编译 **scrcpy 桌面客户端**（会捆绑魔改 server，不再使用官方 `install_release.sh`）：

```powershell
node tools/build-scrcpy.mjs              # 需 meson + ninja；否则仅编 server
node tools/build-scrcpy.mjs --server-only

# 勿用于 Web 投屏：官方预编译，server 无 WebSocket 魔改
# node tools/build-scrcpy.mjs --download
```

```powershell
node tools/sync-scrcpy-source.mjs   # 从上游同步源码（需自行合并魔改）
```

详见 [backend/source/scrcpy/CLOUD_PHONE.md](backend/source/scrcpy/CLOUD_PHONE.md)。

---

## 环境变量

根目录 `.env`（参考 `.env.example`）：

| 变量 | 含义 | 默认 |
|---|---|---|
| `HOST` | 监听地址 | `0.0.0.0` |
| `BACKEND_PORT` | 后端 API | `3000` |
| `FRONTEND_PORT` | Vite 开发端口 | `5173` |



---

## 致谢

Cloud Phone 站在很多优秀项目肩上，特此感谢（排名不分先后）：

| 项目 | 用途 | 链接 |
|---|---|---|
| **scrcpy** | 屏幕/摄像头采集、编码、控制的核心；本仓库 `backend/source/scrcpy` 在其 4.0 上扩展 WebSocket | https://github.com/Genymobile/scrcpy |
| **ws-scrcpy** | 浏览器 WebSocket 线协议（`scrcpy_initial`、Annex-B H.264、type 101 等）参考 | https://github.com/NetrisTV/ws-scrcpy |
| **escrcpy** | 镜像参数分组与选项命名习惯的参考（非代码依赖） | https://github.com/viarotel-org/escrcpy |
| **Vue** | 前端框架 | https://github.com/vuejs/core |
| **Vite** | 构建与开发服务器 | https://github.com/vitejs/vite |
| **Naive UI** | 组件库 | https://github.com/tusen-ai/naive-ui |
| **xterm.js** | 终端模拟 | https://github.com/xtermjs/xterm.js |
| **lamejs**（@breezystack/lamejs） | 投屏录屏 MP3 编码 | https://github.com/breezystack/lamejs |
| **ws** | Node WebSocket | https://github.com/websockets/ws |
| **Java-WebSocket** | 设备端 WebSocket（scrcpy-server 依赖） | https://github.com/TooTallNate/Java-WebSocket |
| **Android platform-tools** | 内置 ADB | https://developer.android.com/tools/releases/platform-tools |

浏览器侧还用到 **WebCodecs**、**Web Audio** 等标准 API。

scrcpy 本体遵循 **Apache License 2.0**（见 `backend/source/scrcpy/LICENSE`）。若你发现遗漏了应署名的依赖，欢迎提 Issue。

---

## 赞助

如果 Cloud Phone 帮你省了时间，欢迎请我喝杯咖啡。扫码即是对项目的认可，金额随意。

<table align="center">
<tr>
<td align="center"><b>微信</b><br/><img src="images/qr/wx.jpg" width="220" alt="微信赞助二维码"/></td>
<td align="center"><b>支付宝</b><br/><img src="images/qr/zfb.png" width="220" alt="支付宝赞助二维码"/></td>
</tr>
</table>

赞助自愿、非商业捆绑；项目仍完全开源，不影响你自行部署使用。

---


## Star History

<a href="https://www.star-history.com/?repos=yiyifred%2FCloud-Phone&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=yiyifred/Cloud-Phone&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=yiyifred/Cloud-Phone&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=yiyifred/Cloud-Phone&type=date&legend=top-left" />
 </picture>
</a>
