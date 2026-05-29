# Changelog

## 0.12.11 - 2026-05-29

- Android 全屏投屏：设备详情页点击「开始」进入横屏全屏画布，调用 cast/start + WebSocket 实时 H.264 解码；触控与导航工具栏对齐 Web 移动版；投屏 UI 圆角面板与自动隐藏顶栏

## 0.12.10 - 2026-05-29

- Android 设备详情页：顶部返回/设备名/开始按钮，投屏模式选择与多标签投屏设置（镜像/摄像头），参数结构与 Web 端对齐并按设备持久化

## 0.12.9 - 2026-05-29

- Android 客户端图标统一为 Community Material（Android-Iconics），与 Web 端 MDI 图标风格对齐；移除本地矢量图标资源

## 0.12.8 - 2026-05-29

- Android 设备页新增「+」添加设备：USB 监听、配对码与二维码配对，流程对齐 Web 端

## 0.12.7 - 2026-05-29

- Android 设备页对齐 Web 移动版设备画廊：横向设备卡片、截图轮询、下拉刷新与会话加密 API

## 0.12.6 - 2026-05-29

- Android 客户端：登录成功后进入 `ConsoleActivity`，底部 Tab 提供「设备」「设置」入口

## 0.12.5 - 2026-05-29

- Android 客户端：登录密码加密保存在本机，下次启动自动验证并登录；服务器地址变更时清除旧密码

## 0.12.4 - 2026-05-29

- 明确 `backend/node/data/` 为本地密钥目录（`auth.key`、`cloud-phone.db`），不纳入版本控制
- Android 客户端：服务器在线后按 Web 逻辑区分首次改密与登录；修复 Material 输入框标签与占位符重叠

## 0.12.3 - 2026-05-29

- Android 客户端首次连接时，默认服务器地址为本机所在网段的 `.1`（如 `192.168.31.32` → `192.168.31.1`），默认端口 `3000`

## 0.11.4 - 2026-05-28

- 将设备工具栏重构为独立组件 `DeviceWorkspaceToolbar`，从工作区页面内聚展示中解耦
- 工具栏定位改为与画布无关：按整个屏幕长边固定显示（长边横向时底部横排，长边纵向时右侧竖排）
- 清理旧的全屏内嵌工具栏折叠样式与逻辑，统一由独立组件承载交互与布局

## 0.11.3 - 2026-05-28

- 调整全屏工具栏为右下角固定竖向布局，新增右下角箭头折叠/展开按钮
- 删除投屏画面中的 `scrcpy` 文本徽标，保留纯工具栏操作视图
- 修复桌面端投屏左右不居中：恢复播放器画面等比居中绘制

## 0.11.2 - 2026-05-28

- 修复旋转预览后的触控坐标偏移：先将指针坐标按 rotator 角度逆旋转回未旋转坐标系，再进行黑边裁剪与归一化
- 简化触控映射链路：移除重复旋转换算，统一使用 `mapClientToVideoLocal(..., rotator)` 计算设备坐标

## 0.11.1 - 2026-05-28

- 修复设备工作区全屏工具栏拖拽与按钮按压的事件处理冲突（避免 Vite 编译报重复声明）
- 修复全屏时上下留白：全屏状态移除 workspace 布局间距并确保投屏容器撑满
- 优化全屏预览旋转：90°/270° 通过交换 rotator 宽高避免被 flex 收缩，画布随容器正确重算

## 0.11.0 - 2026-05-28

- 移动端侧边栏改为可折叠抽屉式：保持桌面端竖向排布风格，设备/设置为上下布局
- 侧边栏底部区域完善：深浅色切换与退出登录置于底部并上下排列
- 移动端设备卡片改为左右布局：左侧截图、右侧信息；信息区改为一行两列（如 IP 地址 / 产品）

## 0.10.7 - 2026-05-28

- 新增安卓“配对码配对”流程：指引开发者选项 -> 无线调试 -> 使用配对码配对设备
- 右侧支持输入 IP/端口/配对码，提交后显示配对成功/失败与连接成功/失败
- 配对后自动扫描并连接设备端口（连接端口可与配对端口不同）

