export default {
  settings: {
    eyebrow: "設定",
    title: "設定",
    desc: "管理帳號、外觀與裝置畫廊更新。",
    navLabel: "設定分類",
    nav: {
      account: "帳號",
      appearance: "外觀",
      refresh: "更新",
      share: "分享",
    },
    sections: {
      account: {
        title: "帳號",
        desc: "檢視目前工作階段狀態、修改登入密碼，或設定應用圖示服務安裝偏好。",
        changePassword: "修改密碼",
      },
      appearance: {
        title: "外觀",
        desc: "切換介面語言與淺色/深色主題。",
        theme: "主題",
      },
      refresh: {
        title: "更新",
        desc: "設定裝置畫廊列表與截圖的自動更新間隔。",
      },
      share: {
        title: "分享",
        desc: "建立唯讀分享連結，讓對方不需密碼即可查看裝置畫面（限時、可撤銷）。",
      },
    },
    language: "介面語言",
    languageHint: "切換後立即生效，偏好儲存在本機瀏覽器。",
    deviceInterval: "裝置列表更新間隔（秒）",
    screenshotInterval: "截圖更新間隔（秒）",
    intervalHint: "裝置列表預設每 1 秒、截圖每 5 秒更新；背景更新時保留上一幀畫面。",
    save: "儲存設定",
    savedFeedback: "裝置列表每 {device} 秒、截圖每 {screenshot} 秒更新。",
    passwordStatus: "密碼狀態",
    sessionExpiry: "工作階段到期",
    iconHelper: "應用圖示服務",
    iconHelperHint:
      "開始功能表與應用管理需要安裝極小服務應用以取得圖示與名稱。選擇「詢問」時拒絕兩次後不再彈窗；可隨時在此變更。",
    iconHelperAsk: "詢問（預設）",
    iconHelperAllow: "一律允許安裝",
    iconHelperNever: "不安裝（僅套件名稱）",
  },
};
