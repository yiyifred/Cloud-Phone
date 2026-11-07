# Cloud Phone 安全与体验加固方案

| 项 | 内容 |
|---|---|
| 文档版本 | 1.0 |
| 审计基线 | Cloud Phone v1.22.5（git 6b95ed8） |
| 覆盖范围 | backend/node/src、frontend/web、frontend/android、docker-cloud-phone、tools、scripts |
| 审计方式 | 全仓静态阅读 + 关键词取证 + 前端对比度实算 + 三路并行审计交叉回查 |
| 结论 | 功能密度已达中型产品，安全与视觉系统是两块结构性断层 |
| 后续维护 | 每个 Phase 完成后回填「状态」列，并把验收证据写入 CHANGELOG |

## 0. 阅读指引

- 只想看要做什么：看第 7 章「路线图与 WBS」。
- 想知道为什么：看第 2 章信任边界 + 第 3/4 章登记表。
- 动手改代码：看对应编号的「修复卡」（方案 + 验收 + 涉及文件）。
- 验收：第 10 章逐条勾选。

## 1. 结论摘要

1. **安全**：6 条 P0 可串成一条完整攻击链 —— 局域网 → 默认口令 admin（无限试）→ 明文 3000 端口嗅探 150 天会话 → 或者直接读 0666 的 auth.key 伪造会话 → 拿到即等于所有已连接手机的 root（终端 adb shell、文件根 /、装包卸载）。
2. **加密叙事不成立**：应用层 AES-GCM 使用硬编码共享密钥「cloud-phone」，抓包即可解密登录口令；它只能算混淆，不能算控制。真正的修复是 TLS + 默认回环监听，而不是换一个常量。
3. **界面**：不是「审美不行」，而是三处**功能级缺陷**（未定义的 --radius-sm 导致 11 处方角、canvas 被内联 100%/100% 强制拉伸导致画面变形与触摸偏移、表单焦点环被 outline:none 删除）；再叠加「没有尺度 token」（26 种字号 / 22 种圆角 / 1 个阴影）与「深色模式只有变量覆盖」。
4. **对标**：投屏底座落后上游 3 个版本；H.265 是假支持；群控缺任务化；无多用户/预约/审计 actor/性能采集/logcat/可观测性。差异化资产是三平台同构（Android + 鸿蒙 + iOS）、设备端 WebSocket 多客户端、多应用虚屏桌面、Termux 宿主。
5. **建议节奏**：v1.23 只做「安全底座 + 投屏真实性 + 视觉 token」，v1.24 做「批量运维 + 可观测」，v2.0 做「多用户设备农场」。

## 2. 系统架构与信任边界

### 2.1 组件

