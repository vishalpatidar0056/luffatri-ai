// js/auth.js - Drives login/signup API calls

document.addEventListener("DOMContentLoaded", () => {
    const errorBanner = document.getElementById("errorBanner");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginSubmitBtn = document.getElementById("loginSubmitBtn");
    const registerSubmitBtn = document.getElementById("registerSubmitBtn");

    // Skip to index if already logged in (assumes Auth object exists in api.js)
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      window.location.href = "index.html";
    }

    // HANDLE SIGN IN
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          errorBanner.style.display = "none";

          const email = document.getElementById("loginEmail").value.trim();
          const password = document.getElementById("loginPassword").value;

          loginSubmitBtn.disabled = true;
          loginSubmitBtn.textContent = "Signing in…";

          try {
            const data = await apiFetch("/api/login", { 
                method: "POST", 
                body: { email, password } 
            });
            
            Auth.setToken(data.access_token);
            window.location.href = "index.html";
            
          } catch (err) {
            errorBanner.textContent = err.message;
            errorBanner.style.display = "block";
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = "Sign In";
          }
        });
    }

    // HANDLE SIGN UP
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          errorBanner.style.display = "none";

          const name = document.getElementById("registerName").value.trim(); 
          const email = document.getElementById("registerEmail").value.trim();
          const password = document.getElementById("registerPassword").value;

          registerSubmitBtn.disabled = true;
          registerSubmitBtn.textContent = "Creating account…";

          try {
            const data = await apiFetch("/api/signup", { 
                method: "POST", 
                body: { name, email, password } 
            });
            
            Auth.setToken(data.access_token);
            window.location.href = "index.html";
            
          } catch (err) {
            errorBanner.textContent = err.message;
            errorBanner.style.display = "block";
            registerSubmitBtn.disabled = false;
            registerSubmitBtn.textContent = "Sign Up";
          }
        });
    }
});