// create.js - drives create-character.html

Auth.requireLogin();

const nameInput = document.getElementById("name");
const descInput = document.getElementById("description");
const personalityInput = document.getElementById("personality");
const previewContact = document.getElementById("previewContact");
const previewDesc = document.getElementById("previewDesc");
const createForm = document.getElementById("createForm");
const submitBtn = document.getElementById("submitBtn");
const errorBanner = document.getElementById("errorBanner");

const avatarPicker = setupAvatarPicker({
  fileInput: document.getElementById("avatarFile"),
  previewEl: document.getElementById("avatarPreview"),
  removeBtn: document.getElementById("removeAvatarBtn"),
  getName: () => nameInput.value.trim() || "Untitled character",
  initialDataUrl: null,
  onChange: renderPreview,
});

document.getElementById("chooseAvatarBtn").addEventListener("click", () => {
  document.getElementById("avatarFile").click();
});

function renderPreview() {
  const name = nameInput.value.trim() || "Untitled character";
  const desc = descInput.value.trim() || "Your one-line description will show up here.";
  previewContact.innerHTML = `
    ${avatarHtml(name, avatarPicker.getValue(), 48)}
    <div class="preview-name">${escapeHtml(name)}</div>
  `;
  previewDesc.textContent = desc;
}

[nameInput, descInput].forEach((el) => el.addEventListener("input", renderPreview));
renderPreview();

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBanner.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating…";

  try {
    const character = await apiFetch("/api/characters", {
      method: "POST",
      auth: true,
      body: {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        personality: personalityInput.value.trim(),
        avatar_url: avatarPicker.getValue(),
        is_public: document.getElementById("isPublic").checked,
      },
    });
    window.location.href = `index.html#character_id=${character.id}`;
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Create character";
  }
});
