// app.js - drives index.html (the two-pane app shell)

Auth.requireLogin();

const appShell = document.getElementById("appShell");
const contactList = document.getElementById("contactList");
const searchInput = document.getElementById("searchInput");
const logoutBtn = document.getElementById("logoutBtn");
const toggleHiddenBtn = document.getElementById("toggleHiddenBtn");

const chatEmptyState = document.getElementById("chatEmptyState");
const chatActive = document.getElementById("chatActive");
const chatHeader = document.getElementById("chatHeader");
const chatThread = document.getElementById("chatThread");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

let allCharacters = [];       // raw records from the API
let activeCharacter = null;    // merged-with-override record currently open
let showHidden = false;
let isFirstMessageInThisChat = false; // whether to inject the AI-context prefix on next send
let openDropdownId = null;

logoutBtn.addEventListener("click", () => Auth.logout());

// ---------- Sidebar collapse (desktop only) ----------

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
const collapseSidebarBtn = document.getElementById("collapseSidebarBtn");

function applySidebarCollapsed(collapsed) {
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  collapseSidebarBtn.innerHTML = collapsed ? "&raquo;" : "&laquo;";
  collapseSidebarBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
}

let sidebarCollapsed = false;
try {
  sidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
} catch (_) { /* storage unavailable */ }
applySidebarCollapsed(sidebarCollapsed);

collapseSidebarBtn.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  applySidebarCollapsed(sidebarCollapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
  } catch (_) { /* storage unavailable */ }
});

// ---------- Rendering the sidebar ----------

function renderContactList(filterText = "") {
  const q = filterText.trim().toLowerCase();

  const merged = allCharacters.map(withOverride);
  const visible = merged.filter((c) => (showHidden ? true : !c.hidden));
  const filtered = q ? visible.filter((c) => c.name.toLowerCase().includes(q)) : visible;

  const hiddenCount = merged.filter((c) => c.hidden).length;
  if (hiddenCount > 0) {
    toggleHiddenBtn.style.display = "inline-block";
    toggleHiddenBtn.textContent = showHidden
      ? "Hide the hidden characters again"
      : `Show ${hiddenCount} hidden character${hiddenCount > 1 ? "s" : ""}`;
  } else {
    toggleHiddenBtn.style.display = "none";
  }

  contactList.innerHTML = "";
  filtered.forEach((c) => {
    const row = document.createElement("div");
    row.className = "contact-row";
    row.dataset.characterId = c.id;
    if (activeCharacter && activeCharacter.id === c.id) row.classList.add("active");
    if (c.hidden) row.style.opacity = "0.5";

    row.innerHTML = `
      ${avatarHtml(c.name, c.avatar_url, 48)}
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(c.name)}</div>
        <div class="contact-preview">${escapeHtml(c.description || "Tap to start chatting")}</div>
      </div>
      <button class="icon-btn contact-menu-btn" aria-label="Chat options">&#8942;</button>
      <div class="contact-dropdown" data-menu-for="${c.id}">
        <button data-action="edit">Edit character</button>
        ${c.hidden
          ? '<button data-action="unhide">Unhide chat</button>'
          : '<button data-action="hide" class="danger">Hide chat</button>'}
      </div>
    `;

    row.addEventListener("click", (e) => {
      if (e.target.closest(".contact-menu-btn") || e.target.closest(".contact-dropdown")) return;
      openCharacter(c.id);
    });

    const menuBtn = row.querySelector(".contact-menu-btn");
    const dropdown = row.querySelector(".contact-dropdown");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.add("open");
        menuBtn.classList.add("open");
        openDropdownId = c.id;
      }
    });

    dropdown.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      openEditModal(c);
    });

    const hideBtn = dropdown.querySelector('[data-action="hide"], [data-action="unhide"]');
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      saveCharacterOverride(c.id, { hidden: !c.hidden });
      renderContactList(searchInput.value);
    });

    contactList.appendChild(row);
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".contact-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".contact-menu-btn.open").forEach((b) => b.classList.remove("open"));
  openDropdownId = null;
}

document.addEventListener("click", () => closeAllDropdowns());

toggleHiddenBtn.addEventListener("click", () => {
  showHidden = !showHidden;
  renderContactList(searchInput.value);
});

searchInput.addEventListener("input", () => renderContactList(searchInput.value));

// ---------- Edit character modal ----------

const editModal = document.getElementById("editModal");
const editBackdrop = document.getElementById("editBackdrop");
const editCharacterForm = document.getElementById("editCharacterForm");

const editAvatarPicker = setupAvatarPicker({
  fileInput: document.getElementById("editAvatarFile"),
  previewEl: document.getElementById("editAvatarPreview"),
  removeBtn: document.getElementById("removeEditAvatarBtn"),
  getName: () => document.getElementById("editDisplayName").value.trim() || "?",
  initialDataUrl: null,
  onChange: () => {},
});

document.getElementById("chooseEditAvatarBtn").addEventListener("click", () => {
  document.getElementById("editAvatarFile").click();
});

function openEditModal(character) {
  document.getElementById("editCharacterId").value = character.id;
  document.getElementById("editDisplayName").value = character.name;
  editAvatarPicker.setValue(getCharacterOverride(character.id)?.avatarUrl || null);
  document.getElementById("editExtraPersonality").value = character.extraPersonality || "";
  editModal.style.display = "flex";
  editBackdrop.style.display = "block";
}

