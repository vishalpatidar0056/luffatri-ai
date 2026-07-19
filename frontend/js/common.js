// common.js - small shared UI helpers used across pages.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// A small fixed set of gradient pairs so each character/person gets a
// consistent, distinct look (hashed from its name) instead of everyone
// getting the same default circle.
const AVATAR_GRADIENTS = [
  ["#7f66ff", "#00c2ff"],
  ["#00a884", "#00e0b8"],
  ["#ff6f61", "#ffb26b"],
  ["#3b82f6", "#60a5fa"],
  ["#e0a52c", "#ffd76b"],
  ["#ec4899", "#f472b6"],
  ["#10b981", "#34d399"],
  ["#f97316", "#fbbf24"],
  ["#8b5cf6", "#a78bfa"],
  ["#06b6d4", "#67e8f9"],
];

function gradientForName(name) {
  const str = name || "?";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [c1, c2] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

/**
 * Renders an avatar: the character/person's avatar_url image if one is set
 * (falling back gracefully if the image fails to load), otherwise a
 * gradient circle with their initial.
 */
function avatarHtml(name, avatarUrl, sizePx = 48) {
  const safeName = (name || "?").trim();
  const initial = escapeHtml(safeName.charAt(0).toUpperCase() || "?");
  const bg = gradientForName(safeName);
  const fontSize = Math.round(sizePx * 0.42);

  if (avatarUrl) {
    const safeUrl = escapeHtml(avatarUrl);
    // If the image fails to load (broken link, blocked host, etc.), swap the
    // element for the initials fallback instead of showing a broken-image icon.
    return `
      <div class="avatar" style="width:${sizePx}px;height:${sizePx}px;background:${bg};font-size:${fontSize}px;">
        <img src="${safeUrl}" alt=""
             onerror="this.replaceWith(Object.assign(document.createElement('span'), {textContent: '${initial}'}));" />
      </div>
    `;
  }

  return `
    <div class="avatar" style="width:${sizePx}px;height:${sizePx}px;background:${bg};font-size:${fontSize}px;">
      ${initial}
    </div>
  `;
}

/**
 * Reads an image File, downsizes it on a canvas, and returns a compressed
 * JPEG data URL - small enough to store in localStorage (for profile /
 * personal overrides) or in the backend's TEXT column (for shared character
 * photos), without needing any file-upload endpoint at all.
 *
 * Progressively lowers quality if the first attempt is still too large.
 * Throws if it can't get under maxChars even at low quality (very busy /
 * huge source images) - the caller should show that message to the user.
 */
async function fileToResizedDataUrl(file, { maxDim = 220, startQuality = 0.82, maxChars = 60000 } = {}) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't read that image file."));
    el.src = URL.createObjectURL(file);
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // flattens any transparency (PNG/GIF) onto white
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  let quality = startQuality;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let attempts = 0;
  while (dataUrl.length > maxChars && attempts < 5) {
    quality = Math.max(0.15, quality - 0.15);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    attempts++;
  }

  if (dataUrl.length > maxChars) {
    throw new Error("This image is too complex to compress small enough - try a simpler or smaller photo.");
  }
  return dataUrl;
}

/**
 * Wires up a "choose from device" avatar picker: hidden file input + a live
 * preview circle + a remove button. Calls onChange(dataUrlOrNull) whenever
 * the photo changes. Used on the create-character page, the profile
 * settings tab, and the per-character edit modal.
 */
function setupAvatarPicker({ fileInput, previewEl, removeBtn, getName, initialDataUrl, onChange }) {
  let current = initialDataUrl || null;

  function render() {
    previewEl.innerHTML = avatarHtml(getName(), current, 72);
    removeBtn.style.display = current ? "inline-flex" : "none";
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      current = await fileToResizedDataUrl(file);
      render();
      onChange(current);
    } catch (err) {
      alert(err.message);
    } finally {
      fileInput.value = "";
    }
  });

  removeBtn.addEventListener("click", () => {
    current = null;
    render();
    onChange(null);
  });

  render();
  return {
    getValue: () => current,
    setValue: (dataUrl) => {
      current = dataUrl || null;
      render();
    },
    refresh: () => render(),
  };
}
