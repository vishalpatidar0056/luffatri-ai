// settings.js - drives the Settings modal on index.html.
// All data is localStorage-only; AI context prefix rides in the first message.

const PROFILE_KEY           = "userProfile";
const CUSTOM_CHARACTERS_KEY = "customCharacters";

// ---------- Storage helpers ----------

function getUserProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || { name: "", about: "", avatarUrl: "" };
  } catch (_) {
    return { name: "", about: "", avatarUrl: "" };
  }
}

function saveUserProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
}

function getCustomCharacters() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CHARACTERS_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function getCharacterOverride(characterId) {
  return getCustomCharacters()[characterId] || null;
}

function saveCharacterOverride(characterId, override) {
  const all = getCustomCharacters();
  all[characterId] = { ...(all[characterId] || {}), ...override };
  try { localStorage.setItem(CUSTOM_CHARACTERS_KEY, JSON.stringify(all)); } catch (_) {}
}

function clearCharacterOverride(characterId) {
  const all = getCustomCharacters();
  delete all[characterId];
  try { localStorage.setItem(CUSTOM_CHARACTERS_KEY, JSON.stringify(all)); } catch (_) {}
}

/**
 * Merges a server character record with any local override
 * (display name, avatar, hidden flag, extra personality).
 */
function withOverride(character) {
  const override = getCharacterOverride(character.id) || {};
  return {
    ...character,
    name:             override.displayName || character.name,
    avatar_url:       override.avatarUrl   || character.avatar_url,
    description:      character.description,
    extraPersonality: override.extraPersonality || "",
    hidden:           !!override.hidden,
  };
}

/**
 * Builds the "About you" context prefix for the first message of a new chat.
 * This prefix is stored as part of the chat history on the server.
 */
function buildContextPrefix(extraPersonality) {
  const profile = getUserProfile();
  const parts   = [];

  if (profile.name || profile.about) {
    let userInfo = "User Info:";
    if (profile.name)  userInfo += ` Name: ${profile.name}.`;
    if (profile.about) userInfo += ` About: ${profile.about}.`;
    parts.push(userInfo);
  }

  if (extraPersonality) {
    parts.push(`Additional character notes (from the user): ${extraPersonality}`);
  }

  return parts.length ? parts.join(" ") + "\n\n" : "";
}

// ---------- Modal wiring ----------

const settingsModal    = document.getElementById("settingsModal");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsTabs     = document.querySelectorAll(".settings-tab");
const settingsPanels   = document.querySelectorAll(".settings-panel");

function openSettings(defaultTab = "appearance") {
  settingsModal.style.display    = "flex";
  settingsBackdrop.style.display = "block";
  switchTab(defaultTab);
  loadSettingsFormFromStorage();
}

function closeSettings() {
  settingsModal.style.display    = "none";
  settingsBackdrop.style.display = "none";
}

function switchTab(tabName) {
  settingsTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
  settingsPanels.forEach((p) => p.classList.toggle("active", p.id === `panel-${tabName}`));
}

settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

settingsBackdrop.addEventListener("click", closeSettings);
document.getElementById("settingsCloseBtn").addEventListener("click", closeSettings);

document.getElementById("openSettingsBtn").addEventListener("click", () => openSettings("appearance"));
document.getElementById("navbarAvatarBtn").addEventListener("click", () => openSettings("profile"));

// Keyboard: Escape closes settings
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsModal.style.display === "flex") closeSettings();
});

// Appearance tab
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("change", () => {
  setTheme(themeToggle.checked ? "light" : "dark");
});

// Profile tab - avatar picker
const profileAvatarPicker = setupAvatarPicker({
  fileInput:      document.getElementById("profileAvatarFile"),
  previewEl:      document.getElementById("profileAvatarPreview"),
  removeBtn:      document.getElementById("removeProfileAvatarBtn"),
  getName:        () => document.getElementById("profileName").value.trim() || "You",
  initialDataUrl: getUserProfile().avatarUrl || null,
  onChange:       () => {},
});

document.getElementById("chooseProfileAvatarBtn").addEventListener("click", () => {
  document.getElementById("profileAvatarFile").click();
});

// Save profile
document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const profile = {
    name:      document.getElementById("profileName").value.trim(),
    about:     document.getElementById("profileAbout").value.trim(),
    avatarUrl: profileAvatarPicker.getValue(),
  };
  saveUserProfile(profile);
  refreshNavbarAvatar();
  closeSettings();
});

// AI Personality tab (shares profile.about field)
document.getElementById("aiContextForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const profile  = getUserProfile();
  profile.about  = document.getElementById("aiContextAbout").value.trim();
  saveUserProfile(profile);
  closeSettings();
});

function loadSettingsFormFromStorage() {
  themeToggle.checked = getEffectiveTheme() === "light";

  const profile = getUserProfile();
  document.getElementById("profileName").value  = profile.name  || "";
  document.getElementById("profileAbout").value = profile.about || "";
  profileAvatarPicker.setValue(profile.avatarUrl || null);
  document.getElementById("aiContextAbout").value = profile.about || "";
}

function refreshNavbarAvatar() {
  const profile     = getUserProfile();
  const btn         = document.getElementById("navbarAvatarBtn");
  const displayName = profile.name || "You";
  btn.innerHTML     = avatarHtml(displayName, profile.avatarUrl, 34);
}

// Initialise avatar button on page load
refreshNavbarAvatar();