## 0.10.6 - 2026-05-28

- USB 连接页底部按钮区域加宽，修复“返回”文案空间不足导致显示拥挤

## 0.10.5 - 2026-05-28

- 安卓 USB 设备检测改为仅追踪新设备：仅显示打开 USB 引导后新插入的设备，不再回退显示弹窗前设备

## 0.10.4 - 2026-05-28

- 安卓 USB 引导页布局优化为左右分栏：左侧插线动画、右侧设备状态列表
- 动画调整为上方手机 + 下方数据线，对准手机底部并做上下移动提示

## 0.10.3 - 2026-05-28

- 设备画廊右上角移除「立即刷新」按钮，保留自动刷新与错误态重试入口
- 「添加设备」弹窗品牌图标改为 Iconify（Android / Huawei / Apple）
- 安卓设备连接入口细化：USB 连接 / 二维码连接 / 配对码连接（均为未开发占位）
- 安卓 USB 连接改为可交互引导：插线动画、实时设备状态跟踪（已连接/待认证）、完成返回首页

## 0.10.2 - 2026-05-28

- 修复后端重启后会话状态不一致：/api/auth/session 仅在会话记录存在时才返回已登录，避免登录态假阳性导致 401
- 设备画廊右上角新增「添加设备」入口，弹窗展示安卓/鸿蒙/苹果（灰色未开发）

## 0.10.1 - 2026-05-27

- 除登录/会话/改密外，全部 HTTP API 需有效会话 Cookie，未登录返回 401
- JSON 响应统一 AES-256-GCM 加密；登录成功后下发会话 `encryptionKey`，前端存于 sessionStorage
- 登录响应用密码派生密钥加密；设备列表、投屏、文件、应用、截图等接口请求体/响应体加密
- WebSocket 投屏/终端升级需会话 Cookie；大文件 PUT 上传仍走二进制流（仅鉴权，响应 JSON 加密）

### API session auth & encrypted payloads
- Protect all `/api/*` and `/health` except auth bootstrap endpoints
- AES-256-GCM envelopes for JSON; per-session encryption key after login
- WebSocket upgrade requires session cookie; binary upload streams auth-only

## 0.10.0 - 2026-05-27

- 设置页新增界面语言切换，支持简体中文、English、繁體中文、日本語、한국어
- 接入 `vue-i18n`：设置、侧栏、主题、登录/改密、设备画廊等核心界面文案多语言化
- 语言偏好写入 `localStorage`，切换即时生效；日期与设备状态标签随 locale 格式化
- 设置页改为横向布局：左侧二级菜单（账号 / 外观 / 刷新），右侧分类内容区
- 外观分类集中语言与主题；账号分类支持会话信息与修改密码；刷新分类独立保存间隔

### Settings i18n & language switcher
- Language selector on Settings (zh-CN, en-US, zh-TW, ja-JP, ko-KR)
- `vue-i18n` for shell UI: settings, sidebar, theme, auth, device gallery
- Persisted locale; date/device labels follow active language

### Settings layout refactor
- Horizontal settings page with secondary nav: Account, Appearance, Refresh
- Theme toggle moved from sidebar to Appearance; change password from Account section

## 0.9.8 - 2026-05-27

- 首页左侧“设置”图标改为图标库实现（`lucide-vue-next`），统一线稿风格并提升清晰度
- 扩展图标库覆盖：设备/返回/终端/旋转/主题等常用图标迁移到 Lucide；补充焦点可见态与按钮/卡片 hover 细节

### Sidebar settings icon
- Migrate the sidebar settings icon to `lucide-vue-next`
- Expand Lucide coverage and improve focus/hover interactions

## 0.9.7 - 2026-05-27

- 改进工具栏图标：终端与旋转更清晰、比例更协调

### Toolbar icons
- Improve terminal and rotate icons for better legibility

## 0.9.6 - 2026-05-27

