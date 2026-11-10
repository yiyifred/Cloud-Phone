# Changelog

## 1.29.1 - 2026-11-10

**设备端 scrcpy-server 改为显式安装**

- **不再自动编译（T-442）**：`services/scrcpy-build.js` 删掉 Gradle 自动构建，改为 `requireScrcpyServer()`；缺 jar 时投屏接口返回 `409 scrcpy_server_missing`，带 `install.expectedPath` 与平台信息，不再在请求里跑 `node tools/build-scrcpy-server.mjs`
- **新增安装接口**：`GET /api/scrcpy/server`（状态与目标路径）、`POST /api/scrcpy/server/upload`（裸二进制，32 MB 上限，校验 ZIP 头与 `classes.dex`）、`POST /api/scrcpy/server/download`（`source=github|ghproxy`）；安装走临时文件加 rename，已存在的兄弟平台副本同步刷新
- **控制台安装面板**：投屏失败时自动弹出 `ScrcpyServerSetupModal.vue`，提供上传、GitHub 直连、gh-proxy.com 加速、手动放置与复制路径四种入口；`startDeviceCast()` 改 `allowFailure`，由 `cast-session.js` 识别 409
- **下载实现**：`utils/http-download.js` 用 curl（继承 `HTTPS_PROXY`、跟随重定向、限制 32 MB），没有 curl 时回退 `fetch`
- **实测**：无 jar 时 `cast/start` → 409；`download ghproxy` → 200 并落盘 819490 B（sha256 `f1eda573…`）；`download github` → 200；上传非 jar → 400 `invalid_scrcpy_server`；安装后 `cast/start` → 200
- **release 资产改名**：`scrcpy-server-android-5.0.1.jar`（服务端，设备端 jar）与 `cloudphone-client-android-1.29.0-debug.apk`（客户端，手机 App），README 中英双语同步安装流程

## 1.29.0 - 2026-11-10

- **scrcpy 设备端升级到上游 v5.0.1（T-441）**：`backend/source/scrcpy` 基线由 4.0 同步到 5.0.1，保留 `ws/` WebSocket 投屏改造；`SCRCPY_SERVER_VERSION` 同步为 `5.0.1`，`backend/bin/scrcpy/{linux,macos,windows}/scrcpy-server` 重新编译（819 KB）
- **同步 4.1 能力**：VP8 / VP9 视频编码器；编码器尺寸约束改为「先尝试、失败再收紧」并新增 `--ignore-video-encoder-constraints`（`VideoConstraints` + `Size` + `BinarySearch`）；推文件后触发 MediaStore 扫描（控制消息 `TYPE_SCAN_FILE`）；摄像头目标尺寸自适应与停止时的噪声抑制
- **同步 5.0 能力**：播放音频采集覆盖所有 usage；新显示器 resize 使用 `constrain(..., false)` 并固定 dpi
- **保留的 Web 化改造逐项复核**：MediaFormat csd-0/csd-1 拼完整 SPS+PPS、type-101 不重建采集（`applyStreamTuning`）、虚拟屏被拒不重试降分辨率、`resetVideo()` 改请求关键帧
- **实测**：Waydroid（192.168.240.112:5555）ws 投屏出帧 12 帧 / 101 KB（h264）、23 帧 / 380 KB（h265）、12 帧（vp9）；重复 type-101 场景仍为 12 帧（守卫生效）

## 1.28.1 - 2026-11-09

**Android 编译修复 · Waydroid 端到端投屏验证**

- **投屏首帧黑屏修复（T-438）**：网页播放器此前只用 `hardwareAcceleration: "prefer-hardware"` 配置 `VideoDecoder`；无硬件 H.264 的浏览器（headless Chromium、部分 Linux 桌面）会**异步**报 `Unsupported configuration`，同步 `catch` 兜不住，画面永远停在默认 `300x150` 黑画布。现在先用 `isConfigSupported()` 探档（prefer-hardware → prefer-software → no-preference），异步报错时重建解码器降档重试；关键帧等待与 2s 节流抽到 `utils/h264-keyframe-guard.js`。实测 canvas 由 `300x150` 变为 `1280x768` 并出帧
- **设备端采集守卫（T-438）**：重复 type-101 参数包不再 `requestCaptureReset()`（改为下一轮采集生效的 `applyStreamTuning`），客户端要关键帧改用 `PARAMETER_KEY_REQUEST_SYNC_FRAME`；重建采集前先停旧编码器，避免同一 display 上叠加第二个 VirtualDisplay；`DisplayMonitor` 首次观察不再触发 `DISPLAY_PROPERTIES_CHANGED`；playback PCM 音频与显示采集争用同一 MediaProjection 时保留视频并关闭 PCM（`audio_dup=true` 可走设备扬声器）。实测重复参数包场景 0 → 553 帧，开音频场景 0 → 552 帧

- **Android 编译修复（T-437）**：`cast/CastWebSocketSession.java`、`cast/JpegStreamPlayer.java`、`terminal/TerminalWebSocket.java` 在子包里使用 `ServerUrl` 却未 import，导致 `1.28.0` 的 `assembleDebug` 直接失败；补三行 `import com.yiyi.cloud_phone.ServerUrl;` 后 `:app:assembleDebug --rerun-tasks` 32 任务全部执行并 `BUILD SUCCESSFUL`
- **Waydroid 端到端投屏验证（T-437）**：Waydroid 作为被控设备接入后端，明文 `ws://` 与 `BACKEND_TLS=1` 的 `wss://` 两条链路各自抓到 23 个视频包、约 424 KB Annex-B 帧；`ffprobe` 识别为 `h264 1280x768`、可解 22 帧；设备在 Web UI 画廊显示在线（`192.168.240.112:5555`）
- **投屏协议要点**：客户端连 `/api/devices/<serial>/cast/ws` 后必须补发 type-101 视频参数包，否则 `WsCastSession.join()` 停在 "waiting for stream parameters" 不出帧
- 任务单 `tasks/T-437`
- **控制台界面收口（T-439）**：设备画廊缩略图改为 13rem 等高预览区，图片加载失败自动退化占位（不再显示破图 alt 文本），长产品名两行省略；投屏中底栏只保留红色「取消投屏」，未投屏只保留「开始投屏」；投屏设置行改成「标签 8rem / 控件 / 帮助问号」三列网格，中文标签不再被裁、问号不再掉行
- **截图接口修复（T-439）**：Waydroid 等设备上 `adb exec-out screencap -p` 会把 PNG 当文本返回（内容形如 `/vendor/...`），前端因此永远拿不到缩略图；现在校验 PNG 魔数，失败自动回退 `adb shell screencap -p` + `adb pull` 的二进制安全路径

## 1.28.0 - 2026-11-08

**后端 HTTPS · Prometheus 指标 · 深色模式收口 · 大文件收敛**

- **后端 TLS（T-436）**：`BACKEND_TLS=1` 时后端以 https 提供 API；证书优先取 `BACKEND_TLS_CERT/KEY`，否则用 openssl 生成自签证书落盘 `backend/node/data/.tls`（0600，SAN 指纹 + 剩余 <7 天才重签，重启指纹不变）；`app.js` 拆出 `createRequestHandler()` 让 http/https 共用路由；前端反代按协议切换并对环回后端放行自签（远端仍强制校验，除非 `BACKEND_TLS_INSECURE=1`）
- **Android 协议收口**：新增 `ServerUrl.java`，7 处硬编码 `http://`/`ws://` 改为按 scheme 生成；地址框可填 `https://host`，协议持久化到 `server_scheme` 并在变更时清掉旧密码缓存（wss 随 https 自动切换）
- **Prometheus 指标（T-435）**：`GET /metrics` 输出 HTTP 请求数/耗时直方图、WS 连接、投屏会话、登录失败；route 模板化（设备段折叠 `:serial`、包名折叠 `:param`，不外露序列号）；单指标序列上限 500；默认仅回环可读，`METRICS_TOKEN` 控制远端抓取，拒绝时与 404 无法区分
- **深色模式（T-434）**：`windows-desktop.css` 的 80 处硬编码 hex 全部换成 `--win-*` 语义 token（浅色像素级不变），新增 `theme-dark.css` 覆盖桌面壳/任务栏/窗口/浮层；深色正文对比度 13.32:1、任务栏 15.27:1、三级文字 6.56:1；主题切换 180ms 颜色过渡并遵守 reduced-motion
- **大文件收敛（T-433）**：`useDeviceScrcpyCast.js` 868→98（cast-context 保住单实例状态，拆出启动日志/连接/帧/控制通道），`AddDeviceApplePanel.vue` 383→112，`add-device-modal.css` 997→5 个连续分片（拼接 diff 为空）
- 任务单 `tasks/T-433`～`T-436`

