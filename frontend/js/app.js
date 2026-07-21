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

// ---------- Pinned characters (max 5) ----------

const PINNED_KEY = "pinnedCharacters";

function getPinned() {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY)) || []; } catch (_) { return []; }
}

function savePinned(arr) {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(arr)); } catch (_) {}
}

function isPinned(id) {
  return getPinned().includes(String(id));
}

function togglePin(id) {
  const pinned = getPinned();
  const sid = String(id);
  if (pinned.includes(sid)) {
    savePinned(pinned.filter((x) => x !== sid));
    return false;
  } else {
    if (pinned.length >= 5) {
      showToast("You can only pin up to 5 characters.");
      return false;
    }
    savePinned([...pinned, sid]);
    return true;
  }
}

// ---------- Recent chat order ----------

const RECENT_KEY = "recentChatOrder";

function getRecentOrder() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (_) { return []; }
}

function bumpRecent(id) {
  const sid = String(id);
  const order = getRecentOrder().filter((x) => x !== sid);
  order.unshift(sid);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(order.slice(0, 100))); } catch (_) {}
}

// ---------- Toast (WhatsApp-style — no browser confirm) ----------

function showToast(msg, duration = 3000) {
  let t = document.getElementById("appToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "appToast";
    t.style.cssText = `
      position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:rgba(30,30,40,0.96);color:#fff;padding:11px 22px;
      border-radius:999px;font-size:0.88rem;z-index:9999;
      box-shadow:0 4px 24px rgba(0,0,0,0.38);pointer-events:none;
      transition:opacity 0.25s ease;white-space:nowrap;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = "0"; }, duration);
}

// ---------- Custom delete confirmation (no browser confirm()) ----------

function showDeleteConfirm(characterName, onConfirm) {
  // Remove any existing
  document.getElementById("deleteConfirmOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "deleteConfirmOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:5000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--bg-panel);border:1px solid var(--border-mid);
      border-radius:18px;padding:28px 28px 22px;max-width:320px;width:90%;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;
    ">
      <div style="font-size:2rem;margin-bottom:12px;">🗑️</div>
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px;color:var(--text);">Delete character?</div>
      <div style="color:var(--text-dim);font-size:0.88rem;margin-bottom:22px;line-height:1.5;">
        "<strong>${escapeHtml(characterName)}</strong>" and all its chats will be permanently removed.
      </div>
      <div style="display:flex;gap:10px;">
        <button id="deleteCancelBtn" style="
          flex:1;padding:11px;border-radius:999px;border:1px solid var(--border-mid);
          background:var(--bg-panel-mid);color:var(--text);font-weight:600;cursor:pointer;font-size:0.9rem;
        ">Cancel</button>
        <button id="deleteConfirmBtn" style="
          flex:1;padding:11px;border-radius:999px;border:none;
          background:#f04f5f;color:#fff;font-weight:700;cursor:pointer;font-size:0.9rem;
        ">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#deleteCancelBtn").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#deleteConfirmBtn").addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

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

// ---------- Mobile sidebar — WhatsApp style ----------

function openMobileSidebar() {
  appShell.classList.remove("chat-open");
}

function closeMobileSidebar() {}

// ---------- Touch swipe on sidebar — swipe left to open chat, swipe right to show sidebar ----------

(function setupSwipe() {
  let startX = 0, startY = 0;
  const THRESHOLD = 60;

  document.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // mostly vertical — ignore
    if (Math.abs(dx) < THRESHOLD) return;

    if (dx < 0) {
      // Swipe LEFT on sidebar → open chat (if a character is active)
      if (!appShell.classList.contains("chat-open") && activeCharacter) {
        appShell.classList.add("chat-open");
      }
    } else {
      // Swipe RIGHT on chat → go back to sidebar
      if (appShell.classList.contains("chat-open")) {
        appShell.classList.remove("chat-open");
      }
    }
  }, { passive: true });
})();

// ---------- Sidebar contact list ----------

function getSortedCharacters() {
  const pinned   = getPinned();
  const recent   = getRecentOrder();
  const merged   = allCharacters.map(withOverride);
  const visible  = merged.filter((c) => showHidden ? true : !c.hidden);

  const pinnedList   = visible.filter((c) => pinned.includes(String(c.id)));
  const unpinnedList = visible.filter((c) => !pinned.includes(String(c.id)));

  // Sort unpinned by recent chat order
  unpinnedList.sort((a, b) => {
    const ai = recent.indexOf(String(a.id));
    const bi = recent.indexOf(String(b.id));
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return { pinnedList, unpinnedList, merged };
}

function renderContactList(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const { pinnedList, unpinnedList, merged } = getSortedCharacters();

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

  const allVisible = [...pinnedList, ...unpinnedList];
  const filtered   = q ? allVisible.filter((c) => c.name.toLowerCase().includes(q)) : allVisible;

  if (filtered.length === 0) {
    contactList.innerHTML = `<div style="padding:14px 8px; color:var(--text-muted); font-size:0.84rem; text-align:center;">
      ${q ? "No characters match your search." : "No characters yet. Create one!"}
    </div>`;
    return;
  }

  // Pinned section header
  const filteredPinned   = q ? pinnedList.filter((c)   => c.name.toLowerCase().includes(q)) : pinnedList;
  const filteredUnpinned = q ? unpinnedList.filter((c) => c.name.toLowerCase().includes(q)) : unpinnedList;

  if (!q && filteredPinned.length > 0) {
    const header = document.createElement("div");
    header.className = "contact-section-header";
    header.textContent = "📌 Pinned";
    contactList.appendChild(header);
  }

  filteredPinned.forEach((c)   => contactList.appendChild(buildContactRow(c, true)));

  if (!q && filteredPinned.length > 0 && filteredUnpinned.length > 0) {
    const header = document.createElement("div");
    header.className = "contact-section-header";
    header.textContent = "All characters";
    contactList.appendChild(header);
  }

  filteredUnpinned.forEach((c) => contactList.appendChild(buildContactRow(c, false)));
}

function buildContactRow(c, pinned) {
  const row = document.createElement("div");
  row.className = "contact-row";
  row.dataset.characterId = c.id;
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");
  row.setAttribute("aria-label", `Chat with ${c.name}`);

  if (activeCharacter && String(activeCharacter.id) === String(c.id)) row.classList.add("active");
  if (c.hidden) row.style.opacity = "0.5";

  // Avatar: use placeholder image if avatar_url is null/undefined
  const avatarSrc = c.avatar_url || `avatars/${c.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.jpg`;

  row.innerHTML = `
    ${avatarHtml(c.name, c.avatar_url, 44)}
    <div class="contact-info">
      <div class="contact-name">
        ${pinned ? '<span class="pin-badge">📌</span>' : ""}
        ${escapeHtml(c.name)}
      </div>
      <div class="contact-preview">${escapeHtml(c.description || "Tap to start chatting")}</div>
    </div>
    <button class="icon-btn contact-menu-btn" aria-label="Character options" aria-haspopup="true">&#8942;</button>
    <div class="contact-dropdown" data-menu-for="${c.id}" role="menu">
      <button data-action="pin" role="menuitem">${pinned ? "Unpin" : "Pin"}</button>
      <button data-action="edit" role="menuitem">Edit character</button>
      ${c.hidden
        ? `<button data-action="unhide" role="menuitem">Unhide</button>`
        : `<button data-action="hide" role="menuitem">Hide from list</button>`
      }
      <button data-action="delete" class="danger" role="menuitem">Delete character</button>
    </div>
  `;

  row.addEventListener("click", (e) => {
    if (e.target.closest(".contact-menu-btn") || e.target.closest(".contact-dropdown")) return;
    openCharacter(c.id);
  });

  row.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.target.closest(".contact-menu-btn")) {
      e.preventDefault();
      openCharacter(c.id);
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

  dropdown.querySelector('[data-action="pin"]').addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    const nowPinned = togglePin(c.id);
    showToast(nowPinned ? `📌 ${c.name} pinned` : `${c.name} unpinned`);
    renderContactList(searchInput.value);
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

  dropdown.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    showDeleteConfirm(c.name, async () => {
      try {
        const token = Auth.getToken();
        const base  = (typeof API_BASE !== "undefined" ? API_BASE : "").replace(/\/$/, "");
        const res   = await fetch(`${base}/api/characters/${c.id}`, {
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
        showToast(`${c.name} deleted`);
        renderContactList(searchInput.value);
      } catch (err) {
        showBannerError(`Couldn't delete character: ${err.message}`);
      }
    });
  });

  return row;
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
  if (typingRow) { typingRow.remove(); typingRow = null; }
}

