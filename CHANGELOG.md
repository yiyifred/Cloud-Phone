# Changelog

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
