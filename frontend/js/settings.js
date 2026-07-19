// settings.js - drives the Settings modal on index.html.
// Everything here is stored in localStorage only - nothing is sent to the
// backend except the AI-context prefix, which rides inside the normal chat
// message text (see buildContextPrefix below).

const PROFILE_KEY = "userProfile";
const CUSTOM_CHARACTERS_KEY = "customCharacters"; // { [characterId]: {displayName, avatarUrl, extraPersonality, hidden} }

// ---------- Storage helpers ----------

function getUserProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || { name: "", about: "", avatarUrl: "" };
  } catch (_) {
    return { name: "", about: "", avatarUrl: "" };
  }
}

function saveUserProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (_) { /* storage unavailable */ }
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
  try {
    localStorage.setItem(CUSTOM_CHARACTERS_KEY, JSON.stringify(all));
  } catch (_) { /* storage unavailable */ }
}

function clearCharacterOverride(characterId) {
  const all = getCustomCharacters();
  delete all[characterId];
  try {
    localStorage.setItem(CUSTOM_CHARACTERS_KEY, JSON.stringify(all));
  } catch (_) { /* storage unavailable */ }
}

/**
 * Merges a real character record with any local override (display name,
 * avatar, hidden flag). Falls back to the real values for anything not
 * overridden.
 */
function withOverride(character) {
  const override = getCharacterOverride(character.id) || {};
  return {
    ...character,
    name: override.displayName || character.name,
    avatar_url: override.avatarUrl || character.avatar_url,
    description: character.description,
    extraPersonality: override.extraPersonality || "",
    hidden: !!override.hidden,
  };
}

/**
 * Builds the "About you" context string to prepend to the FIRST message of
 * a conversation, per your spec. This is the only way to hand Gemini/Groq
 * extra context without touching the backend - it rides inside the normal
 * message text.
 *
 * IMPORTANT trade-off: because this has to travel as part of the message
 * itself (there's no separate "system context" field in the API), it gets
 * saved to chat history exactly as sent - so it'll be visible if you scroll
 * back to the top of the conversation later. That's an inherent limit of
 * doing this without a backend change, not a bug.
 */
function buildContextPrefix(extraPersonality) {
  const profile = getUserProfile();
  const parts = [];
  if (profile.name || profile.about) {
    let userInfo = "User Info:";
    if (profile.name) userInfo += ` Name: ${profile.name}.`;
    if (profile.about) userInfo += ` About: ${profile.about}.`;
    parts.push(userInfo);
  }
  if (extraPersonality) {
    parts.push(`Additional character notes (from the user): ${extraPersonality}`);
  }
  return parts.length ? parts.join(" ") + "\n\n" : "";
}

// ---------- Modal wiring ----------

const settingsModal = document.getElementById("settingsModal");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPanels = document.querySelectorAll(".settings-panel");

function openSettings(defaultTab = "appearance") {
  settingsModal.style.display = "flex";
  switchTab(defaultTab);
  loadSettingsFormFromStorage();
}

function closeSettings() {
  settingsModal.style.display = "none";
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

// Appearance tab
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("change", () => {
  setTheme(themeToggle.checked ? "light" : "dark");
});

// Profile tab - avatar picker
const profileAvatarPicker = setupAvatarPicker({
  fileInput: document.getElementById("profileAvatarFile"),
  previewEl: document.getElementById("profileAvatarPreview"),
  removeBtn: document.getElementById("removeProfileAvatarBtn"),
  getName: () => document.getElementById("profileName").value.trim() || "You",
  initialDataUrl: getUserProfile().avatarUrl || null,
  onChange: () => {},
});

document.getElementById("chooseProfileAvatarBtn").addEventListener("click", () => {
  document.getElementById("profileAvatarFile").click();
});

// Profile tab
document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const profile = {
    name: document.getElementById("profileName").value.trim(),
    about: document.getElementById("profileAbout").value.trim(),
    avatarUrl: profileAvatarPicker.getValue(),
  };
  saveUserProfile(profile);
  refreshNavbarAvatar();
  closeSettings();
});

// AI Personality tab (the "about you for AI context" field is the same
// profile.about used above - one field, shown in two tabs for clarity)
document.getElementById("aiContextForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const profile = getUserProfile();
  profile.about = document.getElementById("aiContextAbout").value.trim();
  saveUserProfile(profile);
  closeSettings();
});

function loadSettingsFormFromStorage() {
  themeToggle.checked = getEffectiveTheme() === "light";

  const profile = getUserProfile();
  document.getElementById("profileName").value = profile.name || "";
  document.getElementById("profileAbout").value = profile.about || "";
  profileAvatarPicker.setValue(profile.avatarUrl || null);
  document.getElementById("aiContextAbout").value = profile.about || "";
}

function refreshNavbarAvatar() {
  const profile = getUserProfile();
  const btn = document.getElementById("navbarAvatarBtn");
  const displayName = profile.name || "You";
  btn.innerHTML = avatarHtml(displayName, profile.avatarUrl, 34);
}

refreshNavbarAvatar();
