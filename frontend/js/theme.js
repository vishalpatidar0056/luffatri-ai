// theme.js - loaded first on every page. Applies theme immediately to avoid flash.

const THEME_KEY = "theme"; // 'dark' | 'light'

function getStoredTheme() {
  try   { return localStorage.getItem(THEME_KEY); }
  catch (_) { return null; }
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
  try   { localStorage.setItem(THEME_KEY, theme); }
  catch (_) { /* localStorage unavailable */ }
  applyTheme(theme);
}

// Apply immediately on script load (before body renders) to prevent flash.
applyTheme(getEffectiveTheme());

// Respond to system theme changes (when user hasn't set an explicit preference)
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    if (!getStoredTheme()) applyTheme(e.matches ? "light" : "dark");
  });
}