## 1.27.0 - 2026-11-08

**审计身份 · 统一确认框 · 工程收敛**

- **日志记录操作者（T-431）**：`app_event_logs.actor` 此前恒为 `local`，现在由服务端按会话判定 —— 管理员写 `admin`，只读分享访客写 `viewer:<备注名>`；客户端自报的 actor 一律被覆盖（否则审计列可伪造）；`MAX_LOG_ACTOR_LENGTH=64`；日志面板在等级/分类徽章旁显示身份徽章
- **应用内确认框（T-432）**：断开设备、抢占控制权、吊销分享链接三处 `window.confirm` 换成全局 NModal 确认框 —— 危险操作确认按钮标红、语言随界面、默认焦点在「取消」、Esc 可关闭、移动端按钮 ≥44px
- **main.css 拆分（T-429）**：3380 行单文件按连续行区间切成 16 个主题模块（`assets/index.css` 按原顺序 `@import`），拼接与原文逐字节一致（构建产物 125103 B 零漂移）
- **触控目标（T-429）**：`@media (max-width: 900px), (pointer: coarse)` 下主要按钮/图标按钮/页签/底部导航最小 44px（原 21.6–36px），桌面端不受影响
- **超大组件拆分（T-430）**：`GroupControlPanel.vue` 738→232、`AddDeviceModal.vue` 653→276，抽出 `group-control/` 与 `add-device/` 子组件（含选择状态机），行为与文案不变
- 任务单 `tasks/T-429`～`T-432`

## 1.26.1 - 2026-11-08

**投屏编码器不再"假支持"**

- **问题**：设置里可选 H.265 / AV1 编码器，但网页播放器只解析 H.264 Annex-B 并只用 `avc1.*` 构造 `VideoDecoder` 配置，选中后画面直接黑掉
- **能力探测**：新增 `utils/webcodecs-support.js`，用 `VideoDecoder.isConfigSupported` 探 avc1.42E01E / hvc1.1.6.L93.B0 / av01.0.05M.08 并缓存；同时区分"播放器不实现"与"浏览器解不了"两种原因
- **下拉置灰**：不可解码的编码器条目禁用并标注原因（"(网页端仅支持 H.264)" / "(浏览器无法解码)"），帮助文案随之切换
- **自动回退**：历史设置或分享链接带来的 H.265/AV1 选择，在探测完成后自动回退到可用编码器并弹一次警告；设备只提供不可解码编码器时明确提示"投屏会黑屏"
- 覆盖镜像投屏与摄像头投屏两处编码器选择器；任务单 `tasks/T-428`

## 1.26.0 - 2026-11-08

**只读分享链接（新）**

- **分享令牌**：管理员可生成限时只读链接（1/8/24/72 小时，默认 24 小时、上限 30 天），服务端只存 `sha256(token)`，明文只在创建时返回一次，可随时吊销（`services/share-tokens.js`）
- **访问闸门**：没有管理员会话时回落到 `cloud_phone_share` cookie；viewer 只允许 `GET/HEAD`，写操作 403 `viewer_forbidden`，且不能访问 `/api/share*` 与 `/api/auth*`（防止分享凭据自我续期或改密）；唯一写白名单是 `POST cast/start` 与 `DELETE cast/stop`（看画面所必需）
- **落地页**：`GET /api/share/redeem?token=` 302 回控制台并种 HttpOnly + SameSite=Lax + Max-Age cookie；失效链接跳 `/?share=invalid`
- **WebSocket**：viewer 可连投屏观看，控制帧一律丢弃并回 `control-denied(reason=viewer)`（视频帧与 RESET_VIDEO 放行），ADB 终端直接 `close 4403`
- **界面**：设置页「分享」页签（生成 / 复制一次性链接 / 列表 / 吊销）；viewer 态顶部只读横幅，群控入口隐藏，添加设备、断开、清空日志、保存设置、改密全部禁用，工作区只保留截屏与投屏观看

**其它**

- 五语 `share.*` / `access.*` 文案（各 378 键，键集合一致）
- 任务单 `tasks/T-424`～`T-427`

## 1.25.1 - 2026-11-08

- **租约列表接口**：新增 `GET /api/devices/control`，一次返回全部被占用设备（`mine` 按请求者会话计算）；画廊角标不再按设备逐个发加密请求（24 台 = 24 请求），列表不可用时退回逐台探测
- 任务单 `tasks/T-423`

## 1.25.0 - 2026-11-08

**设备控制权租约（新）**

- **租约服务**：每台设备一个内存态租约，TTL 45 秒、20 秒心跳续期、15 秒清扫；会话身份用 `sha256(token)` 前 12 位，令牌不落日志；支持抢占并记录 `previousHolder`（`services/device-control-lease.js`）
- **接口**：`GET /api/devices/:serial/control`、`POST .../control/{acquire,release,heartbeat}`；冲突返回 409 + holder + enforced（`routes/device-control-routes.js`）
- **强制模式**：`CLOUD_PHONE_CONTROL_ENFORCE=1` 才拒绝写操作，默认 advisory 完全不影响单用户流程
- **接线**：投屏控制帧（丢弃并回 `control-denied`，RESET_VIDEO/视频帧放行）、ADB 终端（`close 4403`）、安装/冻结/卸载/上传/停止应用在收流或执行前 409（`services/control-guard.js`）
- **前端**：进入工作区自动取得租约、20 秒心跳、离开释放；设备卡「控制中/只读」角标；工具栏控制权按钮四态 + 二次确认抢占；只读时导航/音量/旋转置灰，截屏与文件不受影响
- **修复**：`ws.close(4403, 长中文)` 超过 123 字节 reason 上限会抛 `RangeError` 并让连接留在打开态，已按 UTF-8 码点裁剪并 `terminate` 兜底

**其它**

- 五语 `devices.control.*` 15 键补齐（各 341 键，键集合一致）
- 任务单 `tasks/T-420`～`T-422`

## 1.24.0 - 2026-11-08

**性能与传输**

- **文件流式化**：下载由「整文件 base64 进加密 JSON」改为 `createReadStream` 分块响应，上传改为 `pipeline` 流式落盘后 `adb push`；100 MiB 下载在 `--max-old-space-size=256` 下内存峰值 1.10× 文件大小，五种失败路径临时文件零残留（`services/device-files-transfer.js`、`utils/protected-http.js`、`routes/device-files-routes.js`）
- **修复上传上限**：`UPLOAD_PATH_PATTERN` 漏了 `/files/upload`，5 MiB 上传会在进路由前被 1 MiB JSON 上限拦成 413（`utils/http.js`）
- **上传错误语义**：目标目录不存在 404、父级非目录 / 缺 path / 空体 400、超限 413，不再一律 500

**前端交付**

- **字体自托管**：去掉 Google Fonts 外链，改系统字体栈；CSP 的 `style-src`/`font-src` 不再放行 googleapis/gstatic，离线与内网环境不再回退字体
- **i18n 补齐**：ja-JP / ko-KR / zh-TW 缺的 35×3 个 `devices.addDeviceModal.*` 键与 en-US 的 `qr.imageTitle` 全部补齐，五语均 326 键、键集合一致，运行时零 `Not found` 警告
- **视觉收敛**：主按钮合并为单一来源（token 化的高度/圆角/字号/过渡/焦点环），离线设备卡片改 16/10、ADB 状态中文化

**平台加固**