function closeEditModal() {
  editModal.style.display = "none";
  editBackdrop.style.display = "none";
}

document.getElementById("editCloseBtn").addEventListener("click", closeEditModal);
editBackdrop.addEventListener("click", closeEditModal);

editCharacterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("editCharacterId").value;
  const original = allCharacters.find((c) => String(c.id) === String(id));
  const displayName = document.getElementById("editDisplayName").value.trim();

  saveCharacterOverride(id, {
    displayName: original && displayName === original.name ? "" : displayName,
    avatarUrl: editAvatarPicker.getValue(),
    extraPersonality: document.getElementById("editExtraPersonality").value.trim(),
  });

  closeEditModal();
  renderContactList(searchInput.value);
  if (activeCharacter && String(activeCharacter.id) === String(id)) {
    openCharacter(id); // refresh the open chat header with the new override
  }
});

document.getElementById("resetOverrideBtn").addEventListener("click", () => {
  const id = document.getElementById("editCharacterId").value;
  clearCharacterOverride(id);
  closeEditModal();
  renderContactList(searchInput.value);
  if (activeCharacter && String(activeCharacter.id) === String(id)) {
    openCharacter(id);
  }
});

// ---------- Chat pane ----------

function scrollToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

function appendMessage(role, content) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = content;

  if (role === "assistant" && activeCharacter) {
    row.innerHTML += avatarHtml(activeCharacter.name, activeCharacter.avatar_url, 26);
    row.appendChild(bubble);
  } else if (role === "user") {
    row.appendChild(bubble);
    const profile = getUserProfile();
    row.innerHTML += avatarHtml(profile.name || "You", profile.avatarUrl, 26);
  } else {
    row.appendChild(bubble);
  }

  chatThread.appendChild(row);
  scrollToBottom();
}

async function openCharacter(characterId) {
  let raw;
  try {
    raw = await apiFetch(`/api/characters/${characterId}`);
  } catch (err) {
    return;
  }
  activeCharacter = withOverride(raw);

  window.location.hash = `character_id=${characterId}`;
  appShell.classList.add("chat-open");
  chatEmptyState.style.display = "none";
  chatActive.style.display = "flex";

  chatHeader.innerHTML = `
    <div class="chat-header-avatar">${avatarHtml(activeCharacter.name, activeCharacter.avatar_url, 72)}</div>
    <div class="chat-header-meta">
      <div class="chat-header-top">
        <div>
          <div class="chat-header-name">${escapeHtml(activeCharacter.name)}</div>
          <div class="chat-header-description">${escapeHtml(activeCharacter.description || "A vivid character ready to chat.")}</div>
        </div>
        <div class="chat-header-status" id="chatStatus">online</div>
      </div>
    </div>
  `;

  renderContactList(searchInput.value);
  chatThread.innerHTML = "";
  chatInput.value = "";
  chatInput.focus();

  try {
    const history = await apiFetch(`/api/chats/${characterId}/messages`, { auth: true });
    isFirstMessageInThisChat = history.length === 0;
    history.forEach((m) => appendMessage(m.role, m.content));
  } catch (err) {
    appendMessage("assistant", `(Couldn't load history: ${err.message})`);
  }
}

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeCharacter) return;
  const typedMessage = chatInput.value.trim();
  if (!typedMessage) return;

  // Show exactly what the user typed in their own bubble...
  appendMessage("user", typedMessage);
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;
  const statusEl = document.getElementById("chatStatus");
  if (statusEl) {
    statusEl.textContent = "typing…";
    statusEl.classList.add("typing");
  }

  // ...but send a prefixed version to the API on the first message of a new
  // conversation, so the character gets the "about you" context. This does
  // mean the prefix becomes part of the saved chat history on the server.
  let messageToSend = typedMessage;
  if (isFirstMessageInThisChat) {
    const prefix = buildContextPrefix(activeCharacter.extraPersonality);
    messageToSend = prefix + typedMessage;
  }
  isFirstMessageInThisChat = false;

  try {
    const data = await apiFetch("/api/chat", {
      method: "POST",
      auth: true,
      body: { character_id: activeCharacter.id, message: messageToSend },
    });
    appendMessage("assistant", data.reply);
  } catch (err) {
    appendMessage("assistant", `(Something went wrong: ${err.message})`);
  } finally {
    if (statusEl) {
      statusEl.textContent = "online";
      statusEl.classList.remove("typing");
    }
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// ---------- Init / routing ----------

function getCharacterIdFromHash() {
  const match = window.location.hash.match(/character_id=(\d+)/);
  return match ? Number(match[1]) : null;
}

async function init() {
  try {
    allCharacters = await apiFetch("/api/characters");
  } catch (err) {
    contactList.innerHTML = `<div class="banner error" style="margin:16px;">Couldn't load characters: ${escapeHtml(err.message)}</div>`;
    return;
  }
  renderContactList();

  const hashId = getCharacterIdFromHash();
  if (hashId) {
    openCharacter(hashId);
  }
}

window.addEventListener("hashchange", () => {
  const hashId = getCharacterIdFromHash();
  if (hashId && (!activeCharacter || activeCharacter.id !== hashId)) {
    openCharacter(hashId);
  } else if (!hashId) {
    appShell.classList.remove("chat-open");
  }
});

init();
