// app.js - drives index.html (two-pane app shell)

Auth.requireLogin();

const appShell       = document.getElementById("appShell");
const contactList    = document.getElementById("contactList");
const searchInput    = document.getElementById("searchInput");
const logoutBtn      = document.getElementById("logoutBtn");
const toggleHiddenBtn= document.getElementById("toggleHiddenBtn");
const newChatBtn     = document.getElementById("newChatBtn");

const chatEmptyState = document.getElementById("chatEmptyState");
const chatActive     = document.getElementById("chatActive");
const chatHeader     = document.getElementById("chatHeader");
const chatThread     = document.getElementById("chatThread");
const chatForm       = document.getElementById("chatForm");
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");

let allCharacters             = [];
let activeCharacter           = null;
let showHidden                = false;
let isFirstMessageInThisChat  = false;
let openDropdownId            = null;
let typingRow                 = null;

// ---------- Logout ----------

logoutBtn.addEventListener("click", () => Auth.logout());

// ---------- New chat → create character page ----------

newChatBtn.addEventListener("click", () => {
  window.location.href = "create-character.html";
});

// ---------- Sidebar collapse (desktop) ----------

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
const collapseSidebarBtn    = document.getElementById("collapseSidebarBtn");

function applySidebarCollapsed(collapsed) {
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  collapseSidebarBtn.innerHTML = collapsed ? "&raquo;" : "&laquo;";
  collapseSidebarBtn.title     = collapsed ? "Expand sidebar" : "Collapse sidebar";
  collapseSidebarBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
}

let sidebarCollapsed = false;
try { sidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch (_) {}
applySidebarCollapsed(sidebarCollapsed);

collapseSidebarBtn.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  applySidebarCollapsed(sidebarCollapsed);
  try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0"); } catch (_) {}
});

// ---------- Mobile sidebar ----------

// Mobile: WhatsApp-style — chat-open class slides sidebar out, chat pane in
function openMobileSidebar() {
  appShell.classList.remove("chat-open");
}

function closeMobileSidebar() {
  // On mobile, "closing sidebar" means opening the chat — handled by openCharacter
  // This is called when navigating back; no-op here since chat-open drives it
}

// ---------- Sidebar contact list ----------

function renderContactList(filterText = "") {
  const q = filterText.trim().toLowerCase();

  const merged  = allCharacters.map(withOverride);
  const visible = merged.filter((c) => showHidden ? true : !c.hidden);
  const filtered = q
    ? visible.filter((c) => c.name.toLowerCase().includes(q))
    : visible;

  const hiddenCount = merged.filter((c) => c.hidden).length;
  if (hiddenCount > 0) {
    toggleHiddenBtn.style.display = "inline-block";
    toggleHiddenBtn.textContent = showHidden
      ? "Hide hidden characters"
      : `Show ${hiddenCount} hidden character${hiddenCount > 1 ? "s" : ""}`;
  } else {
    toggleHiddenBtn.style.display = "none";
  }

  contactList.innerHTML = "";

  if (filtered.length === 0) {
    contactList.innerHTML = `<div style="padding:14px 8px; color:var(--text-muted); font-size:0.84rem; text-align:center;">
      ${q ? "No characters match your search." : "No characters yet. Create one!"}
    </div>`;
    return;
  }

  filtered.forEach((c) => {
    const row = document.createElement("div");
    row.className = "contact-row";
    row.dataset.characterId = c.id;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", `Chat with ${c.name}`);

    if (activeCharacter && String(activeCharacter.id) === String(c.id)) row.classList.add("active");
    if (c.hidden) row.style.opacity = "0.5";

    row.innerHTML = `
      ${avatarHtml(c.name, c.avatar_url, 44)}
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(c.name)}</div>
        <div class="contact-preview">${escapeHtml(c.description || "Tap to start chatting")}</div>
      </div>
      <button class="icon-btn contact-menu-btn" aria-label="Character options" aria-haspopup="true">&#8942;</button>
      <div class="contact-dropdown" data-menu-for="${c.id}" role="menu">
        <button data-action="edit" role="menuitem">Edit character</button>
        ${c.hidden
          ? `<button data-action="unhide" role="menuitem">Unhide</button>`
          : `<button data-action="hide" role="menuitem">Hide from list</button>`
        }
        <button data-action="delete" class="danger" role="menuitem">Delete character</button>
      </div>
    `;

    // Click on row → open character (not menu areas)
    row.addEventListener("click", (e) => {
      if (e.target.closest(".contact-menu-btn") || e.target.closest(".contact-dropdown")) return;
      openCharacter(c.id);
      closeMobileSidebar();
    });

    // Keyboard support
    row.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.target.closest(".contact-menu-btn")) {
        e.preventDefault();
        openCharacter(c.id);
        closeMobileSidebar();
      }
    });

    const menuBtn  = row.querySelector(".contact-menu-btn");
    const dropdown = row.querySelector(".contact-dropdown");

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.add("open");
        menuBtn.classList.add("open");
        menuBtn.setAttribute("aria-expanded", "true");
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

    const deleteBtn = dropdown.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      if (!confirm(`Delete "${c.name}"? This will permanently remove the character and all its chats.`)) return;
      try {
        const token = Auth.getToken();
        // Resolve the base URL the same way api.js does (works for both local and deployed)
        const base = (typeof API_BASE !== "undefined" ? API_BASE : "").replace(/\/$/, "");
        const res = await fetch(`${base}/api/characters/${c.id}`, {
          method: "DELETE",
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          let msg = `Server error ${res.status}`;
          try { const j = await res.json(); msg = j.detail || msg; } catch (_) {}
          throw new Error(msg);
        }
        allCharacters = allCharacters.filter((ch) => String(ch.id) !== String(c.id));
        clearCharacterOverride(c.id);
        if (activeCharacter && String(activeCharacter.id) === String(c.id)) {
          window.location.hash = "";
          chatEmptyState.style.display = "flex";
          chatActive.style.display     = "none";
          activeCharacter              = null;
          appShell.classList.remove("chat-open");
        }
        renderContactList(searchInput.value);
      } catch (err) {
        showBannerError(`Couldn't delete character: ${err.message}`);
      }
    });

    contactList.appendChild(row);
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".contact-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".contact-menu-btn.open").forEach((b) => {
    b.classList.remove("open");
    b.setAttribute("aria-expanded", "false");
  });
  openDropdownId = null;
}

