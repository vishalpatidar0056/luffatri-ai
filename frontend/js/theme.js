// theme.js - loaded first, on every page. Keeps light/dark theme in sync
// across pages and applies it immediately to avoid a flash of the wrong theme.

const THEME_KEY = "theme"; // 'dark' | 'light'

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (_) {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getEffectiveTheme() {
  return getStoredTheme() || getSystemTheme();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {
    /* localStorage unavailable (private browsing etc) - theme just won't persist */
  }
  applyTheme(theme);
}

// Apply immediately on script load (this file is included before the page
// renders its body), so there's no flash of the default theme.
applyTheme(getEffectiveTheme());