- **Android**：`allowBackup=false`，备份规则 cloud-backup 与 device-transfer 全量排除；`network_security_config` 只信任系统 CA（debug 变体放开 user CA 供抓包）；明文保留并写明原因——客户端与后端都只有 http，一刀切会连不上设备
- **Docker**：前后端镜像以 uid 10001 非 root 运行，数据目录外置 `/data`；compose（含 build 变体）加 `no-new-privileges` 与 `cap_drop: ALL`；新增根目录 `.dockerignore`，不再把 `.env` 与 1.8G 参考仓库打进镜像

**文档**

- 任务单 `tasks/T-411`～`T-416`；`docs/security-and-ux-hardening.md` 补 v1.24 进展与验证数据

## 1.23.0 - 2026-11-07

**安全加固**

- **登录限流**：IP 维度 5 次/5 分钟 → 锁 15 分钟并指数退避到 60 分钟，全局 20 次/10 分钟；`429` + `Retry-After`，成功后清桶（`backend/node/src/services/login-throttle.js`）
- **会话 Cookie**：`Max-Age` 默认 30 天（`AUTH_SESSION_DAYS` 可配）、条件 `Secure`、恒时签名比较（`services/auth-service.js`、`utils/request-https.js`）
- **请求边界**：JSON 1 MiB / 上传 256 MiB，超限 `413` 并 drain 连接；`requestTimeout` / `headersTimeout` / `keepAliveTimeout`（`utils/http.js`、`index.js`）
- **来源校验**：CORS 显式白名单；WS 握手校验 `Origin`，`maxPayload` 4 MiB，并发上限终端 4 / 设备 32 / 投屏 64（`utils/http.js`、`middleware/ws-auth.js`、`ws/device-websocket-server.js`）
- **数据与日志**：数据目录 `0700`、密钥与数据库 `0600`；日志新增 `actor` 列与长度截断（`services/auth-store.js`、`services/local-persistence-logs.js`）
- **设备应用**：包名白名单校验，安装临时包随机名 + `0600`（`services/device-apps-mutate.js`、`routes/device-apps-routes.js`）
- **前端交付**：统一安全响应头、自签证书持久化复用（`frontend/web/server.mjs`、`tls-self-signed.mjs`）
- **CSP 兼容**：开启 vue-i18n JIT 编译，消息不再运行时 `new Function`，避免 CSP 下白屏（`vite.config.js`）

**界面与体验**

- **设计令牌**：补齐字号/行高/间距/圆角/阴影/动效/焦点环/舞台底色，修复未定义的 `--radius-sm`（11 处生效）
- **可读性**：主色 #15803d、次级绿 #166534（白字 5.02:1），24 处绿字改用 `--success-text`，`outline: none` 处补焦点环
- **布局**：画廊 `minmax(240px, 320px)` 居中、预览 3/4；弹窗 `max-height`，≤560px 变底部 sheet；平板断点侧栏 425px → 140px、按钮不再折行
- **投屏**：新增 `CanvasFitLayout` 等比适配，修复非等比例窗口下的画面拉伸与触摸偏移
- **加载与空态**：新增骨架屏与带图标的空态组件，首屏与启动态不再空白

**文档**

- 新增 `docs/security-and-ux-hardening.md`（24 条安全缺陷 + 26 条界面缺陷登记、对标矩阵、三版本 WBS、实测数据）
- 任务单 `tasks/T-400`～`T-410`

## 1.22.5 - 2026-08-02

- **操作日志分页**：`GET /api/logs` 支持 `limit` / `beforeId` 按页拉取；登录不再整包下发日志
- **Web / Android**：日志页首屏加载一页，可「加载更多」；Android 同步写入并分页读取服务端日志
- **Android / 项目版本**：`1.22.5`（versionCode 1230）

## 1.22.4 - 2026-08-01

- **修复多应用标题栏**：双击返回/最小化/关闭不再触发最大化或还原
- **Android / 项目版本**：`1.22.4`（versionCode 1229）

## 1.22.3 - 2026-08-01

- **多应用虚屏看守**：实时检测应用是否仍在虚拟屏；若跑到主屏则自动拉回虚屏；若已退出则同步关闭窗口
- **运行状态 API**：`/apps/:pkg/running` 增加 `onVirtualDisplay` / `displayIds`
- **Android / 项目版本**：`1.22.3`（versionCode 1228）

## 1.22.2 - 2026-08-01

- **多应用动态帧率**：最顶层（聚焦且未最小化）窗口 60fps，其余窗口 30fps；切换焦点时通过 type-101 动态调整
- **Android / 项目版本**：`1.22.2`（versionCode 1227）

## 1.22.1 - 2026-08-01

- **多应用关窗停应用**：点 X 先正常退出（`stop-app`），再 `force-stop`；避免 `noVdDestroyContent` 把应用迁到平板主屏
- **关窗不卡 UI**：窗口立即关闭，后台完成停应用与拆虚屏
- **API**：新增 `POST /apps/:pkg/stop`；应用管理「强制停止」仍走 `/force-stop`
- **Android / 项目版本**：`1.22.1`（versionCode 1226）

## 1.22.0 - 2026-08-01

- **图标加载进度**：开始菜单 / 应用管理在无图标时显示包名或图标提取进度条；已有图标时后台静默同步，不再挡界面
- **按设备图标缓存增量**：Icon Helper 增加 `iconHash`；服务端按设备缓存图标，仅拉取未缓存 / 变更包，卸载时清理缓存并下发给 Web / Android
- **Android 对齐**：开始菜单与应用管理增加授权弹窗与进度条，列表可显示服务端下发的图标
- **提示文案修正**：「始终允许安装」时不再误报「未安装服务应用」；仅用户关闭安装时提示仅包名
- **Android / 项目版本**：`1.22.0`（versionCode 1225）

## 1.21.4 - 2026-08-01

