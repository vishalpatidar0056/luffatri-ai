// script.js - sliding animation for login page

document.addEventListener("DOMContentLoaded", () => {
  const container  = document.getElementById("container");
  const registerBtn= document.getElementById("register");
  const loginBtn   = document.getElementById("login");

  if (!container || !registerBtn || !loginBtn) {
    console.warn("Login animation: missing container, register, or login elements.");
    return;
  }

  registerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    container.classList.add("active");
  });

  loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    container.classList.remove("active");
  });
});
