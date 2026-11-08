export default {
  settings: {
    eyebrow: "設定",
    title: "設定",
    desc: "アカウント、外観、ギャラリー更新を管理します。",
    navLabel: "設定カテゴリ",
    nav: {
      account: "アカウント",
      appearance: "外観",
      refresh: "更新",
      share: "共有",
    },
    sections: {
      account: {
        title: "アカウント",
        desc: "セッション状態の確認、ログインパスワードの変更、アイコン取得アプリのインストール設定。",
        changePassword: "パスワードを変更",
      },
      appearance: {
        title: "外観",
        desc: "UI 言語とライト/ダークテーマを切り替えます。",
        theme: "テーマ",
      },
      refresh: {
        title: "更新",
        desc: "デバイスギャラリーの一覧とスクリーンショットの自動更新間隔を設定します。",
      },
      share: {
        title: "共有",
        desc: "読み取り専用の共有リンクを作成し、パスワードなしで画面を閲覧できるようにします（期間限定・失効可能）。",
      },
    },
    language: "UI 言語",
    languageHint: "切り替え後すぐに反映されます。設定はブラウザに保存されます。",
    deviceInterval: "デバイス一覧の更新間隔（秒）",
    screenshotInterval: "スクリーンショットの更新間隔（秒）",
    intervalHint:
      "既定: 一覧 1 秒、スクリーンショット 5 秒。バックグラウンド更新中も前のフレームを保持します。",
    save: "設定を保存",
    savedFeedback: "一覧 {device} 秒、スクリーンショット {screenshot} 秒ごとに更新します。",
    passwordStatus: "パスワード状態",
    sessionExpiry: "セッション期限",
    iconHelper: "アプリアイコンサービス",
    iconHelperHint:
      "スタートメニューとアプリ管理では、アイコンと名前取得のため極小サービスアプリが必要です。「確認する」では 2 回拒否すると再表示しません。ここからいつでも変更できます。",
    iconHelperAsk: "確認する（既定）",
    iconHelperAllow: "常にインストールを許可",
    iconHelperNever: "インストールしない（パッケージ名のみ）",
  },
};
