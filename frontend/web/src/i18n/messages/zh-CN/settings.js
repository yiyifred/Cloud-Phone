export default {
  settings: {
    eyebrow: "设置",
    title: "设置",
    desc: "管理账号、外观与设备画廊刷新。",
    navLabel: "设置分类",
    nav: {
      account: "账号",
      appearance: "外观",
      refresh: "刷新",
      share: "分享",
    },
    sections: {
      account: {
        title: "账号",
        desc: "查看当前会话状态，修改登录密码，或配置应用图标服务安装偏好。",
        changePassword: "修改密码",
      },
      appearance: {
        title: "外观",
        desc: "切换界面语言与浅色/深色主题。",
        theme: "主题",
      },
      refresh: {
        title: "刷新",
        desc: "配置设备画廊列表与截图的自动刷新间隔。",
      },
      share: {
        title: "分享",
        desc: "生成只读分享链接，让对方无需密码即可查看设备画面（限时、可吊销）。",
      },
    },
    language: "界面语言",
    languageHint: "切换后立即生效，偏好保存在本机浏览器。",
    deviceInterval: "设备列表刷新间隔（秒）",
    screenshotInterval: "截图刷新间隔（秒）",
    intervalHint: "设备列表默认每 1 秒、截图默认每 5 秒刷新；后台更新时保留上一帧画面。",
    save: "保存设置",
    savedFeedback: "设备列表每 {device} 秒、截图每 {screenshot} 秒刷新。",
    passwordStatus: "密码状态",
    sessionExpiry: "会话到期",
    iconHelper: "应用图标服务",
    iconHelperHint:
      "开始菜单与应用管理需要安装极小服务应用以获取图标和名称。选择「询问」时拒绝两次后不再弹窗；可随时在此更改。",
    iconHelperAsk: "询问（默认）",
    iconHelperAllow: "始终允许安装",
    iconHelperNever: "不安装（仅包名）",
  },
};
