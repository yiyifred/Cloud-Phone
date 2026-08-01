<div align="center">

# Cloud Phone

**用浏览器连真机：投屏、触控、文件、应用、终端，都在一个页面里；另有 Android 伴侣 App，在手机上管理设备与全屏投屏。**

当前版本：**v1.22.2** · Node 后端 + Vue 3 Web + Android 客户端 · Android scrcpy 4.0 WebSocket + 鸿蒙 HDC JPEG + iOS WDA MJPEG 投屏

[English](README.EN.md) · **中文**

</div>

---

## 相关链接

| 平台 | 地址 |
|------|------|
| **GitHub** | [github.com/yiyifred/Cloud-Phone](https://github.com/yiyifred/Cloud-Phone) |
| **Gitee** | [gitee.com/yiyifred/Cloud-Phone](https://gitee.com/yiyifred/Cloud-Phone) |
| **LINUX DO** | [linux.do](https://linux.do/) |
| **爱发电** | [ifdian.net/a/yiyifred](https://ifdian.net/a/yiyifred) |

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
| **多设备并发** | 后端 ADB 按设备分组锁，多台手机可同时控制；同设备多用户 WebSocket 并发，ADB 操作按设备排队 |
| **投屏顶栏顺手** | 多任务/主屏/返回/电源/音量/旋转/剪贴板/录屏/截屏；导航键支持按住与手机同步 |
| **交互更统一** | Naive UI 外壳统一；手机端底部 Tab 导航，退出登录与主题切换在设置页；Lucide 线稿图标 |
| **操作日志** | 左侧 Tab「日志」：Debug / Info / Warn / Error 分级，认证/导航/设备/投屏/串流/设置/界面分类；可搜索、筛选、展开 JSON 详情 |
| **一键开发** | 根目录 `npm run dev` 先等后端 `/health` 再起 Vite，代理失败有明确提示 |
| **主题** | 左下角浅色/深色切换；偏好经后端 SQLite 本地持久化同步 |
| **多语言** | 设置页切换界面语言（简中 / English / 繁中 / 日本語 / 한국어），核心界面即时切换；语言偏好同样本地持久化 |
| **API 安全** | 登录后会话 Cookie（约 **150 天**）写入 SQLite，服务重启可恢复；修改密码立即失效全部会话；401 时先 Cookie、再记住密码静默恢复，失败才显示登录页；JSON 接口 AES-GCM；WebSocket 需有效会话 |
| **设备入口** | 画廊右上角「添加设备」：安卓 USB / 配对码 / 二维码 / **直接连接**（IP+端口，适用 ReDroid 等）；**鸿蒙 USB/HDC**；**苹果 WDA**：Windows USB 向导（签名/安装/连接），或 Mac 运行 `tools/ios-wda-bridge.mjs` 后局域网发现 |
| **Termux 宿主** | 在 Android 手机 Termux 中按 Linux 运行后端（`scripts/install-termux.sh`）；仓库已含 `backend/bin/scrcpy/linux/scrcpy-server`，无需本机 Gradle |
| **Docker/CI** | `docker-cloud-phone/`：Linux 默认 **host 网络**（共享宿主机网卡、ADB/mDNS）；Mac/Windows 叠加 `docker-compose.bridge.yml`；多架构镜像与 Actions 推送；提交信息含 `#android` 时跳过 Docker 打包 |
| **鸿蒙投屏** | HDC + uitest agent + JPEG 流：`cast/start` 推送 agent 并 fport，`/cast/ws` 连接后启动 JPEG 管道并推送帧；可调 **scale/quality**；**实时触控**（ECHO/hdckit `Gestures`）；触控坐标随画面缩放、横屏与预览旋转适配；agent 见 `backend/assets/harmony/` |
| **多应用投屏** | 投屏模式下拉选「多应用投屏」：左侧栏隐藏、右侧全宽 Windows 桌面；Win11 风格任务栏与开始菜单；**每设备一个 scrcpy-server**，每窗独立 WebSocket / 虚拟屏 + `start_app`（对齐原版 `--new-display`）；**顶层窗口 60fps、其余 30fps**（8Mbps）；CSD 出码 + 前端 SPS/PPS 内联保证 WebCodecs 出画；关窗立即隐藏窗口，后台先正常退出再 `force-stop`，避免应用迁到设备主屏；拉伸/最大化同步虚拟屏尺寸；开始菜单底部可「全屏 / 取消全屏」（浏览器原生全屏）；设备上线预热包名/图标到浏览器缓存；开始菜单与应用管理优先读缓存；无图标时显示包名/图标加载进度，有图标后后台静默同步；Icon Helper 按设备缓存并增量更新；快速设置 / 通知中心 |
| **iOS 投屏** | WebDriverAgent MJPEG（9100）+ HTTP 触控；Windows 可将 `wda.ipa` 放到 `backend/bin/wda/` 经向导签名安装，或 Mac 端 `iproxy` + `ios-wda-bridge.mjs` 局域网桥接；浏览器投屏与导航键 |
| **Android 伴侣 App** | 连接同一后端：设备画廊、完整设置页、投屏参数工作区、**多应用 Win11 桌面**（嵌入画布 + 全屏 Activity）、横屏全屏 H.264 投屏；流参数与 Web 对齐；工作区竖屏上下 / 横屏左右自适应 |
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

- 左侧 Tab：**设备**、**群控**、**日志**、**设置**
- 自动发现 ADB 与 **HDC** 设备（内置 `platform-tools` / `backend/bin/hdc`；Windows 含 `libusb_shared.dll`），展示型号、厂商、IP、系统版本、序列号
- 每台设备约 **5 秒**刷新截图（可调），列表约 **1 秒**刷新；刷新时保留上一帧，不闪全屏 loading
- 汇总在线/离线数量、最近刷新时间，支持手动刷新；设备多时可滚动浏览全部卡片，截图懒加载减轻卡顿
- 后端截图并发限制（最多 4 路），设备离线或 ADB 断开时返回可重试状态，避免日志 `unhandledRejection`
- **右键设备卡片**：查看设备详细信息、断开无线设备（USB 连接不支持断开）
- 点击卡片进入**设备工作区**

### 操作日志（Web）

- 左侧 Tab **日志**：记录控制台全部关键操作与串流事件
- 四级等级（Debug / Info / Warn / Error）与七类分类（认证、导航、设备、投屏、串流、设置、界面）
- 支持关键词搜索、等级/分类筛选、清空日志；每条可展开查看 JSON 详情（投屏参数、串流 timeline、页面退出原因等）
- 投屏启动日志（scrcpy / 鸿蒙 / iOS）自动桥接到全局日志

### 群控（Web）

- 右上角 **+** 打开设备选择弹窗：勾选要加入群控的在线设备（支持全选、预览图与名称）
- 已添加设备以网格展示并就地投屏（1080p / 30fps / 4Mbps），无需跳转设备工作区；投屏区域内直接触控
- 点击投屏区域外切换「控制选中」；工具栏支持全选/取消全选；默认选中全部已添加设备，新上线设备自动加入
- 选中至少一台后，左上角批量操作：**电源**（亮屏/息屏）、**音量**（静音/加减）、**应用**（批量安装 APK / 按包名卸载）、**批量控制**（选主控黄色、其余绿色同步操作）
- 设备列表与控制选中分别写入浏览器 `localStorage`
- 后端投屏管道启动前探测本地转发端口；停止投屏或 server 退出时立即中止 WebSocket 代理，避免 `ECONNREFUSED` 重试风暴

### 设置与登录（Web）

- 设置页横向布局，左侧二级菜单：**账号**、**外观**、**刷新**
- **账号**：密码状态（默认 / 已更新）、会话到期时间、修改密码
- **外观**：界面语言（简中 / English / 繁中 / 日本語 / 한국어）、浅色/深色主题；偏好经后端本地持久化（SQLite）同步
- **刷新**：设备列表与截图自动刷新间隔（1–120 秒，默认 1s / 5s），保存后立即生效
- 会话登录（默认密码 `admin`，首次使用请改密）；JSON API 登录后 AES-GCM 加密
- **后端本地数据**：`backend/node/data/` 存放 `auth.key` 与 `cloud-phone.db`，仅本机使用，勿提交到 Git

> **说明**：文件管理、应用管理、ADB 终端在 **Web 与 Android 设备工作区** 均可使用；Android App 另含群控、活动日志 Tab，见下文 [Android 客户端](#android-客户端)。

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

- `POST .../cast/start` 启动；浏览器连 `WebSocket .../cast/ws`；`cast/start` 与 `cast/status` 返回 `startupLogs`（adb push、forward、shell 等）
- 右侧画布在连接阶段显示启动日志（含「前端 scrcpy 启动成功」等），**首帧渲染后自动隐藏**；全屏模式同样显示在同一块画布上
- 非全屏时控制工具栏固定于设备名称下方；全屏时仍为悬浮工具栏
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

- 列表：应用名（经 scrcpy-server `PackageManager` 取 label）、包名、系统/冻结标记；**优先读设备上线写入的浏览器 IndexedDB 缓存**，后台软刷新；经授权后 Icon Helper 可补全图标；未授权仅包名并显示加载进度，已有图标时静默增量同步
- 详情弹窗：版本、SDK、数据目录等
- 卸载（二次确认）、用户级冻结/解冻、导出 APK、在文件管理中打开 `dataDir`
- 本地上传 APK 安装：`PUT .../apps/install`

### 终端

![终端](images/readme/terminal.png)

- xterm.js：Tab、方向键、ANSI 彩色；自动 `stty` 行列
- `WebSocket .../terminal/ws` 桥接 `adb shell -tt`

### 后端与其他

- `GET /health`、`GET /api/devices`、`GET .../screenshot`
- ADB 操作按设备 serial 分组锁：多设备并行、同设备串行；多用户连同一台手机时 WebSocket 并发
- scrcpy 会话 API：`/api/scrcpy/*`（能力查询、会话启停，供脚本集成）
- 工具：`tools/build-scrcpy-server.mjs`、`compare-scrcpy-upstream.mjs`、`sync-scrcpy-from-upstream.mjs`、`build-scrcpy.mjs`、`download-scrcpy.mjs`、`sync-scrcpy-source.mjs`
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
- **长按设备卡片**：查看设备详细信息、断开无线设备（USB 连接不支持断开）
- 右上角 **「+」**：USB 连接引导、无线 **配对码**、**二维码** 配对；另支持 **鸿蒙 USB**、**苹果 WDA** 连接流程
- 图标使用 **Community Material**（Android-Iconics），风格与 Web MDI 一致
- 界面采用 **Material 3** 主题，主导航固定底部并适配手势区安全边距

### 群控（底部 Tab · 群控）

- 从在线设备中选择加入群控网格；**加入后立即开始投屏**（与 Web 一致），启动过程在预览区显示日志
- **自适应网格**：窄屏 1 列、普通手机约 2 列、平板宽度自动多列；点标题栏勾选可启停投屏
- **画面触控**：点设备预览控制远程设备，点空白区域滚动列表；批量模式下主控触控同步跟随设备
- **画面比例**：不同机型按真实宽高比显示并留黑边，不拉伸；添加设备时不重连已在投屏的会话
- 底部导航与操作栏图标与 Web 对齐（电源、音量、应用、批量模式、添加设备）；导航标签字号缩小避免裁切
- 批量操作：电源（亮屏/息屏）、音量（静音/加减）、按包名批量卸载
- **批量控制模式**：指定主控设备，其余设备跟随触控同步

### 活动日志（底部 Tab · 日志）

- 记录应用内关键操作（认证、设备、投屏、文件、应用、终端、群控、设置等）
- 支持等级/分类筛选、关键词搜索、清空日志

### 设置（底部 Tab · 设置）

与 Web `SettingsPanel` 分区一致：

| 分区 | 能力 |
|---|---|
| **账号** | 密码状态、会话到期、修改密码（底部弹窗）、退出登录 |
| **外观** | 界面语言（5 种 locale 偏好）、浅色/深色主题（Material3 DayNight） |
| **刷新** | 设备列表 / 截图刷新间隔（1–120 秒），保存后设备页轮询立即按新间隔运行 |
| **服务器** | 显示当前 `host:port`，一键更换并重新登录 |

设置页采用 Hero 头部 + 分区图标卡片；Web 与 Android 主题色统一为绿色（`#16a34a`）。

### 设备工作区

- 点击设备卡片进入：顶部返回、设备名、**文件 / 应用 / 终端**、**开始**、**投屏模式下拉**；其下第二栏为 **视频 / 音频 / 设备 / 屏幕**（或摄像头设置 Tab）
- **投屏模式**：镜像（默认）/ **多应用** / 摄像头（Android 12+）；鸿蒙/iOS 设备使用 JPEG/MJPEG 投屏
- **布局自适应**：竖屏为上设置、下画布；横屏为左设置、右画布；旋转时自动切换且不中断投屏
- **多标签参数**（与 Web 工作区左侧面板同结构，按设备序列号持久化）：
  - 镜像：视频、音频、设备、屏幕（含虚拟屏预设 Desktop/Mac/iPad 等、`__main__`/`__custom__`、DPI 建议、`start_app` 包名）
  - 摄像头：摄像头、视频、音频（含 `audioCode`、`bufferMs` 等，流 extra 与 Web 对齐）
- 修改参数在离开页面时自动保存
- **右侧/下方投屏画布**：点击 **开始** 在工作区内联投屏；启动阶段显示连接日志（含后端 adb push / forward / shell 与前端 WebSocket 步骤），首帧出现后自动隐藏
- **多应用模式**：工作区嵌入 Win11 风格桌面（任务栏居中、开始菜单、可拖拽/缩放窗口、每窗独立虚拟屏）；拖动与边角缩放手势稳定；任务栏应用过多时自动改为仅图标；开始菜单可进入独立全屏桌面 Activity，再「取消全屏」返回；开始菜单 / 应用管理支持图标服务授权与加载进度（有图标后后台静默同步）；快速设置 / 时钟通知从任务栏向上弹出，日期时间与月历对齐 Web，弹出层随屏幕自适应
- **投屏工具栏**：非全屏时位于设置 Tab 栏下方全宽横条；全屏时底部悬浮
- **全屏** 按钮可携带当前会话进入横屏全屏，无需重复启动后端

### 全屏投屏

- 点击 **开始** 进入横屏全屏：`POST .../cast/start` + `WebSocket .../cast/ws`，**MediaCodec** 解码 H.264，画布 **letterbox** 与预览旋转
- 启动阶段在画布内显示连接日志，首帧渲染后自动隐藏
- **镜像模式**：多任务 / 主屏 / 返回 / 电源 / 音量 / 旋转 / 停止；画布触控注入（scrcpy 协议）
- **摄像头模式**：手电筒、缩小、放大、停止；画布不注入触控
- 顶栏与底栏 **自动隐藏**（约 3.5s），点击画面切换；进入/退出淡入淡出、直播状态点动画
- 流参数（`codecOptions`、虚拟屏、`audioDup` SDK 33+ 等）与 Web/桌面端 **同一套规则**

### 文件管理 / 应用管理 / ADB 终端

- **文件管理**：浏览设备目录、下载到本机 Downloads、上传文件到当前路径
- **应用管理**：搜索已安装应用、安装 APK、详情页支持卸载/冻结/提取 APK/强制停止/跳转数据目录
- **ADB 终端**：WebSocket 连接 `adb shell -tt`，ANSI 彩色输出，支持重连；额外按键栏（ESC/Ctrl/方向键等）与软键盘输入

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
| 群控 / 活动日志 | ✅ | ✅ |
| 投屏参数工作区 | ✅ | ✅ |
| 多应用 Win11 桌面 | ✅ | ✅ |
| 全屏投屏 + 触控/工具栏 | ✅ | ✅ |
| 文件管理 | ✅ | ✅ |
| 应用管理 | ✅ | ✅ |
| ADB 终端 | ✅ | ✅ |
| 剪贴板 / 录屏 / 浏览器截屏下载 | ✅ | — |

---

## 快速开始

**环境（Web）**：Node.js 18+、已授权 ADB 的 Android 设备、支持 WebCodecs 的 Chromium 系浏览器（Chrome / Edge 等）。

**环境（Android App）**：与后端同一局域网；手机安装 `frontend/android` 构建的 APK（见 [Android 客户端 · 构建与安装](#构建与安装)）。

**自动安装（命令行伪图形向导）**：

| 系统 | 命令 |
|------|------|
| Linux（Debian/Ubuntu/Alpine/Fedora/Arch 等） | `bash scripts/install-linux.sh` |
| **Android (Termux)** | `bash scripts/install-termux.sh`（或 `bash scripts/install.sh` 自动分流） |
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
├── backend/source/scrcpy/         # scrcpy 4.0 源码 + WebSocket 改造
├── backend/source/WebDriverAgent/ # iOS WebDriver 服务（Appium WDA，待集成）
├── backend/bin/           # adb、scrcpy 预编译产物
├── frontend/web/          # Vue 3 + Vite + Naive UI（Web 控制台）
├── frontend/android/      # Android 伴侣 App（设备画廊、设置、全屏投屏）
├── tools/                         # 构建、同步、开发启动脚本（含 ios-wda-bridge.mjs）
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
| GET | `/api/devices/:serial/apps/:pkg/orientation` | 推断应用横/竖屏 |
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
node tools/compare-scrcpy-upstream.mjs
node tools/sync-scrcpy-from-upstream.mjs   # 或 sync-scrcpy-source.mjs（兼容）
```

详见 [backend/source/scrcpy/CLOUD_PHONE.md](backend/source/scrcpy/CLOUD_PHONE.md)。

---

## Docker 部署

配置根目录 `.env`（`BACKEND_PORT`、`FRONTEND_PORT`、`DOCKERHUB_NAMESPACE`）。

```bash
cd docker-cloud-phone

# 推荐：自动使用 ../.env（根目录已有 .env 时）
chmod +x compose.sh
./compose.sh up -d

# 或显式指定 env 文件
docker compose --env-file ../.env up -d

# 或软链后可直接 docker compose up -d
ln -sf ../.env .env && docker compose up -d

# 本地单架构构建（当前机器架构）
./compose.sh -f docker-compose.build.yml up -d --build

# 多架构构建并推送 Docker Hub（需 docker login + buildx）
chmod +x build-multiarch.sh
./build-multiarch.sh
```

浏览器访问 `https://localhost:${FRONTEND_PORT}`（默认 5173；自签名证书需在浏览器中信任）。局域网请用 `https://<主机IP>:5173`，可在 `.env` 设置 `FRONTEND_TLS_SAN=<主机IP>`。

**数据持久化**：后端默认将 `docker-cloud-phone/data/` 挂载到容器 `/data`，保存 `auth.key` 与 `cloud-phone.db`（密码、会话等）。重建或升级镜像后数据保留；首次启动会自动创建该目录。

**iOS / Python**：后端镜像已内置 Python 3、`pymobiledevice3` 与 OpenSSL，用于苹果 WDA USB 流水线（安装/转发/启动）；IPA 重签名走 Node 内 `zsign-wasm`。请将 `wda.ipa` 放到 `backend/bin/wda/wda.ipa` 并挂载进容器；Linux 下 USB 连接 iPhone 还需将设备透传进容器（如 `--device /dev/bus/usb` 或 `privileged`），并确保宿主机已识别设备。

**网络模式（Linux 默认 host）**：前后端容器与宿主机共用网络栈，后端可读取全部宿主机网卡（`GET /api/host/networks`），ADB 无线连接与 mDNS 广播使用真实 LAN 地址。Mac/Windows Docker Desktop 不支持 host 网络，请执行：

```bash
./compose.sh -f docker-compose.yml -f docker-compose.bridge.yml up -d
```

---

## 环境变量

根目录 `.env`（参考 `.env.example`）：

| 变量 | 含义 | 默认 |
|---|---|---|
| `HOST` | 监听地址 | `0.0.0.0` |
| `BACKEND_PORT` | 后端 API | `3000` |
| `FRONTEND_PORT` | Vite 开发端口 | `5173` |
| `CLOUD_PHONE_ADB_PATH` | 自定义 adb 可执行文件路径（Termux 等） | 自动探测 |
| `CLOUD_PHONE_ROOT` | 仓库根目录（Termux 路径解析异常时） | 自动推断 |
| `CLOUD_PHONE_SCRCPY_SERVER_JAR` | 魔改 scrcpy-server 路径 | `backend/bin/scrcpy/<平台>/scrcpy-server` |
| `CLOUD_PHONE_USE_HOST_NETWORK` | Docker host 网络（Linux compose 默认 `1`） | `1` |
| `CLOUD_PHONE_DATA_DIR` | 后端数据目录（Docker compose 默认 `/data`，挂载 `docker-cloud-phone/data`） | `backend/node/data`（非 Docker） |
| `CLOUD_PHONE_PREFER_SYSTEM_ADB` | Docker/Linux 优先使用 apt 安装的 adb | `1`（Docker 默认） |
| `CLOUD_PHONE_LAN_IP` | 指定主 LAN IPv4（mDNS / 展示，可选） | 自动选取 |
| `BACKEND_ORIGIN` | 前端代理 `/api` 的后端地址（host 网络为 `127.0.0.1`） | `http://127.0.0.1:3000` |
| `FRONTEND_HTTPS` | 生产前端是否启用 HTTPS（`server.mjs`，Docker 默认开启） | `1`（设 `0` 关闭） |
| `FRONTEND_TLS_SAN` | 自签名证书 SAN（逗号分隔 IP/域名，如 `192.168.1.10`） | 空 |
| `DOCKERHUB_NAMESPACE` | Docker Hub 镜像命名空间 | `yiyifred` |
| `IMAGE_TAG` | Docker Hub 镜像标签（与项目版本号一致，如 `0.13.0`） | 见 `package.json` `version` |
| `DOCKER_PLATFORMS` | 多架构构建平台（`build-multiarch.sh` / CI） | `linux/amd64,linux/arm64` |



---

## 致谢

Cloud Phone 站在很多优秀项目肩上，特此感谢（排名不分先后）：

| 项目 | 用途 | 链接 |
|---|---|---|
| **scrcpy** | 屏幕/摄像头采集、编码、控制的核心；本仓库 `backend/source/scrcpy` 在其 4.0 上扩展 WebSocket | https://github.com/Genymobile/scrcpy |
| **WebDriverAgent** | iOS 自动化与触控/截图 HTTP API；收录于 `backend/source/WebDriverAgent`，供后续苹果设备控制集成 | https://github.com/appium/WebDriverAgent |
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

如果 Cloud Phone 帮你省了时间，欢迎通过 **爱发电** 支持一下，金额随意：

**[https://ifdian.net/a/yiyifred](https://ifdian.net/a/yiyifred)**

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
