const THEME_STORAGE_KEY = "cloud-phone-theme";
export const THEMES = ["dark", "light"];

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    if (THEMES.includes(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors and fall back to light mode.
  }

  return "light";
}

export function applyTheme(theme) {
  const resolvedTheme = THEMES.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = resolvedTheme;
  return resolvedTheme;
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function initTheme() {
  return applyTheme(getStoredTheme());
}