- 新增 `scripts/` 三平台自动安装向导（Linux / macOS / Windows），命令行伪图形菜单
- Linux 支持 Debian/Ubuntu、Alpine、Fedora/RHEL、Arch、openSUSE、Void 等；可选 Node、npm 依赖、JDK、Android SDK、Meson、编译魔改 scrcpy-server
- Windows 安装脚本兼容 PowerShell 5.1（winget/choco）；界面使用 ASCII 避免控制台乱码
- `scripts/install.sh` Unix 入口；`scripts/lib/` 共享 TUI 与发行版探测；`.gitattributes` 保证 shell 脚本 LF

### Cross-platform install scripts
- Interactive terminal installers under `scripts/` for Linux, macOS, and Windows
- Linux multi-distro package managers; optional modded scrcpy-server build
- Windows PS 5.1-safe installer with ASCII UI

## 0.9.5 - 2026-05-27

- 完善 Linux / macOS 魔改 scrcpy 构建：`--all-platforms` 一次安装三平台 `scrcpy-server`；Meson 使用魔改 `-Dprebuilt_server`，不再走官方 `install_release.sh`
- 新增 `tools/scrcpy-platform.js`、`scrcpy-build-env.js`、`build-scrcpy-client.mjs`；跨平台 JDK/Android SDK 探测
- `npm run build:scrcpy-server` / `build:scrcpy-server:all` / `build:scrcpy`；官方下载路径增加无魔改警告；支持 linux aarch64 预编译包名

### Linux / macOS modded scrcpy build
- `--all-platforms` installs modded server JAR under windows/linux/macos bin dirs
- Client build embeds modded server via Meson; no `install_release.sh` / official unmodded server
- Shared platform/env helpers; npm build scripts; warn on official server download

## 0.9.4 - 2026-05-27

- 同步 `backend/node/package-lock.json` 至 v0.9.4
- 设备文件管理支持上传与下载：顶栏上传到当前目录，文件行下载到电脑（`adb push` / `adb pull`）
- 新增 API：`PUT .../files/upload?path=`、`GET .../files/download?path=`
- 上传/下载图标改为 Lucide `file-up` / `file-down` 风格

### Device file upload & download
- File explorer: upload to current directory, per-file download via new REST endpoints
- Lucide-style file-up / file-down toolbar icons

## 0.9.3 - 2026-05-27

