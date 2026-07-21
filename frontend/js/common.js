// common.js - shared UI helpers used across pages.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Consistent gradient per-name (hashed)
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
 * Returns an avatar HTML string.
 * If avatarUrl is set, renders an <img> with a fallback to the initial.
 */
function avatarHtml(name, avatarUrl, sizePx = 48) {
  const safeName = (name || "?").trim();
  const initial  = escapeHtml(safeName.charAt(0).toUpperCase() || "?");
  const bg       = gradientForName(safeName);
  const fontSize = Math.round(sizePx * 0.42);

  if (avatarUrl) {
    const safeUrl = escapeHtml(avatarUrl);
    return `<div class="avatar" style="width:${sizePx}px;height:${sizePx}px;background:${bg};font-size:${fontSize}px;" aria-hidden="true">
      <img src="${safeUrl}" alt=""
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';" />
      <span style="display:none;">${initial}</span>
    </div>`;
  }

  return `<div class="avatar" style="width:${sizePx}px;height:${sizePx}px;background:${bg};font-size:${fontSize}px;" aria-hidden="true">${initial}</div>`;
}

/**
 * Reads an image File, downsizes it on a canvas, and returns a compressed
 * JPEG data URL small enough for localStorage / backend TEXT column.
 */
async function fileToResizedDataUrl(file, { maxDim = 220, startQuality = 0.82, maxChars = 60000 } = {}) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't read that image file."));
    el.src = URL.createObjectURL(file);
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w     = Math.max(1, Math.round(img.width  * scale));
  const h     = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
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
    throw new Error("This image is too complex to compress — try a simpler or smaller photo.");
  }

  return dataUrl;
}

/**
 * Wires up an avatar picker: hidden file input + live preview + remove button.
 * Calls onChange(dataUrlOrNull) whenever photo changes.
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
    getValue:  () => current,
    setValue:  (dataUrl) => { current = dataUrl || null; render(); },
    refresh:   () => render(),
  };
}
