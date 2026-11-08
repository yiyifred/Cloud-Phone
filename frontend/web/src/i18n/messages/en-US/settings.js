export default {
  settings: {
    eyebrow: "Settings",
    title: "Settings",
    desc: "Manage account, appearance, and gallery refresh.",
    navLabel: "Settings categories",
    nav: {
      account: "Account",
      appearance: "Appearance",
      refresh: "Refresh",
      share: "Sharing",
    },
    sections: {
      account: {
        title: "Account",
        desc: "View session status, change your login password, or configure the app-icon helper install preference.",
        changePassword: "Change password",
      },
      appearance: {
        title: "Appearance",
        desc: "Switch UI language and light/dark theme.",
        theme: "Theme",
      },
      refresh: {
        title: "Refresh",
        desc: "Configure automatic refresh intervals for the device gallery.",
      },
      share: {
        title: "Sharing",
        desc: "Create read-only share links so others can view device screens without the password (time-limited, revocable).",
      },
    },
    language: "Interface language",
    languageHint: "Takes effect immediately. Preference is stored in this browser.",
    deviceInterval: "Device list refresh interval (seconds)",
    screenshotInterval: "Screenshot refresh interval (seconds)",
    intervalHint:
      "Default: device list every 1s, screenshots every 5s. Previous frames are kept during background refresh.",
    save: "Save settings",
    savedFeedback: "Device list every {device}s, screenshots every {screenshot}s.",
    passwordStatus: "Password status",
    sessionExpiry: "Session expires",
    iconHelper: "App icon helper",
    iconHelperHint:
      "Start menu and Apps manager need a tiny helper app for icons and names. With Ask, two refusals stop the prompt; change anytime here.",
    iconHelperAsk: "Ask (default)",
    iconHelperAllow: "Always allow install",
    iconHelperNever: "Do not install (package names only)",
  },
};