| 组件 | 入口 | 职责 | 信任级别 |
|---|---|---|---|
| Web 前端（Vite 构建产物 + server.mjs 静态服务/反代） | 5173（默认 HTTPS 自签） | 页面、投屏解码、/api 反代、WS 反代 | 半可信（浏览器） |
| Node 后端 | 3000（默认 0.0.0.0，无 TLS） | 认证、ADB/HDC 调度、cast 会话、持久化 | 可信 |
| ADB / HDC 子进程 | backend/bin/* | 设备通道 | 高权限（等同设备 root） |
| SQLite（cloud-phone.db） | backend/node/data（0777/0666 实测） | 口令记录、会话、偏好、日志 | 极敏感 |
| auth.key | backend/node/data（0666 实测） | 会话 HMAC 派生、库内字段加密 | 极敏感 |
| Android 伴侣 App | 局域网 | 设备列表/全屏投屏 | 半可信 |

### 2.2 信任边界

    [浏览器] --HTTPS(自签)--> [5173 前端/反代] --HTTP--> [3000 后端] --> [adb/hdc] --> [手机]
         \                                                      |
          \--(LAN 直连 3000，无 TLS，可绕过 5173)---> [3000] ----+--> [SQLite + auth.key]

结论：
- 边界只有一层（前端），后端端口默认对所有网卡开放且无 TLS，因此「前端 HTTPS」不构成有效边界。
- 持有 auth.key 或数据库写权限的本地进程，等价于管理员。
- 任何通过认证的会话，在设备侧等价于 root。

### 2.3 资产与威胁

| 资产 | 泄露/篡改后果 | 主要威胁 |
|---|---|---|
| 管理员口令 | 全设备接管 | 暴力破解（无限速）、明文嗅探、localStorage 明文 |
| 会话 token | 全设备接管（150 天） | 明文嗅探、auth.key 泄露伪造、CSWSH |
| 设备内容（短信/相册/应用数据） | 隐私泄露 | 无角色、无审计、终端无限制 |
| 设备凭据（iOS Apple ID） | 账号被盗 | 明文 HTTP 传输 Apple 凭据 |
| 宿主（Node 进程） | 宿主机沦陷 | 无 body 上限 OOM、无并发上限、上传临时文件 |

## 3. 安全缺陷登记表

等级定义：P0 = 可直接接管或可远程打挂；P1 = 结构性缺陷或可被上下游放大；P2 = 加固项。

### 3.1 登记表

| 编号 | 等级 | CWE | 位置（证据） | 触发路径 | 影响 |
|---|---|---|---|---|---|
| S-01 | P0 | CWE-1393 / 307 | backend/node/src/config/auth.js:5；services/auth-service.js:41-74 | 直接提交口令；无失败计数、无退避、无锁定、无全局限速 | 默认部署零成本登录；6 位下限 + scrypt 百毫秒也挡不住持续猜测 |
| S-02 | P0 | CWE-732 | services/auth-store.js:11（mkdirSync 无 mode）、:131-139（writeFileSync 无 mode）；实测 ls -la backend/node/data：目录 0777、auth.key 0666、cloud-phone.db 0666 | 读 auth.key → sha256("cloud-phone-session"+key) → 伪造任意会话；或直接 INSERT auth_sessions | 本地任意用户/容器内进程可无口令接管 |
| S-03 | P0 | CWE-321 | utils/protected-http.js:9-14（LOGIN_WIRE_SECRET="cloud-phone"）；utils/api-crypto.js:5-7（固定 PBKDF2 盐）；frontend/web/src/utils/api-crypto.js 同常量 | 抓包 → PBKDF2("cloud-phone","cloud-phone:login-request-wire-v1") → 解出明文口令 | 登录口令等价明文传输；「应用层加密」不成立 |
| S-04 | P0 | CWE-319 / 614 | tools/env-loader.js:8（DEFAULT_HOST=0.0.0.0）；backend/node/src/index.js:22；services/auth-service.js:139-147（Cookie 无 Secure，SameSite=Lax，150 天） | 直连 http://<LAN_IP>:3000 绕过 5173 的 HTTPS，嗅探 Cookie | 一次嗅探 = 半年全权会话 |
| S-05 | P0 | CWE-770 | utils/http.js:30-43（readJsonBody 无上限、无 Content-Length 校验）；index.js 未设 requestTimeout/headersTimeout | 未认证发送超大 body 或慢速上传 | Node 堆 OOM / 连接耗尽 |
| S-06 | P0 | CWE-269 | services/device-terminal/spawn-shell.js:9-17（adb shell -tt）；services/device-file-path.js:2（DEVICE_FS_ROOT="/"）；routes/device-apps-routes.js:40-58 | 任意已登录会话 | 无角色、无二次确认、无 actor 审计，口令泄露即全设备 root |
| S-07 | P1 | CWE-1385 / 400 | middleware/ws-auth.js:5-10（仅校验 Cookie）；ws/device-websocket-server.js:16-43（无 Origin、无 maxPayload、无并发上限） | 任意站点向 ws://host:3000/api/devices/X/terminal/ws 发起连接 | CSWSH；无限终端进程拖垮宿主 |
| S-08 | P1 | CWE-942 | utils/http.js:59-85（isAllowedOrigin 按端口放行任意 host + Allow-Credentials:true） | 同站不同端口页面读 API | 同源模型失效 |
| S-09 | P1 | CWE-306 | routes/local-persistence-routes.js:33-57（POST /api/public/preferences 未鉴权）；middleware/api-auth.js:9 | 任意请求改写全局 theme/locale | 公开可写状态 |
| S-10 | P1 | CWE-770 / 400 | routes/device-files-routes.js:46-93；services/device-files-transfer.js:51-52（pull 后整体 readFile + base64） | 拉取大文件 / 上传无上限 | 已认证 OOM、tmp 磁盘打爆 |
| S-11 | P1 | CWE-78（设备侧） | services/device-apps-mutate.js:13-15（pm path + packageName 直传）；routes/device-apps-routes.js:106,139 | packageName="com.x; reboot" | 绕过 UI 语义执行设备命令；审计不可区分 |
| S-12 | P1 | CWE-256 / 522 | frontend/web/src/utils/remembered-password.js:26-27（localStorage 明文口令） | 本机进程 / 备份 / 未来 XSS | 口令长期驻留浏览器 |
| S-13 | P1 | CWE-319 / 312 | frontend/android/app/src/main/AndroidManifest.xml:10-11（usesCleartextTraffic、allowBackup） | 局域网嗅探；adb backup | 凭据/会话外流 |
| S-14 | P1 | CWE-250 | docker-cloud-phone/docker/backend.Dockerfile（无 USER）；docker-compose.yml:12（network_mode: host） | 容器内进程即 root，3000 直通 LAN | 逃逸代价低，TLS 只在前端一层 |
| S-15 | P1 | CWE-693 | frontend/web/server.mjs:93-97（仅 Content-Type，无安全头）；tls-self-signed.mjs:10-23（每次启动重生成证书） | 点击劫持；无法固定信任 | 无 CSP 兜底，HTTPS 无法防 MITM |
| S-16 | P1 | CWE-770 / 778 | services/local-persistence-logs.js:9-22（无 actor 列）、:83-96（details 无长度上限）；MAX_LOG_ENTRIES=5000 按行裁 | 单条巨型 details | 审计无法归因；单条可撑大库 |
| S-17 | P1 | CWE-248 | utils/cookies.js:13（decodeURIComponent 无 try/catch）；app.js:42-49 | Cookie 里塞 %E0%A4%A | 异常在 async handler 首行抛出，连接挂起 + 刷日志 |
| S-18 | P1 | CWE-1104 | .gitignore:40（package-lock.json 被忽略）；docker-cloud-phone/docker/backend.Dockerfile:16（npm ci） | 干净克隆后构建 | 构建失败、依赖不可复现 |
| S-19 | P2 | CWE-208 | services/auth-service.js:211（token 比较非恒时） | 远程时序 | 实际难利用，改 timingSafeEqual 即可 |
| S-20 | P2 | CWE-22（低） | frontend/web/server.mjs:80（startsWith 前缀判断） | 兄弟目录 dist-xxx | 当前 URL 解析已归一化，属防御写法问题 |
| S-21 | P2 | CWE-200 | routes/auth-routes.js:23-41（未认证返回 passwordConfigured/passwordUpdatedAt） | 直接 GET | 泄露是否仍为默认口令 |
| S-22 | P2 | CWE-426 | services/adb-path.js:88-101（从 PATH 解析 adb） | 注入 PATH | 特权运行时等于命令执行 |
| S-23 | P2 | CWE-377 | routes/device-apps-routes.js:42（可预测临时文件名 0644） | 多用户宿主 | 符号链接/预占 |
| S-24 | P2 | CWE-778 | 全仓仅 services/device-screenshot-queue.js 有 4 并发限制 | 批量并发 | 单会话可打满 adb/cast |

### 3.2 修复卡（Phase 1 范围内 12 项）

S-01 登录限速
- 方案：新增 services/login-throttle.js。两桶：按 IP（默认 5 次/5 分钟，命中后 15 分钟锁定、指数退避 15m→30m→60m）、按全局（20 次/10 分钟）。返回 retryAfterSeconds。auth-routes.js 在调用 loginWithPassword 前查桶，失败/成功都记账；成功清零该 IP。限速状态只存内存（重启即清，可接受）。
- 涉及：backend/node/src/services/login-throttle.js（新）、routes/auth-routes.js、config/auth.js（阈值常量）。
- 验收：连续 6 次错口令返回 429 且带 Retry-After；正确口令在锁定窗口内也拒绝；重启后恢复。

S-02 数据目录与密钥权限
- 方案：auth-store.js 的 mkdirSync 加 mode 0o700；auth.key 与 db 创建/打开后 chmod 0o600（含已存在文件，启动时纠正）。config/paths.js 保持不变。
- 验收：删除 backend/node/data 后启动，stat 显示 drwx------ / -rw-------；已存在 0666 文件被纠正。

S-03 加密叙事纠正（不换常量）
- 方案：本轮不做协议改造。① 在 protected-http.js 常量处写明「仅为混淆，安全性由 TLS 提供」；② 默认监听改回环（S-04）；③ 所有 LAN 部署文档与 .env.example 强制 HTTPS；④ 把「真正修复（ECDH 或强制 TLS）」列为 Phase 3 任务，不再对外宣称 AES-GCM 等于传输安全。
- 验收：代码注释 + README 安全章节措辞一致；.env.example 默认 HOST=127.0.0.1 并注明 LAN 需显式开启 + HTTPS。

S-04 监听与 Cookie
- 方案：env-loader.js DEFAULT_HOST 改 127.0.0.1；新增 AUTH_SESSION_DAYS（默认 30）；Cookie 在检测到 https（req.socket.encrypted 或 x-forwarded-proto=https）时追加 Secure；SameSite 保持 Lax，Path=/；前端反代补 x-forwarded-proto。
- 涉及：tools/env-loader.js、config/auth.js、services/auth-service.js（getSessionCookie 接收 req 上下文）、routes/auth-routes.js、frontend/web/server.mjs（proxyToBackend 追加头）。
- 验收：默认启动 http://127.0.0.1:3000 本地可登录；通过 5173 HTTPS 访问时响应 Set-Cookie 含 Secure；Cookie TTL 30 天。

S-05 请求体与超时
- 方案：http.js 加 MAX_JSON_BODY_BYTES（默认 8 MiB，可用 MAX_JSON_BODY_BYTES 覆盖），超限 413 并 drain；Content-Length 与累计字节双校验；index.js 设置 server.requestTimeout=120000、headersTimeout=30000、keepAliveTimeout=5000。上传类接口（APK/文件）单独上限 512 MiB 由路由自行判断。
- 验收：14 MiB body 返回 413 且连接可继续；慢速上传 30s 被断开。

S-06 权限收敛（Phase 1 只做最小面）
- 方案：终端/安装/删除类接口在 settings 中增加开关（默认开启，保持现有体验），但所有破坏性操作写入审计日志（含 actor 占位，见 S-16）；真正的角色模型进 Phase 3。
- 验收：执行 force-stop/卸载/删除文件后日志出现 category=audit 记录。

S-07 WS 加固
- 方案：ws-auth.js 增加 Origin 白名单（同 utils/http.js 的 allowed set，允许无 Origin 的 CLI 客户端通过配置 CORS_ALLOW_ORIGINS="*" 放行）；WebSocketServer 加 maxPayload（默认 4 MiB）；每会话终端连接上限 4、全局 32，超限 1008 关闭。
- 验收：带 Origin: https://evil.example 的握手返回 401/403；超过上限新连接被拒。

S-08 CORS
- 方案：删除「端口相同即放行」启发式；只允许显式 origin 白名单（frontendOrigin、localhost/127.0.0.1/::1 + FRONTEND_PORT、CORS_ALLOW_ORIGINS）。
- 验收：Origin: http://192.168.1.50:5173 且未配置时不返回 ACAO。

S-09 偏好写入
- 方案：GET 保持公开（登录页主题需要）；POST 改为需会话。前端登录页主题继续用 localStorage（index.html 已有内联脚本）。
- 验收：未登录 POST 返回 401；登录后正常。

S-16 日志
- 方案：message ≤ 4 KiB、details ≤ 16 KiB（超长截断并记 truncated 标记）；新增 actor 列（默认 "local"，后续接角色）；保留按行裁剪。
- 验收：单条超长日志被截断；列表返回 actor 字段。

S-17 Cookie 解析
- 方案：decodeURIComponent 包 try/catch，失败置空串。
- 验收：Cookie: a=%E0%A4%A 请求返回 200/401 而非挂起。

S-18 依赖锁定
- 方案：.gitignore 移除 package-lock.json；保留根目录 lockfile 入库（需用户确认提交）。
- 验收：干净克隆后可 npm ci。

## 4. 界面/交互缺陷登记表

### 4.1 视觉

| 编号 | 等级 | 位置 | 现状 | 影响 |
|---|---|---|---|---|
| U-01 | P0 | frontend/web/src/utils/ws-scrcpy-annexb-player.js:41-45 | canvas 内联 width/height=100% 且 objectFit="contain"（canvas 不支持 object-fit） | 画面按 pane 比例拉伸；canvas-rotation.js 按 letterbox 裁触摸 → 点击偏移可达画面宽 30% |
| U-02 | P0 | assets/add-device-modal.css:114,142,357,366,407,426,439,705,727；assets/group-control.css:517,669 | --radius-sm 全仓未定义（11 处 var 使用） | 元素渲染成直角贴在圆角父容器内 |
| U-03 | P0 | assets/main.css:19-25；utils/naive-theme.js:4-13 | 主按钮文字 3.15:1；naive 主按钮 2.28:1；侧栏激活 2.89:1（实算） | 两处绿并存 + 文字发虚，浅色下不可读 |
| U-04 | P0 | assets/main.css:1601,1840（outline:none）；全仓 focus-within 0 命中 | 表单焦点环被删除且无替代 | 键盘用户 Tab 登录表单无任何视觉反馈 |
| U-05 | P0 | components/AppShell.vue:213-218；components/DevicesPanel.vue:171-174；全仓 skeleton 0 命中 | 无骨架屏；空态两行字无入口 | 首屏空白→突现，新用户不知点哪里 |
| U-06 | P0 | assets/main.css:551-559（grid minmax 260px）、:592-596（预览 9/16） | 设备少时右侧大片空白；平板截图被裁成竖屏 | 画廊「丑」的第一观感 |
| U-07 | P1 | assets/main.css:1-70 | 26 种 font-size、22 种 border-radius、1 个 shadow、1 个 blur；12 个字号挤在 11.5–15.2px | 没有层级节奏 |
| U-08 | P1 | assets/main.css:579,896；assets/windows-desktop.css（80 处 hex） | 深色仅 token 覆盖，0 条组件级深色规则 | 深色下阴影不可见、多应用桌面仍亮白 |
| U-09 | P1 | assets/main.css:1216,1285 | 浅灰舞台 + 纯黑画面 | 「黑屏贴灰纸」，与 escrcpy 深色舞台相反 |
| U-10 | P1 | assets/main.css:1888,1520；ui/UiButton.vue:33 | 三种主按钮形态、三种圆角 | 主操作长相不一 |
| U-11 | P1 | frontend/web/index.html:15-20 | 字体依赖 fonts.googleapis.com | 内网/离线回退 Segoe UI，标题气质丢失、首屏卡字体 |
| U-12 | P1 | components/DeviceCard.vue:214-235 | 卡片 10 个字段；device.state 裸英文直出（同文件已有 stateLabel） | 密度过高、中英混排 |
| U-13 | P2 | assets/main.css:357-419；assets/ui-shell.css:1-50 | 两套页头 CSS 并存，panel-header 系列为死代码 | 标题三档字号，维护混乱 |
| U-14 | P2 | AppIcon.vue:128；multi-app/Win11TaskbarIcon.vue:31 | 三套图标体系、8 档尺寸、描边 0.6–2 | 视觉重量不一 |
| U-15 | P2 | assets/logs-page.css:52,91,101 | --warning 未定义靠 fallback，另两处硬编码 | 深色不换色 |

### 4.2 交互

| 编号 | 等级 | 位置 | 现状 | 影响 |
|---|---|---|---|---|
| U-16 | P0 | utils/device-workspace-actions.js:2-47；assets/main.css:1049-1066 | 12 个等权按钮，需求宽 ≈794px | 1024 视口折两行，header 130px，吃掉画面 60px |
| U-17 | P0 | DeviceWorkspaceToolbar.vue:80-116；multi-app/WindowsTaskbar.vue:113-204 等 | 工作区/多应用中文字符串硬编码，无 t() | 5 语言里 4 种核心界面仍中文 |
| U-18 | P0 | i18n/messages/*（实测 zh-CN 305 键，ja/ko/zh-TW 249 键） | 缺 ≈56 键 | 日文界面弹简体长句；帮助气泡空白 |
| U-19 | P0 | assets/main.css:2893,1150,385；ui-shell.css:70；group-control.css:70 | 触控目标 21.6–36px | 移动端误触 |
| U-20 | P0 | assets/add-device-modal.css:1-8；assets/main.css:1668 | 弹窗无 max-height，layer 无 overflow | 小屏按钮出屏且不能滚 |
| U-21 | P0 | DeviceCastViewport.vue:169-190；main.css:1250；DeviceGalleryContextMenu.vue:72 | 画布不可 Tab、focus outline 被抹；右键菜单仅鼠标、无边界翻转 | 键盘/读屏不可用 |
| U-22 | P1 | composables/useMobileLayout.js:3 vs DeviceWorkspace.vue:381 | 断点 560 两处硬编码 | 改一处即漂移 |
| U-23 | P1 | main.css:1910,2733,2741 | 3 个断点，561–900 无主 | 600px 宽屏顶栏挤、卡片压到 300px |
| U-24 | P2 | utils/theme-store.js:14-18 | 主题切换硬跳 | 与 settings 入场动效轻重倒置 |
| U-25 | P2 | DevicesPanel.vue:109-115 | window.confirm 原生弹窗 | 脱离设计系统 |
| U-26 | P2 | index.html:2 | html lang 固定 zh-CN | 读屏发音错误 |

## 5. 设计系统规范 v2

### 5.1 Token 全表（写入 assets/main.css :root，保持旧变量名不变）

| 组 | Token | Light | Dark | 说明 |
|---|---|---|---|---|
| 颜色 | --bg | #eef2f7 | #0f172a | 页面底 |
| | --bg-stage | #0b0f14 | #0b0f14 | 投屏舞台，不随主题 |
| | --text / --muted | #0f172a / #475569 | #f8fafc / #94a3b8 | 15.9:1 / 6.7:1 |
| | --primary | #15803d | #22c55e | 白字 5.02:1 |
| | --primary-strong | #166534 | #16a34a | hover |
| | --primary-text | #ffffff | #052e16 | 主按钮文字 |
| | --success / --success-text | #16a34a / #166534 | #22c55e / #4ade80 | 拆图形色与文字色 |
| | --success-soft | rgba(22,163,74,.10) | rgba(34,197,94,.16) | 胶囊底 |
| | --warning / --warning-soft | #b45309 / rgba(180,83,9,.12) | #fbbf24 / rgba(251,191,36,.16) | 新增 |
| | --danger | #e11d48 | #fb7185 | 不变 |
| | --line / --line-strong | rgba(15,23,42,.10) / rgba(22,163,74,.35) | 不变结构 | 描边 |
| | --overlay / --overlay-strong | rgba(15,23,42,.42) / rgba(8,12,20,.72) | 更深 | 弹层/全屏按钮 |
| 字号 | --fs-2xs…--fs-xl | 11 / 12 / 13 / 14 / 16 / 18 / 22 px | 同 | 7 阶；0.82–0.92rem 全部归 --fs-base |
| 行高 | --lh-tight / --lh-base / --lh-relaxed | 1.25 / 1.5 / 1.6 | 同 | |
| 间距 | --sp-1…--sp-12 | 4/8/12/16/20/24/32/40/48 px | 同 | 4px 基准 |
| 圆角 | --radius-xs/sm/md/lg/xl/pill | 4/8/10/14/20/999 px | 同 | lg 由 20 降到 14，弹窗用 xl |
| 阴影 | --shadow-1/2/3 | color-mix(in srgb, var(--text) 8/10/16%, transparent) | 自动反色 | 旧 --shadow = --shadow-3 |
| 动效 | --dur-fast/base/slow | 120/180/260 ms | | |
| | --ease-out | cubic-bezier(.2,.8,.25,1) | | |
| 焦点 | --focus-ring | 0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent) | | 替换 outline:none |
| 图标 | --icon-sm/md/lg | 14/18/22 px | | 描边统一 1.75，toolbar 2 |
| 字体 | --font-body / --font-heading / --font-mono | DM Sans / Space Grotesk / ui-monospace… | | 自托管到 public/fonts |

### 5.2 组件规范

- 按钮：唯一主按钮组件 ui/UiButton.vue，variant=primary/secondary/ghost/danger；高度 32/36/44 三档；圆角 --radius-sm。
- 卡片：圆角 --radius-lg，描边 1px --line，底 --bg-elevated + blur 12px，hover 仅变描边与 --shadow-2，不做位移。
- 弹窗：圆角 --radius-xl，max-height calc(100dvh - 32px)，内部滚动；小屏改底部 sheet（圆角 20 20 0 0 + 顶部把手）。
- 页头：ui/PageHeader.vue 唯一实现；标题 --fs-xl，区块标题 --fs-lg，卡片标题 --fs-md。
- 空态/骨架：ui/EmptyState.vue（图标 + 标题 + 主按钮）、ui/SkeletonCard.vue（shimmer 1.4s）。
- 状态色：只允许 --success-text / --warning / --danger 作为文字色，禁止直接用 --success 当文字色。

### 5.3 布局与断点

| 断点 | 布局 | 规则 |
|---|---|---|
| ≥1440 | 侧栏 192 + 内容自适应，画廊 minmax(240,320) 居中 | 内容最大宽 1600 居中 |
| 1024–1440 | 同左 | 工具栏 5 + 更多 |
| 768–1024 | 侧栏收窄为图标 72 | 工具栏横向滚动 |
| 560–768 | 顶部横向 Tab，单列画廊 | 禁用多列 |
| ≤560 | 底部 Tab 导航 | 触控目标 ≥44px，safe-area 四边 |

断点常量只允许来自 composables/useMobileLayout.js，模板与 CSS 不得硬编码像素值。

## 6. 竞品对标矩阵

| 能力 | Cloud Phone | ws-scrcpy | escrcpy/QtScrcpy | STF | 云手机厂商 | 结论 |
|---|---|---|---|---|---|---|
| 投屏底座 | scrcpy 4.0 自改 + 设备端 WS | 0.9.0-dev 四播放器 | 跟上游快 | minicap+minitouch | 自研/WebRTC | 落后 3 个版本 |
| 播放器回退 | 仅 WebCodecs | WebCodecs/MSE/TinyH264/Broadway | 桌面无此问题 | 服务端渲染 | WebRTC | Safari/老 Chromium 不可用 |
| H.265/AV1 | 参数可下发但只构造 avc1.* | 同 | 支持 | 无 | — | 假支持，选中黑屏 |
| 非安卓平台 | 鸿蒙 + iOS 都有 | iOS 实验 | 无 | iOS 实验 | 部分 | 独有优势 |
| 多应用虚屏桌面 | Win11 桌面 + 每窗独立 VD | 无 | 无 | 无 | 无 | 形态独特 |
| 群控 | 前端网格 + 广播 + 4 类批量 | 无 | 多设备同步 + 自动化 | 群组 + 预约 | 批量控制 | 缺任务化 |
| 多用户/角色 | 单口令 | 无 | 无 | 用户/组/配额 | IAM | 结构性缺口 |
| 审计 | 有日志无 actor | 无 | 无 | 有占用追踪 | 云审计 | 日志≠审计 |
| 性能采集 | 无 | 无 | 无 | 电量/健康度 | 有 | 空白 |
| logcat | 无用户面板 | devtools | 无 | 有 | 云日志 | 空白 |
| 设备发现 | mDNS 仅发布 | 无 | 有 ADB-over-mDNS | 无 | — | 缺自动发现 |
| 可观测 | 无 /metrics | 无 | 无 | Prometheus | 云监控 | 缺 |
| 协作 | 无观察者/控制权 | 无 | 无 | 有占用语义 | Vysor Share | 空白 |

## 7. 路线图与 WBS

### v1.23 稳（本次目标）

| 任务 | 内容 | 涉及文件 | 验收 |
|---|---|---|---|
| T1.1 | 登录限速 + 429/Retry-After | services/login-throttle.js（新）、routes/auth-routes.js、config/auth.js | 第 6 次失败返回 429 |
| T1.2 | data 目录 0700 / 文件 0600 + 启动纠正 | services/auth-store.js | stat 验证 |
| T1.3 | 默认 HOST=127.0.0.1、会话 30 天、Cookie Secure | tools/env-loader.js、config/auth.js、auth-service.js、routes/auth-routes.js | Set-Cookie 含 Secure（HTTPS 下游） |
| T1.4 | body 上限 + 413 + server 超时 | utils/http.js、index.js | 14 MiB 返回 413 |
| T1.5 | CORS 白名单化 | utils/http.js | 非白名单 Origin 无 ACAO |
| T1.6 | WS Origin + maxPayload + 并发上限 | middleware/ws-auth.js、ws/device-websocket-server.js | 恶意 Origin 被拒 |
| T1.7 | 偏好写入需会话 | routes/local-persistence-routes.js、middleware/api-auth.js | 未登录 POST 401 |
| T1.8 | Cookie 解析容错 | utils/cookies.js | 畸形 Cookie 不挂起 |
| T1.9 | 日志长度上限 + actor 列 | services/local-persistence-logs.js | 超长截断、返回 actor |
| T1.10 | 包名/路径白名单化（设备侧命令注入） | services/device-apps-mutate.js | 非法包名返回 400 |
| T1.11 | 安全响应头 + 证书持久化 + x-forwarded-proto | frontend/web/server.mjs、tls-self-signed.mjs | 响应含 CSP/XFO/HSTS；重启证书不变 |
| T1.12 | 设计 token + 对比度 + --radius-sm + focus ring + 深色阴影 | assets/main.css、utils/naive-theme.js | 第 10 章 UI 验收全绿 |
| T1.13 | canvas 比例修复 + 舞台深色 | utils/ws-scrcpy-annexb-player.js、assets/main.css | 画面不变形、触摸对齐 |
| T1.14 | 骨架屏 + 空态 + 画廊网格 + 弹窗高度 | components/ui/SkeletonCard.vue（新）、EmptyState.vue（新）、DevicesPanel.vue、AppShell.vue、main.css | 首屏有骨架、空态有按钮 |

### v1.24 快

群控任务化（任务对象/进度/重试/归档）· 多设备命令台 · logcat 面板 + ANR/tombstone · 性能采集（CPU/内存/流量/温度/电量 + CSV）· 审计 actor 贯通 + 导出 · /metrics · 只读观察者 + 控制权租约 · ADB-over-mDNS 自动发现 · i18n 补齐 56 键 + 工作区去硬编码 · 工具栏 5 + 更多 · h265 真解码或显式拒绝 · 播放器回退链（MSE）· 镜像会话自动重连。

### v2.0 大

用户/角色/设备归属 + 配额 · OIDC/LDAP · 控制面数据面拆分 + 调度队列 + 并发预算 · 分享链接（短期 token/只读/可撤回）· 反代与证书模板（ACME）· 备份恢复包 · 桌面壳（Tauri）· 真正的传输安全（强制 TLS 或 ECDH 握手，替换硬编码 wire key）。

## 8. 实施与验证规范

### 8.1 提交节奏（AGENTS.md）

每完成一个小任务停下来问是否提交；提交必须：tools/version_manager.py 升版本 → 更新 CHANGELOG.md → README.md/README.EN.md 写入功能说明 → commit message 带版本号与 type(scope)。

### 8.2 本地验证命令

    # 语法
    node --check backend/node/src/index.js
    for f in $(find backend/node/src -name '*.js'); do node --check "$f" || echo "FAIL $f"; done

    # 后端冒烟（独立端口，回环）
    HOST=127.0.0.1 BACKEND_PORT=3999 node backend/node/src/index.js &
    curl -s http://127.0.0.1:3999/api/ping
    curl -s http://127.0.0.1:3999/api/auth/session
    curl -si -X POST http://127.0.0.1:3999/api/auth/login -d '{"encrypted":true,"payload":""}' | head -1

    # 前端构建
    npm --prefix frontend/web run build

    # 体积/行数红线（AGENTS.md 300 行）
    find backend/node/src frontend/web/src -name '*.js' -o -name '*.vue' | xargs wc -l | sort -rn | head

### 8.3 回滚

改动均不涉及数据库结构破坏（新增列用 ALTER TABLE ... ADD COLUMN 且带默认值），回滚只需 git checkout 对应文件 + 删除 backend/node/data 内的新增表/列（如有）。TLS 证书落盘新增两个文件，删除即回到每次重生成。

## 9. 风险登记册

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 默认回环导致老用户 LAN 访问失效 | 高 | 中 | .env.example 显式写 HOST=0.0.0.0 与 HTTPS 要求；README 迁移说明；启动日志打印当前监听地址 |
| Cookie 加 Secure 后 HTTP 直连丢会话 | 中 | 中 | 仅在 https/x-forwarded-proto=https 时追加；HTTP 直连仍可用 |
| 会话 TTL 从 150 天降到 30 天需重新登录 | 高 | 低 | CHANGELOG 说明；AUTH_SESSION_DAYS 可调 |
| 登录限速误伤自动化脚本 | 中 | 中 | 阈值可通过环境变量调整；成功登录清零 |
| 日志加 actor 列导致旧库不兼容 | 低 | 中 | CREATE TABLE 保持原样 + 启动时 PRAGMA table_info 检测后 ALTER TABLE ADD COLUMN |
| 视觉 token 改动引发局部回归 | 中 | 低 | 只改 token 与少量选择器，不改结构；逐页截图对比 |
| 反代追加 x-forwarded-proto 影响第三方反代 | 低 | 低 | 仅在前端自带 proxyToBackend 内追加，不改外部部署 |

## 10. 验收清单

安全
- [ ] 连续 6 次错误口令 → 429 + Retry-After；锁定窗口内正确口令同样拒绝
- [ ] backend/node/data 权限 drwx------，auth.key/db 为 -rw-------
- [ ] 默认 HOST 为 127.0.0.1；启动日志打印实际监听地址
- [ ] 经 5173 HTTPS 访问：Set-Cookie 含 Secure、HttpOnly、SameSite=Lax、Max-Age=30d
- [ ] 14 MiB JSON body → 413；慢速上传 30s 断开
- [ ] Origin: https://evil.example 的 WS 握手被拒；第 5 个终端连接被拒
- [ ] 未登录 POST /api/public/preferences → 401
- [ ] Cookie: a=%E0%A4%A 请求正常返回，不挂起
- [ ] 单条 1 MiB 日志 details 被截断到 16 KiB 并可查询
- [ ] packageName="com.x; reboot" 被 400 拒绝

界面
- [ ] 浅色下主按钮文字对比度 ≥ 4.5:1（实测 5.02）
- [ ] 侧栏激活态、在线状态胶囊文字 ≥ 4.5:1
- [ ] 任意弹窗/卡片/按钮不再出现直角（--radius-sm 生效）
- [ ] 登录表单 Tab 有可见焦点环
- [ ] 投屏画面保持 9:20 等比，四周为深色舞台；触摸点与画面一致
- [ ] 设备墙首屏出现 6 个骨架卡片；无设备时显示图标 + 「添加设备」按钮
- [ ] 深色模式下卡片阴影可见、多应用桌面为深色
- [ ] 小屏（375×667）「添加设备」弹窗可滚动、底部按钮可点
- [ ] 工具栏在 1024 视口不折行（v1.24 完成）

## 附录 A 证据索引

认证：backend/node/src/config/auth.js:2-6 · services/auth-service.js:41-74,139-147,211 · services/auth-store.js:11,131-139 · middleware/api-auth.js:6-19 · middleware/ws-auth.js:5-10
传输：utils/api-crypto.js:5-7 · utils/protected-http.js:9-14 · utils/http.js:30-43,45-85 · utils/cookies.js:13
路由：routes/auth-routes.js:23-41,50-95 · routes/local-persistence-routes.js:33-57 · routes/device-files-routes.js:46-93 · routes/device-apps-routes.js:40-58,106,139
服务：services/device-terminal/spawn-shell.js:9-17 · services/device-file-path.js:2,10-12 · services/device-apps-mutate.js:13-15 · services/device-files-transfer.js:51 · services/local-persistence-logs.js:9-22,83-96
前端：frontend/web/src/utils/ws-scrcpy-annexb-player.js:41-45,181 · utils/canvas-rotation.js:138-150 · utils/remembered-password.js:26-27 · utils/naive-theme.js:4-13 · assets/main.css:1-70,551-596,1049-1066,1216,1285,1601,1840 · components/DeviceCard.vue:214-235 · components/AppShell.vue:213-218
部署：tools/env-loader.js:8,37 · backend/node/src/index.js:22 · frontend/web/server.mjs:80,93-97 · tls-self-signed.mjs:10-23 · docker-cloud-phone/docker/backend.Dockerfile · docker-cloud-phone/docker-compose.yml:12
Android：frontend/android/app/src/main/AndroidManifest.xml:10-11

## 附录 B 参考

- OWASP Top 10 2021（A01 访问控制、A02 加密失败、A05 配置错误、A07 认证失败）
- WCAG 2.1 AA：正文 4.5:1，大字 3:1，触控目标 44×44
- scrcpy releases（4.1 / 5.0 增量）、ws-scrcpy、escrcpy、DeviceFarmer STF、Genymobile scrcpy

## 11. 实施进展（v1.23.0）

### 11.1 落地内容

| 项 | 结果 | 关键位置 |
|---|---|---|
| S-01 登录限速 | 5 次失败锁 15 分钟、指数退避至 60 分钟、全局 10 分钟 20 次；429 + Retry-After | services/login-throttle.js（新）、routes/auth-routes.js:53-80 |
| S-02 数据权限 | 目录 0700、db 与 auth.key 0600，启动纠正存量 | services/auth-store.js:23-48 |
| S-03 叙事纠正 | wire key 注释改为「仅混淆」，安全由 TLS 承担 | utils/protected-http.js:8-16、utils/api-crypto.js:5-9 |
| S-04 监听与 Cookie | 默认 HOST=127.0.0.1；会话 30 天可配；https 下 Cookie 带 Secure；登出清两种变体 | tools/env-loader.js:8-11、config/auth.js、services/auth-service.js:130-168 |
| S-05 体积与超时 | JSON 1 MiB、上传 256 MiB，声明超限直接 413；server 120s/30s/5s | utils/http.js:10-70、index.js:10-17、app.js:49-53 |
| S-07 WS | Origin 白名单 + maxPayload 4 MiB + 终端 4/设备、32 全局，投屏 64 全局 | middleware/ws-auth.js、ws/device-websocket-server.js |
| S-08 CORS | 删除「端口相同即放行」，改为显式白名单 | utils/http.js:150-185 |
| S-09 偏好写入 | GET 公开、POST 需会话 | middleware/api-auth.js:12-24 |
| S-16 日志 | message ≤4096、details ≤16384 且保证合法 JSON；新增 actor 列并迁移旧库 | services/local-persistence-logs.js |
| S-11 包名 | 白名单校验，非法 400；安装临时包随机名 + 0600 | services/device-apps-mutate.js:9-30、routes/device-apps-routes.js:42 |
| S-17/18/19/23 | Cookie 解析容错、lockfile 入库、恒时比较、随机临时名 | utils/cookies.js、.gitignore、services/auth-service.js |
| S-15 响应头与证书 | CSP/XFO/nosniff/Referrer/Permissions/COOP + https HSTS；证书落盘复用；反代补 x-forwarded-proto/for | frontend/web/server.mjs、frontend/web/tls-self-signed.mjs |
| U-02/03/04/07/08/09/10 | token 全表、--radius-sm 生效、绿色文字对比度 ≥4.5、焦点环、深色阴影、深色舞台 | assets/main.css:14-135、utils/naive-theme.js |
| U-01 画面变形 | canvas 盒按源宽高比精确设置并居中，触摸换算退化为 0 修正 | utils/canvas-fit.js（新）、utils/ws-scrcpy-annexb-player.js:41-43,146,294 |
| U-05 骨架与空态 | SkeletonCard / EmptyState + 1.4s shimmer | components/ui/*.vue、assets/skeleton.css |
| U-06/U-20 | 画廊 minmax(240,320) 居中、预览 3/4；弹窗 max-height + 小屏底部 sheet | assets/main.css:622,666,1757,2944 |
| U-11 平板断点 | 侧栏 425px → 140px（768 宽实测），按钮不再按字折行，四档无横向溢出 | assets/main.css @media (max-width: 900px) |
| S-15b CSP 兼容 | 开启 vue-i18n JIT，消息不再运行时 new Function，CSP 保持无 'unsafe-eval' | frontend/web/vite.config.js |

### 11.2 验证记录（本机实跑）

- 后端：全部 JS 文件 node --check 通过；临时端口 3999 冒烟 —— ping 200、畸形 Cookie 200 不挂起、连续 5 次错口令 401 后第 6 次 429（Retry-After 900）、未登录 POST 偏好 401 / GET 200、Content-Length 99999999 返回 413、Origin: https://evil.example 的 WS 握手 403。
- 数据权限：实测目录 drwx------，auth.key 与 cloud-phone.db 均 -rw-------（原 0777/0666）。
- Cookie：Secure 变体 Max-Age=2592000（30 天）、HttpOnly、SameSite=Lax；非 https 不带 Secure。
- 前端：npx vite build 通过（4691 模块，CSS 118.78 kB / JS 1.70 MB）；dist 中 --radius-sm=8px 等 token 全部落地；未定义 CSS 变量从 5 个降到 2 个（均为 JS 运行时注入）。
- 对比度复算：白/#15803d 5.02、#166534/#eef2f7 6.34、#166534/#e3f4e9 6.24、#4ade80/#0f172a 10.25、#052e16/#22c55e 6.54。
- 响应头：http 模式六项头齐全且无 HSTS；https 模式追加 HSTS；同 SAN 重启后证书指纹不变。

### 11.3 未完成与观察项

1. 可视化回归未做：只做构建级与算术级验证，未逐页截图比对；提交前建议用 1440/1024/768/375 四档过一遍。
2. 静态托管下 SPA 白屏（既有问题，非本批引入）：用 server.mjs 托管 dist 时页面只渲染到 n-config-provider，Vue 未抛异常；同一份 dist 用 python http.server 托管可正常渲染登录页。已用 HEAD 版 AppShell 对照复现，说明与本批改动无关；下一步在 npm run dev 与 https 路径上二分定位。
3. H.265 假支持仍在（前端只构造 avc1.* 解码配置），属 v1.24。
4. main.css 3027 行、GroupControlPanel.vue 738 行等超 300 行红线，属历史遗留，与视觉回归同批拆分。
5. 触控目标 ≥44px、工作区工具栏 5+更多、i18n 补齐 56 键、审计 actor 贯通，均在 v1.24。
6. 提交前需按 AGENTS 完成：tools/version_manager.py 升到 v1.23.0、CHANGELOG.md 条目、README.md 与 README.EN.md 双语说明。