- README 新增「相关链接」板块：GitHub、Gitee、[LINUX DO](https://linux.do/) 独立成节；页眉补充 Gitee 入口
- 重写 README：中英文分离，中文为主文件，英文独立到 README.EN.md；顶部互相跳转
- 各功能截图（设备画廊、镜像投屏、摄像头投屏、文件管理、应用管理、终端）插入到对应功能小节下方
- 截图文件路径统一为 `images/readme/*.png`，赞助二维码放在文末
- 新增 LINUX DO 社区准则节；完善致谢表格，补充所有依赖项目链接

### README rewrite
- Added **Links** section (GitHub, Gitee, LINUX DO); Gitee link in header
- Split Chinese/English: `README.md` (Chinese) + `README.EN.md` (English)
- Feature screenshots embedded in corresponding sections
- Added LINUX DO community guidelines section
- Completed acknowledgements with all dependency links and sponsorship QR codes

## 0.9.2 - 2026-05-27

- 全局键盘捕获：投屏画面获得焦点后，所有按键（按下/抬起）直接通过 scrcpy `INJECT_KEYCODE` 透传到设备，包含 Shift/Ctrl/Alt/Meta 等修饰键状态
- 内置常见键位映射（字母、数字、功能键 F1–F12、方向键、符号键、小键盘等）
- 移除底部文本输入框，不再需要点击输入框；直接点击投屏画面聚焦后即可打字

### Global keyboard capture for cast viewport
- All keydown/keyup events forwarded to device as scrcpy INJECT_KEYCODE when viewport is focused
- Full modifier state (Shift, Ctrl, Alt, Meta, CapsLock, NumLock) included in each key event
- Removed text input overlay; click viewport to focus then type directly

## 0.9.1 - 2026-05-27

- Remove OTG cast mode and all related web UHID / virtual AOA plumbing (Pointer Lock capture, `otg/input/ws`, `scrcpy-otg` backend service, OTG settings UI and styles); cast modes are mirror and camera only
- Simplify cast viewport and `useDeviceScrcpyCast` to canvas WebSocket preview + standard touch injection
- Restore full toolbar actions during cast (no OTG-only restrictions)
- scrcpy capabilities UI: drop OTG / USB group entry
- Cast debug: recognize UHID control packet types (12–14) in `ws-packet-summary`; `WsControlChannel` serializes control writes to avoid interleaved pipe corruption

## 0.9.0 - 2026-05-27

- Camera cast mode (escrcpy/scrcpy `--video-source=camera`, Android 12+): left panel「摄像头」settings (facing, camera id, size, aspect ratio, fps, high-speed, torch, zoom, encoder, audio); stream extras over WebSocket type 101
- scrcpy-server Web cast: `CameraCapture` pipeline when `video_source=camera`; stream extra keys for camera_* and video_source; hot-reconfigure restarts capture on camera param changes
- Backend `GET /api/devices/:serial/cameras` lists device cameras and capture sizes via server `list_cameras` / `list_camera_sizes`
- Cast controls: torch on/off and zoom in/out (scrcpy control messages 18–20); disable canvas touch injection in camera mode
- Fix `buildCastPayloadFromCameraSettings` max size helper (`maxSizeFromMirrorVideo`)

## 0.8.2 - 2026-05-27

- Device workspace toolbar Terminal (`终端`): interactive ADB shell in a modal via WebSocket `GET /api/devices/:serial/terminal/ws` (upgrade); backend bridges `adb shell -tt` with `TERM=xterm-256color`
- Frontend uses xterm.js (`@xterm/xterm`, `@xterm/addon-fit`) for ANSI colors, Tab/arrows/special keys, auto-resize (`stty cols/rows`); unified device WebSocket upgrade handler (cast + terminal)

## 0.8.1 - 2026-05-27

- App manager: resolve app display names via scrcpy-server `PackageManager.getApplicationLabel()` (`list_all_apps`, same approach as `scrcpy --list-apps`) so labels work on devices where `dumpsys` omits `application-label`
- App manager: remove app icons and `/apps/:pkg/icon` API (no APK pull for launcher icons); list shows label + package name + system/frozen badges; detail opens in a modal; filter by app name or package name

## 0.8.0 - 2026-05-27

- Device workspace toolbar App manager (`应用管理`): list installed apps with icon and package name; app detail panel (version / SDK / paths / state); uninstall with confirmation; user-level freeze/unfreeze; export APK; jump to `dataDir` in file explorer; install APK from local file
- Backend app APIs: `GET /api/devices/:serial/apps`, `GET /api/devices/:serial/apps/:pkg`, `DELETE /api/devices/:serial/apps/:pkg?confirm=1`, `POST /api/devices/:serial/apps/:pkg/state`, `GET /api/devices/:serial/apps/:pkg/icon`, `GET /api/devices/:serial/apps/:pkg/apk`, `PUT /api/devices/:serial/apps/install`
- File explorer enhancement: support opening a specific absolute device path (`openPath`) so App manager can jump directly into app data folder

## 0.7.15 - 2026-05-27

- Device file explorer: filesystem root is `/`; default open folder is `/storage/emulated/0` (not the root); address bar shows real absolute paths; browse up to `/` via parent navigation
- Back / forward history, up at `/` shows「已在文件系统根目录」; permission denied surfaces as「权限不足，无法访问此目录」
- Backend listing split into `device-files-list.js` / `device-files-errors.js`; improved `ls -la` parse and directory type detection fallback

## 0.7.14 - 2026-05-27

- Device file explorer (toolbar「文件管理」): browse internal storage rooted at `/storage/emulated/0` while UI shows `/`; `GET /api/devices/:serial/files?path=...` lists via `adb shell ls`; path normalized to prevent traversal outside root; no cast required when device is online
- Frontend `DeviceFileExplorer` modal: address bar, up, refresh, name/size/modified columns; folder and symlink navigation

## 0.7.13 - 2026-05-27

- Cast toolbar recording: save MP4 while video cast is active; save MP3 when「disable video」audio-only cast
- Fix audio-only cast with no sound and no `scrcpy_audio`: start PCM processor after `started=true` (was exiting immediately on sync start)
- Server `WsPcmAudioProcessor`: compatibility check, PCM buffer handling, pipeline logging; inherit audio options in `copyForWebStream`
- Frontend: `@breezystack/lamejs` MP3 encode, canvas PCM capture, click viewport to resume `AudioContext`, recording duration UI

## 0.7.12 - 2026-05-26

- Fix cast canvas z-index: video canvas at bottom; toolbar volume menu stacks above cast viewport

## 0.7.11 - 2026-05-26

- Volume toolbar: click to expand「增加 / 减小」sub-buttons (replaces hold / Shift+hold)

## 0.7.10 - 2026-05-26

- Screenshot toolbar action plays a white edge-glow flash animation on the cast viewport

## 0.7.9 - 2026-05-26

- Fix cast mouse drag broken after capture: use `primaryDown` state so `MOVE` is not mis-sent as `HOVER_MOVE` when `event.buttons` is 0
- Fix release jumping to top-left: `UP` uses last valid point; send `UP` before releasing pointer capture
- Simplify cast interaction (down / move / hover / up); clamp coords inside video area instead of dropping invalid touches

## 0.7.8 - 2026-05-26

- Fix mirror cast canvas touch not reaching device: touch `screenW/H` must match encoded video size (from decoder), not physical display from `scrcpy_initial`
- Server `PositionMapper` scales coordinates when client and stream video sizes differ instead of dropping events
- Cast pointer control aligned with scrcpy SDK mouse: `HOVER_MOVE` while hovering, `DOWN`/`MOVE`/`UP` while pressed, `POINTER_ID_MOUSE`, scrcpy 4.0 32-byte touch wire format
- ws-scrcpy-style interaction handler (`setPointerCapture`, coordinate fallback, touch state machine)
- WebSocket proxy: fix `remoteWs.OPEN` crash, queue client control until device WS connects, cast packet debug summaries

## 0.7.7 - 2026-05-26

- Redesign mirror cast toolbar icons (Lucide-style strokes) and vertical icon+label layout
- Dynamic screen on/off icons; toolbar icon variant with heavier stroke and hover chip

## 0.7.6 - 2026-05-26

- Toolbar rotate updates left-panel「预览旋转」(°) (+90° clockwise); CSS rotator wrapper with touch remap
- Screen on: WAKEUP+HOME+RESET_VIDEO wake sequence; server `completeDisplayWake` after SET_DISPLAY_POWER; display power uses POWER_MODE_NORMAL(2)
- Device rotateDevice clockwise 90° per click (server)

## 0.7.5 - 2026-05-26

- Fix mirror toolbar「点亮屏幕」after turn-off: read exposed `displayScreenOn` with `unref` (`.value ?? true` always treated screen as on)
- Screen on sends only `SET_DISPLAY_POWER` on; drop client POWER wake to avoid toggling display off again when server power-on succeeds

## 0.7.4 - 2026-05-26

- Fix mirror toolbar only working on first click: navigation uses pointer down/up (one scrcpy phase per event) instead of paired DOWN+UP on click
- Toolbar hold matches phone: press sends key DOWN, release sends UP; global pointerup/blur releases stuck keys; back uses inject keycode

## 0.7.3 - 2026-05-26

- Mirror cast toolbar: navigation keys (recents, home, back, power, volume, rotate) send scrcpy-style DOWN+UP pairs so buttons work reliably
- Toolbar refactor: `useDeviceWorkspaceToolbar`, action `kind` metadata; screenshot downloads PNG when device is online (no cast required); Shift+click volume for volume-down

## 0.7.2 - 2026-05-26

- Fix mirror audio section stuck disabled on load: default `audio.disabled` to false (web cast ships audio with video)
- Fix「禁用音频」switch locked when section grayed; toggle always available so users can re-enable audio without toggling「禁用视频」first

## 0.7.1 - 2026-05-26

- Mirror cast settings UI rebuilt with Naive UI (`NCollapse`, `NForm`, `NSwitch`, `NAlert`, theme provider synced with app light/dark)
- All mirror dropdowns use `MirrorSearchableSelect`: search box fixed at the top of the menu (grouped options supported, e.g. new-display presets)
- Settings layout: one option per row, help via `?` tooltip; removed separate in-form app search row (filter in start-app dropdown)
- Simplified flat panel styles (`mirror-settings.css`); left cast panel uses Naive buttons/alerts

## 0.7.0 - 2026-05-26

- Mirror「屏幕」settings aligned with escrcpy: grouped `--new-display` presets, custom resolution/DPI, `--flex-display`, `--no-vd-destroy-content`, `--no-vd-system-decorations`, `--display-ime-policy`
- Web cast: use `NewDisplayCapture` when `new_display` is in stream extras; defer pipeline start until ws type 101; recreate `Controller` on display config change so `--start-app` launches on the virtual display (not main display 0)
- Stream extras: `start_app`, `new_display` (incl. main-size empty value), `vd_system_decorations`; server schedules start-app after virtual display is ready (5s wait + retries)
- Frontend: `serializeStartApp` control message; auto start app after connect; `build-scrcpy-server.mjs` auto-picks JDK 17+ from Program Files\\Java
- Fix compile error in `WsCastSession.restartControl`; fix type-101 soft reconfigure NPE via `SurfaceEncoder.requestCaptureReset`

## 0.6.9 - 2026-05-26

- Fix web cast startup crash: soft-reconfigure on ws type 101 instead of full pipeline restart; video+audio PCM with delayed audio start
- Fix show_touches stuck on: always send `show_touches=true/false` and sync system setting on device
- Fix display power toggle (screen off/on); enable `--turn-screen-off` in mirror settings; POWER key fallback on server
- Lock mirror settings UI with overlay while casting (no hot-reload during session)
- Video+audio: browser PCM playback via `WsScrcpyAudioPlayback`; `audio_dup` aligned with scrcpy (playback source, Android 13+ only)
- UI/server guard: disable `audio-dup` and `playback` source when device SDK below 33 (Android 12 devices keep output capture, speakers muted)

## 0.6.8 - 2026-05-26

- Align mirror「音频」settings with escrcpy: `--no-audio`, `--audio-dup`, `--audio-source`, combined `--audio-code`, bitrate presets, buffer fields (web ignores playback buffers)
- `GET /video-encoders` also returns device audio encoders; UI builds `audio-code` options from device list + fallback
- Stream extras: `audio_codec`, `audio_encoder`, `audio_bit_rate`, `audio_source`, `audio_dup`; server `Options.applyStreamExtraPair` applies them for web cast

## 0.6.7 - 2026-05-26

- Enable mirror「禁用视频」for audio-only web cast: PCM over WebSocket (`scrcpy_audio`), canvas waveform + playback via Web Audio
- Server: `WsPcmAudioProcessor`, `WsPcmSender`; `WsCastSession` audio-only pipeline; stream extras `video=false` / `audio=true`
- Fix `WsPcmSender` ByteBuffer read for Android (`get(dst, offset, length)`)

## 0.6.6 - 2026-05-26

- Fix mirror display orientation ignored on web cast: tolerate stream extras in VideoSettings codecOptions (capture_orientation, show_touches, etc.) instead of failing MediaCodec parse
- Clarify UI: capture orientation vs preview-only canvas rotation

## 0.6.5 - 2026-05-26

- Fix video encoder list stuck loading during cast: use `adb exec-out` for `list_encoders`, drop global adb lock, add timeouts, logcat fallback, and generic encoder fallback
- Frontend: 25s fetch timeout for `/video-encoders`; show warning when fallback list is used
- Expand mirror cast settings aligned with escrcpy/scrcpy 4.0 (crop, display orientation, virtual display presets, keep-active, screen-off-timeout, IME policy) via WebSocket type 101 `codecOptions` extras
- Server: parse stream extras (`crop`, `new_display`, `show_touches`, `keep_active`, etc.) in `Options.copyForWebStream`

## 0.6.4 - 2026-05-26

- List real device video encoders (`GET /video-encoders`) with `H264 - name` / `H265 - name` labels; first item is default (no separate “auto” entry)
- Split mirror-options from encoder query so settings UI loads in seconds instead of blocking on adb push + list_encoders
- Reject codec ids (e.g. `h264`) as encoder names; cache encoder list and skip jar push when already on device

## 0.6.3 - 2026-05-26

- Unify mirror video settings across UI, cast API, and ws-scrcpy type 101 (resolution long-edge map, bitrate, fps, encoder, display, capture orientation)
- Apply capture orientation on device via `copyForWebStream`; hot-reload video parameters while casting
- Add preview-only canvas rotation; clarify web cast video UI hints

## 0.6.2 - 2026-05-26

- Fix web cast black screen: align Annex-B WebCodecs player with ws-scrcpy (decode P-frames after first IDR, not only the first keyframe)
- Fix WebSocket proxy race: prefetch client messages during shell startup, queue until device WS is open, retry device connect

## 0.6.1 - 2026-05-26

- Make custom scrcpy WebSocket server report version `4.0` for compatibility with the official scrcpy desktop client
- Kill leftover device scrcpy server processes before starting web cast to avoid `8886` bind conflicts
- Harden ws-scrcpy control handling (filter invalid payloads; send initial VideoSettings on connect)

## 0.6.0 - 2026-05-26

- Add WebSocket cast mode to official scrcpy 4.0 server fork (`4.0-ws1`) in `backend/source/scrcpy` (device-side WS on port 8886, ws-scrcpy wire protocol)
- Add `tools/build-scrcpy-server.mjs`; backend auto-builds `scrcpy-server` via Gradle when missing (`ensureScrcpyServerBuilt`)
- Proxy browser WebSocket to device; Annex-B H.264 player and touch/control over single `/cast/ws`
- Fix redundant `cast/stop` when no backend session; only stop after successful `cast/start`

## 0.5.4 - 2026-05-25

- Replace ADB screenshot MJPEG cast with scrcpy H.264 WebSocket streaming (ws-scrcpy style)
- Add device cast API: `POST/DELETE /api/devices/:serial/cast/start|stop`, WebSocket `/cast/ws`
- Add WebCodecs canvas player in device workspace right panel
- Add `tools/download-scrcpy.mjs`; `build-scrcpy.mjs` auto-downloads official prebuilt when Meson is missing

## 0.5.3 - 2026-05-25

- Add default device cast preview in workspace right panel (start/stop buttons wired)
- Add `GET /api/devices/:serial/cast/stream` MJPEG stream via ADB screencap; left mirror settings not applied yet

## 0.5.2 - 2026-05-25

- Add new-display toggle on mirror cast screen settings; disable existing display picker when enabled

## 0.5.1 - 2026-05-25

- Fix device workspace layout: only left settings panel scrolls, not the whole page
- Widen left cast settings column (24–28rem)

## 0.5.0 - 2026-05-25

- Add mirror cast settings form (video, audio, device, screen) in device workspace left panel
- Add `GET /api/devices/:serial/mirror-options` for displays, apps, encoders, and audio sources
- Fix duplicate `defineEmits()` in AppSidebar

## 0.4.2 - 2026-05-25

- Add device workspace left panel with cast mode selector and start/stop cast buttons
- Reserve middle section for future controls; narrow left column layout

## 0.4.1 - 2026-05-25

- Add icons to device workspace toolbar buttons (icon left of label)

## 0.4.0 - 2026-05-25

- Add device workspace view opened from gallery cards
- Top toolbar with Android control action buttons (UI only); left/right panes reserved for future content

## 0.3.7 - 2026-05-25

- Split device list (1s) and screenshot (5s) refresh timers
- Keep previous gallery and screenshot visible during background updates without loading animation

## 0.3.6 - 2026-05-25

- Vendor scrcpy source under `backend/source/scrcpy` with Cloud Phone config/capabilities hooks
- Add backend scrcpy service, session API (`/api/scrcpy/*`), and cross-platform build/sync scripts
- Document scrcpy/ws-scrcpy network streaming and capability mapping for programmatic control

## 0.3.5 - 2026-05-25

- Fix device panel props by unwrapping `useDevices` refs at App root (fixes Vue prop warnings)
- Wait for backend `/health` before starting Vite in `npm run dev`
- Improve Vite API proxy timeout, startup health check, and backend connection error messages

## 0.3.4 - 2026-05-25

- Enrich device gallery with real ADB fields (manufacturer, Android/SDK, serial, product)
- Add device summary toolbar, manual refresh, last sync time, and online/offline counts
- Sort devices with connected units first; improve screenshot error and offline placeholders

## 0.3.3 - 2026-05-25

- Remove console overview page; default to devices tab
- Tune sidebar tab height for balanced compact layout
- Add `.cursor/skills/ui-ux-pro-max` for Cursor UI/UX design skill

## 0.3.2 - 2026-05-25

- Redesign UI with ui-ux-pro-max design system (Space Grotesk, DM Sans, glass cards)
- Add SVG icon set, improved sidebar, device cards, and auth modals
- Refine light/dark theme contrast, hover states, and accessibility focus styles

## 0.3.1 - 2026-05-25

- Add light/dark theme toggle in the bottom-left sidebar and login screen
- Persist theme preference in localStorage with CSS variable-based styling

## 0.3.0 - 2026-05-25

- Migrate frontend to Vite + Vue 3 SFC with composables and components
- Add console overview tab and fix post-login UI not switching from auth layer
- Add root `npm run dev` to start backend and frontend together
- Serve production frontend from `dist/` via `npm run build` + `npm run start`

## 0.2.5 - 2026-05-25

- Redesign frontend with left sidebar tabs for devices and settings
- Add device gallery cards with live screenshots, device name, and IP address
- Add configurable screenshot refresh interval in settings (default 5 seconds)
- Add `GET /api/devices/:serial/screenshot` and device IP enrichment via ADB

## 0.2.4 - 2026-05-25

- Remove left-side icons from login and forced password change modal headers
- Align auth modal titles flush left with `auth-modal__header--plain`

## 0.2.3 - 2026-05-25

- Fix forced password change flow skipping login and reporting incorrect current password
- Add root `.env` configuration for separate backend and frontend ports
- Split frontend and backend into independent dev servers with API proxy
- Add root npm scripts `dev:backend` and `dev:frontend`

## 0.2.2 - 2026-05-25

- 内置各平台 ADB platform-tools（`backend/bin/adb/`：Windows / Linux / macOS），后端默认使用捆绑 `adb` 而非系统 PATH
- 补充 assistant 文档（scrcpy 源码调研笔记，不参与构建）

### Bundled ADB
- Ship platform-tools per OS under `backend/bin/adb/` for consistent device discovery

## 0.2.1 - 2026-05-25

- 用户认证：登录、会话 Cookie、登出；`auth-service` / `auth-store` 与 JSON 用户存储
- 后端 `app.js` 鉴权中间件与 `/api/auth/*` 路由；未登录访问 API 返回 401
- 前端登录页与基础样式（`frontend/web` 静态页阶段）；强制改密流程 groundwork

### Authentication (v0.2.1)
- Login/logout with HTTP-only session cookies; protected API routes
- Initial login UI before Vue 3 migration

## 0.2.0 - 2026-05-25

- Add `GET /api/devices` backend endpoint for device discovery
- Query connected Android devices through the bundled ADB binary
- Return device serial, state, model, manufacturer, Android version, and SDK version
- Add `tools/version_manager.py` to keep frontend and backend versions aligned

## 0.1.0 - 2026-05-25

- Initialize Node.js backend workspace in `backend/node`
- Add a basic HTTP server entry
- Add a health check endpoint
- Sync frontend and backend versions to `0.1.0`

## 0.0.1 - 2026-05-25

- Initialize repository structure
- Add frontend version file
- Add backend version file
- Add README and ignore rules
