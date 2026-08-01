export default {
  iconHelper: {
    consentTitle: "安装图标服务应用",
    consentBody:
      "需要在设备上安装一个极小的服务应用，用于提取应用名称与图标。图标保存在该应用自己的目录中，可通过 ADB 读取。",
    allow: "允许安装",
    deny: "暂不安装",
    deniedHint: "已关闭图标服务安装，当前仅显示包名。可在「设置 → 应用图标服务」改为允许安装。",
    installing: "正在安装 / 更新图标服务…",
    extracting: "正在提取应用图标与名称…",
    extractingProgress: "正在提取（{done}/{total}）",
    loadingPackageNames: "正在加载包名…",
    searchApps: "搜索应用",
    loadingApps: "正在加载应用…",
    loadFailed: "无法加载应用列表",
    noMatch: "未找到匹配的应用",
    emptyApps: "暂无可用应用",
    appKind: "应用",
  },
};