- **赞助入口改为爱发电**：移除微信/支付宝收款码，相关链接表与赞助区统一指向 [ifdian.net/a/yiyifred](https://ifdian.net/a/yiyifred)
- **Sponsorship via Afdian**：removed WeChat/Alipay QR codes; links table and sponsorship section now point to Afdian
- **项目版本**：`1.21.4`

## 1.21.3 - 2026-07-30

- **修复 Android 群控选择栏**：全选 / 清空按钮去掉 Material inset 裁切，文字完整显示
- **Android / 项目版本**：`1.21.3`（versionCode 1224）

## 1.21.2 - 2026-07-30

- **Android 群控画面比例**：按视频真实宽高比 contain 适配并留黑边，避免不同机型被拉伸
- **群控会话复用**：添加/刷新设备列表时不重连已在投屏的会话；WebSocket 已开则只换绑 Surface；DiffUtil 增量更新槽位
- **Android / 项目版本**：`1.21.2`（versionCode 1223）

## 1.21.1 - 2026-07-30

- **修复 Windows adb forward 10013**：本地端口先探测可绑定，避开 Hyper-V 排除区间；失败自动换端口重试
- **Android 群控触控**：点设备画面控制远程设备，点空白区域上下滑动列表；批量模式主控触控同步跟随设备
- **群控状态栏**：错误文案缩短并最多两行，避免底部显示不全
- **Android / 项目版本**：`1.21.1`（versionCode 1222）

## 1.21.0 - 2026-07-30

- **Android 群控对齐 Web**：加入设备后立即投屏；自适应网格（窄屏 1 列 / 手机约 2 列 / 平板多列）；启动过程叠加显示日志；电源/音量走 `screen-on` / `volume-*` 控制通道
- **群控界面精简**：紧凑顶栏与操作条、选中描边卡片与勾选态；底部导航标签缩小至 10sp，减轻文字裁切
- **ADB 终端增强**：会话 Cookie 附带到终端/JPEG/投屏 WebSocket；修复重连按钮类型转换崩溃；新增 Termux 风格额外按键栏与软键盘输入
- **多应用任务栏**：应用过多时自动改为仅图标芯片，为托盘留出空间
- **Android / 项目版本**：`1.21.0`（versionCode 1221）

## 1.20.4 - 2026-07-30

- **修复 Android 多应用窗口拖动/缩放**：拖动手势中不再整窗重绑触摸监听，避免窗口跳动与缩放中断；标题栏高度按密度换算；最大化时隐藏缩放边；边缘热区加大
- **Android / 项目版本**：`1.20.4`（versionCode 1220）

## 1.20.3 - 2026-07-30

- **Android 工作区顶栏重构**：顶栏为返回、设备名、文件/应用/终端、开始、投屏模式下拉；视频/音频等设置 Tab 下移到独立第二栏
- **Android 版本号与项目统一**：`versionName` 改为与项目相同的语义化版本 **`1.20.3`**（versionCode 1219）

## 1.20.2 - 2026-07-30

- **CI**：推送到 `main` 时若提交信息包含 `#android`，跳过 Docker 镜像构建与推送；手动 `workflow_dispatch` 仍会打包

## 1.20.1 - 2026-07-30

- **Android 多应用日期时间对齐 Web**：任务栏时钟用 zh-CN 的 `HH:mm:ss` / `yyyy/M/d`；日历头为 `M月d日, 星期X` + ICU 农历；补全月历网格与节气副标
- **弹出层屏幕适配**：开始菜单 / 快速设置 / 时钟面板宽度与高度限制在任务栏上方可用区域内，空间不足时压缩并可滚动
- **Android App 版本**：`0.14.1`（versionCode 1217）

## 1.20.0 - 2026-07-30

- **Android 多应用投屏**：设备工作区新增「多应用」模式，嵌入 Win11 风格桌面（壁纸、居中任务栏、开始菜单、可拖拽窗口、每窗独立虚拟屏投屏）
- **全屏桌面 Activity**：开始菜单「全屏 / 取消全屏」在嵌入画布与独立横屏桌面间切换；快速设置三列磁贴与时钟/通知面板锚定任务栏弹出
- **工作区横竖屏布局**：竖屏上下排布（上设置、下画布），横屏左右分栏；旋转时自适应且不中断投屏
- **Android App 版本**：`0.14.0`（versionCode 1216）

## 1.19.2 - 2026-07-29

- **Android Material 3 UI 升级**：控制台与登录等页面统一使用 Material 3 主题色板与组件样式（Surface / OnSurface / Outlined 输入框）
- **底部导航栏优化**：控制台导航固定底部，采用 Material 3 `BottomNavigationView` 样式、激活指示器与分隔线，适配手势区 inset 与旋转后 Tab 保持
- **Android App 版本**：`0.13.2`（versionCode 1215）

## 1.19.1 - 2026-07-29

- **修复 Android 群控图标缺失**：底部导航群控 Tab 改用有效 MDI 图标 `account-group`；群控操作栏（电源/音量/应用/批量模式）与添加设备按钮补齐图标；设备槽位无截图时显示占位图标
- **Android App 版本**：`0.13.1`（versionCode 1214）

## 1.19.0 - 2026-07-29

- **Android 伴侣 App 功能对齐 Web**：底部导航新增群控、日志 Tab；设备工作区增加文件管理、应用管理、ADB 终端入口
- **文件管理**：浏览设备目录、下载到本机、上传文件到设备
- **应用管理**：列表搜索、安装 APK、详情（卸载/冻结/提取 APK/强制停止/打开数据目录）
- **ADB 终端**：WebSocket 连接 `adb shell -tt`，支持 ANSI 彩色输出与重连
- **活动日志**：内存日志面板，按等级/分类筛选与搜索
- **群控**：多设备网格、截图预览、电源/音量广播、批量卸载、主从批量控制模式
- **平台扩展**：添加设备支持鸿蒙 USB、苹果 WDA 连接流程；新增 JPEG/MJPEG 投屏播放器（iOS/鸿蒙）
- **Android App 版本**：`0.13.0`（versionCode 1213）

## 1.18.2 - 2026-07-29

- **修复启动与图标加载异常**：`/health` 改为匿名就绪探针，`/api/public/preferences` 允许未登录访问；前端遇到空响应/坏 JSON 时给出明确错误，不再直接抛 `Unexpected end of JSON input`

## 1.18.1 - 2026-07-29

- **修复多应用拉伸/最大化虚拟屏不同步**：窗口尺寸变化后改为对比「上次已发送」的 VD 尺寸再发 `RESIZE_DISPLAY`，避免被提前更新的 window.vd* 误判跳过

## 1.18.0 - 2026-07-29

- **多应用开始菜单全屏**：应用列表下方（关机键位置）增加「全屏 / 取消全屏」；与正常投屏一致，对设备工作区调用 Fullscreen API（`navigationUI: hide`）隐藏浏览器地址栏

## 1.17.1 - 2026-07-29

- **修复应用管理未走浏览器缓存**：打开顶部「应用管理」时先从 IndexedDB 秒开列表，再后台软刷新；不再强制清空后全量拉网；列表可展示缓存图标与名称

## 1.17.0 - 2026-07-29

- **多应用关窗杀进程**：关闭多应用窗口时除拆除投屏/虚拟屏外，调用 `am force-stop` 强制结束对应应用进程，避免进程残留

## 1.16.0 - 2026-07-29

- **多应用出画（华为等）**：scrcpy-server 在 `INFO_OUTPUT_FORMAT_CHANGED` 时把 CSD（SPS/PPS）写入码流；前端缓存参数集并在关键帧前内联，避免 WebCodecs 黑窗（画布停在 300×150）
- **对齐原版 scrcpy**：多应用路径注释与选项与 `--new-display` + `--start-app` 对齐；H.264 解码错误仅在已出画后升级提示
- **设备上线预热应用缓存**：在线即用 ADB 拉包名写入浏览器 IndexedDB；经同意后 Icon Helper 补全名称/图标；开始菜单与应用管理优先读缓存
- **本地持久化**：主题、语言、设置、操作日志、Icon Helper 授权等经后端 SQLite（`/api/local-persistence`）同步，减少纯 localStorage 依赖

## 1.15.3 - 2026-07-28

- **修复日志面板滚动**：长列表不再被 flex 布局挤压，可正常滚动查看

## 1.15.2 - 2026-07-24

- **多应用流畅度对齐原版 scrcpy**：代理关键帧检测改为 O(1) 只看首 NAL（避免大 IDR 逐字节扫描卡住 Node）；传输层几乎不丢 P 帧（阈值 16MB，贴近原版不丢编码包）
- **Annex-B 播放器**：一个 MediaCodec 缓冲一次 `decode()`；显示层只保留最新帧（同桌面 `sc_frame_buffer`）；多应用码率对齐原版默认 **8Mbps / 60fps / I=10s**

## 1.15.1 - 2026-07-23

- **修复多应用卡住「正在创建虚拟屏」**：web 模式 nohup 后 `waitForCastSessionReady` 误判失败导致空等；`cast/start` 前端 45s 超时
- **开始菜单秒开窗**：点击应用立即创建窗口，不再等待方向查询；方向信息后台补全
- **缩放不再误关窗**：adb/`dumpsys` 不确定时不当作应用退出；缩放期间暂停退出检测；断流同窗重连（最多 3 次）；开启 `noVdDestroyContent`

## 1.15.0 - 2026-07-23

- **多应用恢复共享 scrcpy-server**：撤销「每窗多端口 / 多进程」自创方案（adb forward 10013、误杀进程）；回到原设计——每设备一个 web `:8886` 进程，多窗复用 + 独立虚拟屏 / WebSocket
- **多应用流畅度**：去掉播放器「丢 P 帧后等 I 帧」冻结；首帧不再强制 `RESET_VIDEO`；代理积压丢帧阈值提高到 2MB；编码参数对齐镜像（60fps / 5Mbps / I=10s）
- **稳定性**：web 模式 adb shell（nohup）退出不再误删会话；本地 forward 端口改到 37100+，避开 Windows 常见保留段；`pkill` 命令整句传递
- **登录会话持久化**：会话写入 SQLite，服务重启后 Cookie 仍可用；Cookie / 令牌有效期 **150 天（约 5 个月）**；修改密码立即清空全部会话
- **静默恢复登录**：401 时先用 Cookie 拉回加密密钥，再试记住的密码，两者都失败才显示登录页

## 1.14.9 - 2026-07-23

- **修复多应用黑窗**：Annex-B 播放器按 NAL 拆分并组装 access unit（MediaCodec 常把 SPS+PPS+IDR 打在同一缓冲）；此前整包当首个 NAL 并提前 return，IDR 丢失导致画布停在默认 300×150
- **真机验证**：TGR-W10 多应用打开 LangEasyLexis，画布 1080×1920 正常出画

## 1.14.8 - 2026-07-23

- **修复多应用一直显示「正在启动虚拟屏」**：`cast/start` 返回后立即结束该提示（不再把「等首帧解码」算进启动中）；连接在收到 `scrcpy_initial` / 视频流 / 700ms 兜底后即就绪
- **出画**：收到视频后请求关键帧；type 101 处理时确保 WebSocket 留在 session clients；播放器兼容 3/4 字节 NAL 起始码

## 1.14.7 - 2026-07-23

- **修复「正在启动虚拟屏」卡住**：设备上 VD 已创建但仍一直等待时，改为收到首包 Annex-B 视频即结束启动态（不再死等 canvas 首帧）
- **WebCodecs**：同时支持 3 字节 / 4 字节 NAL 起始码；连接成功但未出画时提示「虚拟屏已连接，等待首帧…」

## 1.14.6 - 2026-07-23

- **虚拟屏启动对齐原版 scrcpy**：VD 创建后立刻 `start_app`（原版客户端控制通道就绪即发 START_APP，服务端等 VD id ≤1s）；去掉服务端人为 **3.5s+2.5s** 延迟与前端 **2.8s** 二次 START_APP，开窗明显更快
- **减少软重启**：type 101 已预取成功时不再在 `scrcpy_initial` 上补发

## 1.14.5 - 2026-07-23

- **修复 type 101 丢失导致无法出画**：WebSocket upgrade 后立刻缓冲客户端帧（此前 `await` 平台检测期间浏览器 open 发出的 CHANGE_STREAM_PARAMETERS 会丢失）；首次 `scrcpy_initial` 仍补发一次流参数，后续不再重发以免编码器风暴

## 1.14.4 - 2026-07-23

- **修复 type 101 风暴卡顿**：收到 `scrcpy_initial` 后若已发送流参数则不再强制重发；重试改为最多 1 次；去掉二次 START_APP，避免编码器反复 soft-reconfigure
- **虚拟屏 bounds**：type 101 写入真实 VD 宽高（如 1080×1920），不再使用 `1920x0`

## 1.14.3 - 2026-07-23

- **流畅度 / 传输热路径**：代理检测 Annex-B **零拷贝**（此前对 ArrayBuffer 整帧 `Buffer.from` 复制）；浏览器 WS 积压 >512KB 时丢弃过时视频帧，避免越播越卡
- **解码绘制**：WebCodecs 画布按视频分辨率 1:1 绘制、CSS 缩放；积压时只丢 P 帧并等下一 IDR；多应用 **60fps / 16Mbps / I 帧 2s**
- **减少卡顿源**：type 101 重试减至 3 次，收到视频即停；缩放防抖 500ms；WebSocket 关闭 perMessageDeflate；二进制分发走 Annex-B 快路径

## 1.14.2 - 2026-07-23

- **流畅度大修**：WebCodecs 播放器不再把每帧都标成 keyframe（改为 IDR=`key` / 其余=`delta`），消除单窗口也严重卡顿
- **传输热路径**：代理对 Annex-B 视频跳过逐帧解析/日志；设备端 scrcpy 日志改为 INFO
- **码率对齐原版**：多应用恢复 **60fps / 8Mbps**，虚拟屏按 1080p 档稳定编码（窗口仅缩放预览）

## 1.14.1 - 2026-07-23

- **修复无法新建虚拟屏**：type 101 在代理就绪前丢失后不再被跳过；收到 `scrcpy_initial` 后强制重发，并短间隔重试直至首帧
- **多应用卡顿**：每窗 30fps / 2.5Mbps；VD 长边对齐约 1080；缩放防抖 350ms；错开连续打开窗口

## 1.14.0 - 2026-07-23

- **多应用默认窗口**：高度铺满画布（顶到任务栏），宽度按 `1920×1080` / `1080×1920` 比例计算
- **缩放同步虚拟屏**：启用 `flex_display`，手动改窗口大小时 `RESIZE_DISPLAY` 同步 VD；DPI 按分辨率自动推算（`suggestDpi`）

## 1.13.2 - 2026-07-23

- **修复首帧超时**：WebSocket 代理在 `open` 前缓冲设备端 `scrcpy_initial`（此前在注册 message 监听前丢失，导致管线永不启动、仅见 START_APP 被丢弃）
- **交接 type 101**：prefetch → proxy 无缝切换；前端在 open 后短重试一次流参数

## 1.13.1 - 2026-07-23

- **修复推送错误的 scrcpy-server**：不再优先选用过期的 `linux/` jar；Windows 主机推送本机 `windows/` 构建，编包时同步写入三平台目录
- **jar 热更新**：磁盘 jar 哈希变化时强制重建设备端会话，避免复用旧进程导致双窗仍共用一屏
- **诊断日志**：`cast.start`/`adb.push` 输出 jar 路径/大小/mtime/sha；type 101 日志解析 `new_display`/`start_app`；服务端记录每路 `WsCastSession` 与 softReconfigure 决策

## 1.13.0 - 2026-07-23

- **多应用独立虚拟屏加固**：魔改 scrcpy-server 在 `start_app` 变化时强制重建采集；打断 type 101 ↔ `scrcpy_initial` 回环；编码器 stop 后 join，避免多窗口软重配合并到同一虚拟屏
- **默认虚拟屏分辨率**：按应用横/竖屏使用 `1920×1080` / `1080×1920`（固定 VD，窗口仅缩放预览）
- **默认窗口布局**：新窗口停靠在底部任务栏上方，默认尺寸小于桌面可用区域
- **API**：`GET /api/devices/:serial/apps/:pkg/orientation` 推断启动方向

## 1.12.0 - 2026-07-22

- **开始菜单秒开**：应用列表与图标写入浏览器 IndexedDB，指纹存 localStorage；首次/指纹变化才拉网，命中缓存即时展示
- **首次强制加载**：第一次进入多应用（无本地图标缓存）弹出 Icon Helper 进度窗并强制重提取/重拉列表，避免空菜单
- **空列表修复**：修复开始菜单 `serial` 双重 Ref 导致请求失败；应用管理不再等 Icon Helper 结束后才拉包名列表
- **预热写缓存**：进入多应用桌面并完成 Icon Helper 后预填浏览器缓存；同步时指纹一致则跳过图标下载
- **API**：`GET /launcher-apps` 返回 `fingerprint`；`icon-helper/ensure|extract?force=1` 支持强制重提取

## 1.11.0 - 2026-07-22

- **多应用每窗口虚拟屏修复**：禁止在仍有消费者时强制重建 scrcpy 会话（避免开第二个窗口时杀掉第一路虚拟屏）；每路 WebSocket 绑定独立 displayId；虚拟屏使用唯一名称
- **投屏稳定性**：web 多管线禁用互相抢占的 CleanUp；窗口在 `onMounted` 后再 `cast/start`，失败时正确释放 consumer；`cast/start` 响应带回本窗口的 `new_display`/`start_app` 参数
- **应用退出检测**：识别虚拟屏上的 Activity（`displayId>0` 等），减少误关窗

## 1.10.0 - 2026-07-22

- **Icon Helper**：首次授权/提取完成后进度弹窗不再出现；后台持续 sync 新应用图标，开始菜单直接显示缓存
- **多应用窗口**：实时检测应用是否仍有可见 Activity，退出后自动关闭对应窗口

## 1.9.0 - 2026-07-22

- **Icon Helper 加速**：ensure 成功后立即提取应用列表与图标；指纹一致时跳过重装/重提取，仅用主机缓存直接显示
- **变更检测**：设备端监听安装/卸载/更新并自动重提取；主机按 `manifest.json` 指纹同步，仅拉取缺失图标
- **多应用预热**：进入多应用桌面即后台预热 Icon Helper；开始菜单打开时优先走缓存，并定时 sync

## 1.8.0 - 2026-07-22

- **Web / 多应用窗口**：开始菜单启动应用后打开 Win11 风格窗口（标题栏返回/图标/名称，最小化/最大化/关闭，可拖动缩放）；任务栏显示已打开应用
- **每窗口独立虚拟屏**：每个窗口各自建立 scrcpy WebSocket，在独立虚拟显示上 `start_app`；缩放同步 `RESIZE_DISPLAY`；关闭窗口释放该路投屏，全部关闭后才停止设备端 scrcpy
- **后端**：`cast/start` 支持多消费者复用同一 scrcpy 会话；`cast/stop` 按引用计数释放；scrcpy-server 为每个 WebSocket 客户端创建独立投屏管线
- **虚拟屏失败处理**：创建虚拟显示时自动降级去掉 TRUSTED 等权限标志；仍失败则向前端推送 `cast_error`，多应用窗口弹出说明（Android 15 / 华为等缺 ADD_TRUSTED_DISPLAY），可关闭窗口、重试或切换镜像投屏

## 1.7.0 - 2026-07-22

- **Web / 应用图标服务**：开始菜单与应用管理首次询问是否安装极小 Icon Helper；拒绝两次后不再弹窗；设置 → 账号可改为「询问 / 始终允许 / 不安装」
- **Android**：新增 `backend/source/android` Icon Helper（`com.cloudphone.iconhelper`），提取名称/图标到 `Android/data`；预编译 APK 位于 `backend/bin/android/`
- **后端**：`/api/devices/:serial/icon-helper/{status,ensure,extract,progress}`；图标改为从 helper 拉取并缓存，拒绝安装时仅返回包名

## 1.6.0 - 2026-07-22

- **Web / 登录**：新增「记住密码」；启动与会话失效时自动尝试记住的密码；密码变更或验证失败则清除记忆并回到登录页
- **Web / 多应用开始菜单**：移除「已固定」标题与「返回镜像投屏设置」按钮（改密/退出多应用仍可通过顶栏模式切换）

## 1.5.0 - 2026-07-22

- **Web / 多应用开始菜单**：Win11 风格开始菜单，顶部搜索 + 自适应应用网格（图标/名称）；搜索结果为条状列表；应用来自设备 LAUNCHER 活动
- **后端**：新增 `GET /api/devices/:serial/launcher-apps`；应用图标缓存抽离为共享模块

## 1.4.0 - 2026-07-22

- **Web / 多应用快速设置**：WiFi+音量弹层对接设备实时状态（每秒刷新）；保留 Wi‑Fi / 蓝牙 / 飞行模式磁贴，显示开关与已连接 SSID/设备名；音量与亮度滑块可读写，不支持则置灰；图标统一 Iconify
- **后端**：新增 `GET/POST /api/devices/:serial/quick-settings`

## 1.3.1 - 2026-07-22

- **Web / 多应用通知**：打开时间日期弹层后每秒实时刷新设备通知（关闭即停止）；增强应用图标提取与缓存，轻量轮询避免重复拉 APK

## 1.3.0 - 2026-07-22

- **Web / 多应用投屏**：通知中心从设备同步通知（`dumpsys notification`），展示应用图标、标题与内容，支持手动刷新
- **后端**：新增 `GET /api/devices/:serial/notifications`，解析通知并缓存应用 APK 启动图标

## 1.2.1 - 2026-07-22

- **Web / 多应用投屏**：时间日期弹层对齐 Win11 通知中心样式（双圆角面板、农历大写如廿五）；去除弹层外框与通知区多余图标，日历去掉上下月切换按钮

## 1.2.0 - 2026-07-22

- **Web / 多应用投屏**：镜像投屏模式下拉新增「多应用投屏」；进入后隐藏左侧设置栏，右侧全宽展示 Windows 风格桌面画布
- **Web / Win11 任务栏（初版）**：开始菜单、WiFi+音量合并快速设置、时间/日期与日历通知中心；顶部可切换回镜像投屏

## 1.1.0 - 2026-07-22

- **Web / 添加设备**：安卓区新增「直接连接」，输入 IP + ADB 端口（如 ReDroid 5555）即可 `adb connect`
- **Web / 设备画廊**：设备数量多时画廊区域可纵向滚动，不再被裁切
- **后端 / 直接连接**：仅连接用户指定端口，不再扫描端口段，避免误连产生大量 offline 设备
- **Android 伴侣 App**：添加设备弹窗同步支持直接连接
- **CI**：每次 push 到 main 均构建并推送 Docker 镜像

## 1.0.3 - 2026-07-22

- **Web / 修复**：会话失效（401 / Valid session required）时自动跳转登录页，不再仅弹出 Toast
- API 层统一检测未授权响应并清除本地会话；抑制会话失效相关的重复错误提示

## 1.0.2 - 2026-07-22

- **Web / 手机端导航**：控制台改为底部 Tab 栏（设备 / 群控 / 日志 / 设置），移除侧滑菜单
- 手机端将退出登录移至设置 → 账户；主题切换保留在设置 → 外观（桌面端侧边栏不变）

## 1.0.1 - 2026-07-22

- **Web / 登录页**：密码已修改后不再显示「默认初始密码：admin」及「请输入当前密码并设置新的登录密码」提示

## 1.0.0 - 2026-07-22

- **Web / UI 1.0**：全站 Naive UI 外壳统一 — 共享 `UiButton`、`ShellSegmentTabs`、`PageHeader`、`HelpHint`、`PanelAlert`
- 登录/改密页重构：`NForm` + `NInput`，移动端友好布局；`AppShell` / `AppProviders` 拆分，修复 `useMessage` 无 Provider 白屏
- 设置页统一：segment tabs + `NSelect` / `NInputNumber` / `NTag`；日志页 segment 筛选与 `NInput` 搜索
- 群控、添加设备等弹窗按钮统一为 `UiButton`；全局 Toast 反馈（`useAppFeedback`）
- Naive 主题扩展：Form、Input、Tabs、Tag 与 Cloud Phone CSS 变量对齐

## 0.16.0 - 2026-07-22

- **Web / 操作日志**：左侧 Tab 新增「日志」页，按 Debug / Info / Warn / Error 分级，按认证、导航、设备、投屏、串流、设置、界面分类；支持搜索、筛选与展开详情
- 全站埋点：登录/退出、Tab 切换、打开/关闭设备工作区、开始/停止投屏、参数修改、串流启动日志、工具栏操作、弹窗与全屏等
- 串流日志桥接：scrcpy / 鸿蒙 JPEG / iOS MJPEG 启动日志同步写入全局事件日志
- **iOS 修复**：`runner.js` 补导出 `getWdaPipelineJob`、`serializeWdaPipelineJob`，修复 WDA 流水线状态 API 启动报错

## 0.15.3 - 2026-07-08

- **Docker**：修复 arm64 构建时 `sslpsk-pmd3` 编译失败，pip 安装阶段临时加入 `gcc`/`python3-dev`/`libssl-dev` 等构建依赖

## 0.15.2 - 2026-07-08

- **iOS 签名**：IPA 重签名改用 npm `@lbr77/zsign-wasm-resigner-wrapper`（Node WASM），无需手动放置 `zsign.exe`
- **Docker**：后端镜像内置 Python 3、`pymobiledevice3`、OpenSSL，支持容器内 iOS WDA USB 流水线

## 0.15.1 - 2026-07-07

- **iOS / Windows USB 流水线**：`backend/bin/wda/wda.ipa` + Apple ID 签名（zsign）+ pymobiledevice3 安装；六步向导（准备 → 登录 → 签名 → 安装 → 搜索设备 → 连接）；支持跳过已安装 WDA
- 新增 API：`GET /api/devices/ios/wda/prepare`、`POST /api/devices/ios/wda/pipeline`、`GET /api/devices/ios/wda/pipeline/:jobId`
- 前端：`AddDeviceApplePanel` 重写为向导进度条，含环境检查、错误日志与「WDA 已安装，直接连接」

## 0.15.0 - 2026-07-07

- **iOS / WDA 初版**：添加设备支持局域网 mDNS 扫描（`_cloudphone-wda._tcp`）与手动 IP 连接；`ios-cast` MJPEG 投屏 + 触控/导航键；Mac 桥接脚本 `tools/ios-wda-bridge.mjs`
- 新增 API：`GET /api/devices/ios/discover`、`POST /api/devices/ios/connect`、`DELETE /api/devices/ios/:serial`；设备列表合并已注册 iOS 端点
- 前端：`AddDeviceApplePanel`、`useIosCast`；画廊截图与投屏工作区适配 `platform: ios`

## 0.14.5 - 2026-07-06

- 补充 Windows 版 HDC 依赖 `backend/bin/hdc/windows/libusb_shared.dll`，修复 USB 连接鸿蒙设备时 `hdc.exe` 缺少 libusb 无法启动

## 0.14.4 - 2026-07-06

- 收录 [WebDriverAgent](https://github.com/appium/WebDriverAgent) 至 `backend/source/WebDriverAgent`，为后续 iOS 设备控制与投屏集成做准备（当前尚未接入 UI）

## 0.14.3 - 2026-06-27

- 修复鸿蒙投屏触控坐标未随画面缩放：ECHO fit rect + 归一化映射至原生分辨率
- 修复横屏/预览旋转后点击偏移：对齐画布方向交换宽高；支持 rotator 预览旋转

## 0.14.2 - 2026-06-27

- 鸿蒙投屏触控对齐 ECHO/hdckit：`Gestures.touchDown` / `touchMove` / `touchUp` 实时拖动；`pointermove` 边滑边反馈到设备

## 0.14.1 - 2026-06-27

- 鸿蒙投屏默认按设备原生分辨率采集（scale=1）；`cast/start` 返回设备 displaySize
- 修复投屏画面被 CSS 拉伸变扁：画布等比缩放（contain）；触控坐标适配留白

## 0.14.0 - 2026-06-27

- 鸿蒙投屏：`cast/start` 仅 fport，WebSocket 接入后再启动 JPEG 管道（对齐 scrcpy 流程）
- 修复鸿蒙投屏误报「无法连接后端 API」：`isCastRecordingSupported` 类型不一致导致 TypeError
- 优化 WebSocket 升级代理与 API 错误提示；鸿蒙 WS 失败提示 Docker 版本要求

## 0.13.11 - 2026-06-27

- Docker Compose 默认挂载 `docker-cloud-phone/data` 到后端 `/data`，持久化 `auth.key` 与 `cloud-phone.db`

## 0.13.10 - 2026-06-27

- 修复 Docker 后端启动失败：`app.js` 中 `api-crypto.js` 导入路径错误

## 0.13.9 - 2026-06-27

- 修复 Docker 生产前端投屏卡在「WebSocket 视频管道就绪」：生产 `server.mjs` 增加 `/api/*` WebSocket 代理；`cast/start` 预启动 scrcpy-server shell

## 0.13.8 - 2026-06-27

- 修复无线配对失败只显示 `Request failed.` / `未执行连接扫描`：展示 ADB 真实输出与连接尝试详情

## 0.13.7 - 2026-06-27

- 修复首次改密报 `INVALID_PASSWORD`：清除残留会话加密密钥，首次改密使用明文请求；后端拒绝无会话的加密改密请求

## 0.13.6 - 2026-06-27

- Docker Linux 默认 **host 网络**：前后端共享宿主机网卡，支持 ADB 局域网与 mDNS；Mac/Windows 可叠加 `docker-compose.bridge.yml`
- 新增 `GET /api/host/networks` 与设备列表/health 中的 `network` 字段，枚举宿主机全部网卡
- Docker 后端镜像预装 `android-tools-adb`（apt）；bundled adb 自动 `chmod +x`；`CLOUD_PHONE_PREFER_SYSTEM_ADB` 优先系统 adb

## 0.13.5 - 2026-06-27

- Docker/生产前端默认启用 HTTPS（自签名证书），修复局域网 `https://<IP>:5173` 的 `ERR_SSL_PROTOCOL_ERROR`
- 支持 `FRONTEND_HTTPS`、`FRONTEND_TLS_SAN` 环境变量；登录所需 Web Crypto 在局域网 HTTPS 下可用

## 0.13.4 - 2026-06-27

- 修复 Docker 部署前端无法代理 API：Compose 前端容器通过 `BACKEND_ORIGIN=http://backend:3000` 访问后端，不再误连 `127.0.0.1`
- `env-loader.js` 支持 `BACKEND_ORIGIN` 环境变量；局域网访问 `http://<主机IP>:5173` 可正常登录

## 0.13.3 - 2026-06-27

- Docker 后端镜像升级 Node 22，恢复内置 `node:sqlite`，移除 `better-sqlite3` 及编译依赖，显著加快多架构构建
- 安装脚本最低 Node 版本要求调整为 22

## 0.13.2 - 2026-06-27

- 修复 Docker 后端启动失败：`node:sqlite` 仅 Node 22+ 可用，改用 `better-sqlite3` 兼容 Node 20 镜像
- 后端 Dockerfile 增加原生模块编译依赖（python3、make、g++），保障多架构构建

## 0.13.1 - 2026-06-06

- Docker Hub image tags use project semver from `package.json` (e.g. `yiyifred/cloud-phone-backend:0.13.1`); CI and `build-multiarch.sh` no longer tag with git SHA
- `IMAGE_TAG` in `.env.example` aligned with app version for compose pulls

## 0.13.0 - 2026-06-06

- Docker multi-arch image builds: `linux/amd64` + `linux/arm64` in GitHub Actions (`docker/build-push-action` platforms + QEMU/buildx)
- Add `docker-cloud-phone/build-multiarch.sh` for local multi-arch push; `DOCKER_PLATFORMS` in `.env.example`
- Docker Hub tags: `:<version>` from `package.json` (e.g. `0.13.0`) plus `:latest`

## 0.12.41 - 2026-06-06

- Default `DOCKERHUB_NAMESPACE` to `yiyifred` in compose files and `.env.example` (fixed project Docker Hub namespace)

## 0.12.40 - 2026-06-06

- Fix Docker Compose env: default `BACKEND_PORT`/`FRONTEND_PORT` in compose files; add `compose.sh` and `docker-cloud-phone/.env.example` for `--env-file ../.env` / symlink workflow
- Document root `.env` vs `docker-cloud-phone/` compose variable substitution in README

## 0.12.39 - 2026-06-06

- Docker 配置迁至 `docker-cloud-phone/`：`docker-compose.yml`（Docker Hub 拉取）与 `docker-compose.build.yml`（本地构建）

## 0.12.38 - 2026-06-06

- 新增 Docker 部署：`docker-compose.yml`、前后端 Dockerfile，端口读取 `.env` 中 `BACKEND_PORT` / `FRONTEND_PORT`
- 新增 GitHub Actions：提交信息含 `docker` 时自动构建并推送 Docker Hub 镜像

## 0.12.37 - 2026-06-06

- scrcpy 上游同步工具：`compare-scrcpy-upstream.mjs`、`sync-scrcpy-from-upstream.mjs`（跨平台，保留 ws/ 魔改清单）；`sync-scrcpy-source.mjs` 转发新脚本
- 确认 `projects/scrcpy` v4.0 与 `backend/source/scrcpy` 官方基线已对齐

## 0.12.36 - 2026-06-06

- 修复 Termux 等环境 scrcpy-server 文件存在仍报未找到：多路径探测（linux 优先、`.jar` 后缀、`CLOUD_PHONE_ROOT` / `cwd` 向上查找）
- `/health` 与投屏失败响应返回 `scrcpyServer` 诊断信息

## 0.12.35 - 2026-06-06

- Termux 跳过 scrcpy-server 自动 Gradle 编译；缺失时提示 git pull 同步仓库内预编译 jar

## 0.12.34 - 2026-06-06

- 入库预编译魔改 `scrcpy-server`（windows / linux / macos），Termux 等环境无需本机 Gradle 编译
- 入库 Windows 版 `scrcpy.exe`；Android App 投屏启动遮罩与连接日志 overlay

## 0.12.33 - 2026-06-06

- 移除添加设备弹窗中多余的 Android (Termux) 连接向导；Termux 仍作为 Linux 宿主通过安装脚本支持

## 0.12.32 - 2026-06-06

- 新增 **Android (Termux)** 宿主支持：后端识别 `TERMUX_VERSION`，按 Linux 运行；adb/hdc 路径自动探测
- 安装脚本 `scripts/install-termux.sh`（`pkg` 安装 nodejs-lts、android-tools）；`install.sh` 在 Termux 自动分流
- `/health` 与 `/api/devices` 返回 `host` 运行时信息

## 0.12.31 - 2026-06-11

- 鸿蒙投屏对齐 ECHO/hdckit：`cast/start` 即建立 RPC + JPEG 管道，WebSocket 仅订阅帧流；会话级单例 capture 广播
- uitest 帧协议（`_uitestkit_rpc_message_head_`）与 x86_64 agent ABI 检测；`startCaptureScreen` 仅传 scale
- Web 端修复：API/WS 同源代理、鸿蒙 WS 失败不杀后端会话、`useDeviceCast` 路由与画布就绪；WS 鉴权拒绝日志

## 0.12.30 - 2026-06-11

- 修复鸿蒙 uitest agent 路径：同时识别 `v1.1.0` / `v1.1.10` / `agent.so` 及目录内匹配文件
- 鸿蒙投屏参数收敛为 `scale` + `quality`（不再传递 scrcpy 码率/帧率/编码器）；`startCaptureScreen` 传入缩放与 JPEG 质量
- 工作区鸿蒙设备显示专用设置面板；群控自动换算画质；修复 HarmonyCastSettings 导入路径

## 0.12.29 - 2026-06-06

- 新增鸿蒙（HarmonyOS）设备支持：HDC 发现、`hdc list targets` 合并进设备画廊
- 鸿蒙投屏：uitest agent + `Captures.startCaptureScreen` JPEG 流，WebSocket 推帧；触控经 Hypium RPC
- 添加设备弹窗开放鸿蒙 USB/HDC 连接引导；工作区与群控按 `platform` 自动切换 scrcpy / 鸿蒙播放器
- 归类 DevEco Hypium 6.1.0.210 API 文档至 `backend/vendor/deveco-hypium/`

## 0.12.28 - 2026-06-06

- 修复多设备截图时 ADB 失败触发 `unhandledRejection`；规范化离线/连接关闭等错误，瞬态失败返回 503
- 后端截图并发限制（最多 4 路），减轻多设备无线 ADB 压力
- 修复群控/多路投屏停止后 WebSocket 代理仍重试本地端口（`ECONNREFUSED`）；启动前 TCP 探测确认转发端口就绪
- 投屏停止或 scrcpy-server 退出时立即中止代理连接并关闭客户端

## 0.12.27 - 2026-06-11

- 修复 Web 设备页设备较多时卡片信息被裁切、无法滚动查看的问题（画廊区域内部滚动）
- 设备截图改为可见区域懒加载并限制并发（最多 4 路），多设备时页面更流畅；设备信息随列表刷新实时更新

## 0.12.26 - 2026-06-11

- Web 群控：选中设备后左上角显示批量操作栏（电源亮屏/息屏、音量静音/加减、批量应用安装/卸载、主从批量控制）
- 批量应用：安装 APK 或按包名卸载，未安装设备自动跳过，完成后弹窗汇总每台结果
- 批量控制：选择主控设备（黄色），其余已选设备（绿色）实时同步主控触控与按键；坐标按分辨率缩放中继

## 0.12.25 - 2026-06-10

- Web 群控：恢复 **+** 设备选择弹窗（预览图、多选、全选），与页面内就地控制并存
- 弹窗管理「已添加设备」列表；页面内点击投屏区域外切换「控制选中」，投屏区域内直接触控，无需跳转工作区
- 默认将全部在线设备加入群控并选中；新上线设备自动加入；列表与选中状态分别持久化到 localStorage

## 0.12.24 - 2026-06-06

- 修复群控投屏偶发卡在「视频管道就绪」不出画面：等待首帧后才完成启动，30 秒无首帧超时重试
- 群控限制并发 cast/start（最多 2 路），避免重复启动打断会话；收到 scrcpy_initial 后重发流参数
- 后端延长 scrcpy-server shell 就绪等待，增加设备 WebSocket 连接重试

## 0.12.23 - 2026-06-06

- Web 群控投屏：恢复 1080p / 30fps / 4Mbps，多设备并行启动（取消错开延迟）
- 每台投屏卡片启动阶段显示 scrcpy 连接日志；卡片尺寸加大以提升观感

## 0.12.22 - 2026-06-06

- Web 群控页：选中设备后自动多路实时投屏（720p / 20fps / 2Mbps），错开启动减轻卡顿
- 投屏卡片支持触控；分辨率按设备能力降级；启动失败自动尝试更低清晰度

## 0.12.21 - 2026-06-06

- Web 群控页：右上角添加设备，弹窗选择在线设备（支持全选），展示设备名称与截图预览
- 已选设备网格展示，可单独移除；选择列表持久化到浏览器 localStorage

## 0.12.20 - 2026-06-06

- Web 左侧导航新增 **群控** Tab（位于设备与设置之间），含占位页面与五语言文案

## 0.12.19 - 2026-06-02

- 后端 ADB 锁改为按设备（serial）分组：多设备可同时截图、投屏、文件/应用操作；同一设备仍串行，避免 ADB 冲突
- 多用户连接同一设备时 WebSocket 并发，ADB 类操作按设备排队；无线配对/连接按 host 分组

## 0.12.18 - 2026-05-30

- Web / Android 设备画廊：右键（Web）/ 长按（Android）设备卡片，可查看设备详细信息或断开无线 ADB 设备
- 后端：`DELETE /api/devices/:serial` 执行 `adb disconnect`；USB 连接设备返回 400 不可断开；断开前自动停止投屏会话
- 设备列表新增 `wireless` 字段标识无线连接

## 0.12.17 - 2026-05-31

- Web / Android 设置页 UI 美化：Hero 头部、分区图标、账号 stat chip、卡片式设置行
- Web 主题色统一为绿色（`--accent` / `--primary` 对齐 `#16a34a`），设置页移除蓝/紫 fallback

## 0.12.16 - 2026-05-30

- Web 设备工作区：非全屏时工具栏固定于页面顶部、设备名称下方横向排列；全屏仍使用悬浮工具栏
- Android 设备工作区：投屏工具栏移至设备名下方全宽横条，投屏时显示；全屏模式保持底部悬浮

## 0.12.15 - 2026-05-30

- 投屏启动日志：后端 `cast/start` 与 `cast/status` 返回 `startupLogs`（adb push scrcpy-server、forward、shell、WebSocket 管道等）
- Web / Android：点击「开始投屏」后在右侧投屏画布显示连接日志；首帧渲染后自动隐藏（全屏与否均在同一块画布）
- Android 设备工作区：左设置 / 右画布内联投屏，全屏按钮可携带已有会话进入全屏，避免重复 `cast/start`

## 0.12.14 - 2026-05-29

- Android 全屏投屏：工具箱底部常驻并支持折叠/展开；画布 letterbox 对齐 Web（长边贴长边，尽量减少黑边）
- Android 全屏投屏：修复旋转/横竖屏切换后的触摸坐标映射（按 TextureView 实际显示区域与变换反算）
- Android 解码：读取 MediaCodec 输出的 crop 信息，使用实际视频帧尺寸更新触控/布局

## 0.12.13 - 2026-05-29

- Android 设置页与 Web 对齐：账号（密码状态、会话到期、改密、退出）、外观（语言/深浅色主题）、刷新间隔（1–120 秒）、更换服务器
- Android 设备画廊轮询读取设置中的刷新间隔；Material3 DayNight 与夜间配色
- README 中英文：新增 Android 客户端专章与 Web/Android 能力对照表

## 0.12.12 - 2026-05-29

- Android 全屏投屏：投屏参数与 Web/桌面端对齐（虚拟屏预设、`__main__`/`__custom__`、`start_app`、`audioDup` SDK 33+、摄像头音频缓冲等）；摄像头模式工具栏支持手电筒与变焦；Material 风格 UI 与进入/淡出、工具栏自动隐藏、直播点脉冲等动画
- Android 设备列表：修复异步刷新在 Fragment 已销毁时更新 UI 导致的崩溃

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