document.addEventListener("click", closeAllDropdowns);

toggleHiddenBtn.addEventListener("click", () => {
  showHidden = !showHidden;
  renderContactList(searchInput.value);
});

searchInput.addEventListener("input", () => renderContactList(searchInput.value));

// ---------- Edit character modal ----------

const editModal          = document.getElementById("editModal");
const editBackdrop       = document.getElementById("editBackdrop");
const editCharacterForm  = document.getElementById("editCharacterForm");

const editAvatarPicker = setupAvatarPicker({
  fileInput:      document.getElementById("editAvatarFile"),
  previewEl:      document.getElementById("editAvatarPreview"),
  removeBtn:      document.getElementById("removeEditAvatarBtn"),
  getName:        () => document.getElementById("editDisplayName").value.trim() || "?",
  initialDataUrl: null,
  onChange:       () => {},
});

document.getElementById("chooseEditAvatarBtn").addEventListener("click", () => {
  document.getElementById("editAvatarFile").click();
});

function openEditModal(character) {
  document.getElementById("editCharacterId").value       = character.id;
  document.getElementById("editDisplayName").value       = character.name;
  document.getElementById("editExtraPersonality").value  = character.extraPersonality || "";
  editAvatarPicker.setValue(getCharacterOverride(character.id)?.avatarUrl || null);
  editModal.style.display   = "flex";
  editBackdrop.style.display = "block";
}

function closeEditModal() {
  editModal.style.display   = "none";
  editBackdrop.style.display = "none";
}

document.getElementById("editCloseBtn").addEventListener("click", closeEditModal);
editBackdrop.addEventListener("click", closeEditModal);

editCharacterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id          = document.getElementById("editCharacterId").value;
  const original    = allCharacters.find((c) => String(c.id) === String(id));
  const displayName = document.getElementById("editDisplayName").value.trim();

  saveCharacterOverride(id, {
    displayName:      original && displayName === original.name ? "" : displayName,
    avatarUrl:        editAvatarPicker.getValue(),
    extraPersonality: document.getElementById("editExtraPersonality").value.trim(),
  });

  closeEditModal();
  renderContactList(searchInput.value);
  if (activeCharacter && String(activeCharacter.id) === String(id)) {
    openCharacter(id);
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

// ---------- Typing indicator ----------

function showTypingIndicator() {
  removeTypingIndicator();
  typingRow = document.createElement("div");
  typingRow.className = "msg-row assistant";
  typingRow.innerHTML = `
    ${avatarHtml(activeCharacter?.name || "AI", activeCharacter?.avatar_url, 30)}
    <div class="typing-indicator" aria-label="Character is typing">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatThread.appendChild(typingRow);
  scrollToBottom();
}

function removeTypingIndicator() {
  if (typingRow) {
    typingRow.remove();
    typingRow = null;
  }
}

// ---------- Chat pane ----------

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatThread.scrollTop = chatThread.scrollHeight;
  });
}

function appendMessage(role, content) {
  const row    = document.createElement("div");
  row.className = `msg-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className  = "msg-bubble";
  bubble.textContent = content;

  if (role === "assistant" && activeCharacter) {
    row.appendChild(
      (() => {
        const div = document.createElement("div");
        div.innerHTML = avatarHtml(activeCharacter.name, activeCharacter.avatar_url, 30);
        return div.firstElementChild;
      })()
    );
    row.appendChild(bubble);
  } else if (role === "user") {
    const profile = getUserProfile();
    row.appendChild(bubble);
    row.appendChild(
      (() => {
        const div = document.createElement("div");
        div.innerHTML = avatarHtml(profile.name || "You", profile.avatarUrl, 30);
        return div.firstElementChild;
      })()
    );
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
    showBannerError(`Couldn't load character: ${err.message}`);
    return;
  }
  activeCharacter = withOverride(raw);

  window.location.hash = `character_id=${characterId}`;
  chatEmptyState.style.display = "none";
  chatActive.style.display     = "flex";
  appShell.classList.add("chat-open"); // WhatsApp-style: show chat pane on mobile

  // Build header (includes back button for mobile)
  chatHeader.innerHTML = `
    <button class="icon-btn chat-back-btn" aria-label="Back to characters">&#8592;</button>
    <div class="chat-header-avatar">${avatarHtml(activeCharacter.name, activeCharacter.avatar_url, 52)}</div>
    <div class="chat-header-meta">
      <div class="chat-header-top">
        <div style="min-width:0;">
          <div class="chat-header-name">${escapeHtml(activeCharacter.name)}</div>
          <div class="chat-header-description">${escapeHtml(activeCharacter.description || "Ready to chat.")}</div>
        </div>
        <div class="chat-header-status" id="chatStatus">online</div>
      </div>
    </div>
  `;

  // Back button wires up after render
  chatHeader.querySelector(".chat-back-btn").addEventListener("click", () => {
    window.location.hash = "";
    chatEmptyState.style.display = "flex";
    chatActive.style.display     = "none";
    activeCharacter              = null;
    appShell.classList.remove("chat-open"); // WhatsApp-style: go back to sidebar
    renderContactList(searchInput.value);
  });

  renderContactList(searchInput.value);
  chatThread.innerHTML = "";
  chatInput.value      = "";
  chatInput.style.height = "auto";
  chatInput.focus();

  try {
    const history = await apiFetch(`/api/chats/${characterId}/messages`, { auth: true });
    isFirstMessageInThisChat = history.length === 0;
    history.forEach((m) => appendMessage(m.role, m.content));
  } catch (err) {
    appendMessage("assistant", `(Couldn't load history: ${err.message})`);
  }
}

// ---------- Chat input ----------

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 130)}px`;
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

  appendMessage("user", typedMessage);
  chatInput.value        = "";
  chatInput.style.height = "auto";
  sendBtn.disabled       = true;

  const statusEl = document.getElementById("chatStatus");
  if (statusEl) { statusEl.textContent = "typing…"; statusEl.classList.add("typing"); }

  showTypingIndicator();

  let messageToSend = typedMessage;
  if (isFirstMessageInThisChat) {
    const prefix = buildContextPrefix(activeCharacter.extraPersonality);
    messageToSend = prefix + typedMessage;
  }
  isFirstMessageInThisChat = false;

  try {
    const data = await apiFetch("/api/chat", {
      method: "POST",
      auth:   true,
      body:   { character_id: activeCharacter.id, message: messageToSend },
    });
    removeTypingIndicator();
    appendMessage("assistant", data.reply);
  } catch (err) {
    removeTypingIndicator();
    appendMessage("assistant", `(Something went wrong: ${err.message})`);
  } finally {
    if (statusEl) { statusEl.textContent = "online"; statusEl.classList.remove("typing"); }
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// ---------- Error banner helper ----------

function showBannerError(msg) {
  let b = document.getElementById("appErrorBanner");
  if (!b) {
    b = document.createElement("div");
    b.id        = "appErrorBanner";
    b.className = "banner error";
    b.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:100;max-width:480px;min-width:240px;";
    document.body.appendChild(b);
  }
  b.textContent = msg;
  b.style.display = "block";
  clearTimeout(b._timer);
  b._timer = setTimeout(() => { b.style.display = "none"; }, 5000);
}

// ---------- Init / routing ----------

function getCharacterIdFromHash() {
  const match = window.location.hash.match(/character_id=(\d+)/);
  return match ? Number(match[1]) : null;
}

async function init() {
  try {
    allCharacters = await apiFetch("/api/characters");
  } catch (err) {
    contactList.innerHTML = `<div class="banner error" style="margin:12px 4px;">Couldn't load characters: ${escapeHtml(err.message)}</div>`;
    return;
  }
  renderContactList();

  const hashId = getCharacterIdFromHash();
  if (hashId) openCharacter(hashId);
}

window.addEventListener("hashchange", () => {
  const hashId = getCharacterIdFromHash();
  if (hashId && (!activeCharacter || String(activeCharacter.id) !== String(hashId))) {
    openCharacter(hashId);
  } else if (!hashId) {
    chatEmptyState.style.display = "flex";
    chatActive.style.display     = "none";
    activeCharacter              = null;
    appShell.classList.remove("chat-open");
    renderContactList(searchInput.value);
  }
});

// Keyboard: Escape closes dropdowns / modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllDropdowns();
    closeMobileSidebar();
  }
});

init();