// ---------- Chat pane ----------

function scrollToBottom() {
  requestAnimationFrame(() => { chatThread.scrollTop = chatThread.scrollHeight; });
}

function appendMessage(role, content) {
  const row    = document.createElement("div");
  row.className = `msg-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className  = "msg-bubble";
  bubble.textContent = content;

  if (role === "assistant" && activeCharacter) {
    row.appendChild((() => {
      const div = document.createElement("div");
      div.innerHTML = avatarHtml(activeCharacter.name, activeCharacter.avatar_url, 30);
      return div.firstElementChild;
    })());
    row.appendChild(bubble);
  } else if (role === "user") {
    const profile = getUserProfile();
    row.appendChild(bubble);
    row.appendChild((() => {
      const div = document.createElement("div");
      div.innerHTML = avatarHtml(profile.name || "You", profile.avatarUrl, 30);
      return div.firstElementChild;
    })());
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
  bumpRecent(characterId); // move to top of recent list
  renderContactList(searchInput.value); // re-render so order updates

  window.location.hash = `character_id=${characterId}`;
  chatEmptyState.style.display = "none";
  chatActive.style.display     = "flex";
  appShell.classList.add("chat-open");

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

  chatHeader.querySelector(".chat-back-btn").addEventListener("click", () => {
    window.location.hash = "";
    chatEmptyState.style.display = "flex";
    chatActive.style.display     = "none";
    activeCharacter              = null;
    appShell.classList.remove("chat-open");
    renderContactList(searchInput.value);
  });

  chatThread.innerHTML   = "";
  chatInput.value        = "";
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
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(); }
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
    bumpRecent(activeCharacter.id); // bump again after reply so it stays on top
    renderContactList(searchInput.value);
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
    b.id = "appErrorBanner";
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeAllDropdowns(); }
});

init();
