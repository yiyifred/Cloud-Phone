import { createApp } from "vue";

import App from "./App.vue";
import "./assets/main.css";
import "./assets/ui-shell.css";
import "./assets/auth-page.css";
import "./assets/mirror-settings.css";
import "./assets/windows-desktop.css";
import "./assets/skeleton.css";
import { i18n, setI18nLocale } from "./i18n/index.js";
import { initLocale } from "./i18n/locale-store.js";
import { hydratePublicPreferences } from "./utils/local-persistence-state.js";
import { initTheme } from "./utils/theme-store.js";

hydratePublicPreferences()
  .catch(() => {})
  .finally(() => {
    initTheme();
    setI18nLocale(initLocale());

    const app = createApp(App);
    app.use(i18n);
    app.mount("#app");
  });
