// js/script.js - Handles the sliding animations

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('container');
    const registerBtn = document.getElementById('register');
    const loginBtn = document.getElementById('login');

    if (registerBtn && loginBtn && container) {
        // Slide to Sign Up
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents accidental form submissions
            container.classList.add("active");
        });

        // Slide to Sign In
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents accidental form submissions
            container.classList.remove("active");
        });
    } else {
        console.error("Sliding animation error: Could not find 'register', 'login', or 'container' IDs in HTML.");
    }
});