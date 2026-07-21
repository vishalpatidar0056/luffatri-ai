// auth.js - drives login.html

document.addEventListener("DOMContentLoaded", () => {
  const errorBanner      = document.getElementById("errorBanner");
  const loginForm        = document.getElementById("loginForm");
  const registerForm     = document.getElementById("registerForm");
  const loginSubmitBtn   = document.getElementById("loginSubmitBtn");
  const registerSubmitBtn= document.getElementById("registerSubmitBtn");

  function showError(msg) {
    if (!errorBanner) return;
    errorBanner.textContent    = msg;
    errorBanner.style.display  = "block";
    // Auto-hide after 6 s
    clearTimeout(errorBanner._hideTimer);
    errorBanner._hideTimer = setTimeout(() => { errorBanner.style.display = "none"; }, 6000);
  }

  function hideError() {
    if (errorBanner) errorBanner.style.display = "none";
  }

  // Redirect if already logged in
  if (typeof Auth !== "undefined" && Auth.isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  // Sign In
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();

      const email    = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      loginSubmitBtn.disabled    = true;
      loginSubmitBtn.textContent = "Signing in…";

      try {
        const data = await apiFetch("/api/login", { method: "POST", body: { email, password } });
        Auth.setToken(data.access_token);
        window.location.href = "index.html";
      } catch (err) {
        showError(err.message);
        loginSubmitBtn.disabled    = false;
        loginSubmitBtn.textContent = "Sign In";
      }
    });
  }

  // Sign Up
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();

      const name     = document.getElementById("registerName").value.trim();
      const email    = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;

      registerSubmitBtn.disabled    = true;
      registerSubmitBtn.textContent = "Creating account…";

      try {
        const data = await apiFetch("/api/signup", { method: "POST", body: { name, email, password } });
        Auth.setToken(data.access_token);
        window.location.href = "index.html";
      } catch (err) {
        showError(err.message);
        registerSubmitBtn.disabled    = false;
        registerSubmitBtn.textContent = "Sign Up";
      }
    });
  }
});
