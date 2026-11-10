---
status: frozen
owner: lead
task: T-439
---

# 控制台界面收口：画廊卡片 / 设置行 / 动作按钮 / 截图缩略图

## 1 背景
Waydroid 真机跑通后，画廊缩略图与设置面板暴露一批硬缺陷：缩略图破图（`exec-out screencap -p` 拿回的不是 PNG）、卡片高度被纵向拉长且长字段撑三行、设置行标签换行把帮助问号挤到下一行、投屏中「开始投屏」以禁用态占着位置。

## 2 目标
- 画廊卡片高度统一、缩略图失败时退化为占位而不是破图 alt 文本；设备截图能真正出图。
- 设置行标签/控件/问号三列对齐，中文标签不截断。
- 投屏中只保留「取消投屏」，未投屏只保留「开始投屏」。

## 3 非目标
- 不动配色体系与深色主题，不改投屏协议、不改 Android 端。

## 4 用户路径与接口契约
- 画廊：`GET /api/devices/<serial>/screenshot` 必须返回以 `89 50 4E 47` 开头的 PNG。
- 设备端：`adb exec-out screencap -p` 若返回非 PNG，服务端自动回退 `shell screencap` + `pull`。

## 5 数据与状态模型
- `DeviceCard`：`displaySrc` / `screenshotFailed`；`@error` 时释放对象 URL 并置失败态。
- 设置行 CSS：`grid-template-columns: 8rem minmax(0,1fr) auto`。

## 6 错误与边界
- 两次截图路径都拿不到 PNG → 抛 `screenshot_not_png`，前端显示「截图失败」占位。
- 标签超长：换行而不是省略号；控件超长：省略号。

## 7 验收断言
- AC-1 画廊在线卡片显示设备缩略图（非破图、非「等待截图」），截图见 `tools/.tmp/T-439/21-gallery.png`。
- AC-2 同屏两张卡片预览区等高 13rem，长产品名最多两行省略。
- AC-3 投屏中底栏只有「取消投屏」（红色），未投屏只有「开始投屏」。
- AC-4 设置行「显示方向（采集）」完整显示，问号与控件同行。
- AC-5 文本对比度：主按钮白字/绿底 5.02:1、在线徽章 6.49:1、次要文字 4.76:1。
- AC-6 `npx vite build` 通过，页面控制台 0 error。

## 8 依赖与假设
- 证据：`docs`/`tools/.tmp/T-439/` 下 before/after 截图；`/tmp/contrast.mjs` 输出。
- 假设：Waydroid 的 adbd 会把 exec-out 当文本流，故必须保留 pull 回退。

## 9 未决问题
- none
