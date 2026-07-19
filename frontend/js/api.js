// api.js - shared across all pages.
// Change this if your backend runs somewhere other than localhost:8000.
const API_BASE_URL = window.API_BASE_URL || "https://luffatri-ai-backend.onrender.com";

const Auth = {
  getToken() {
    return localStorage.getItem("mcai_token");
  },
  setToken(token) {
    localStorage.setItem("mcai_token", token);
  },
  clear() {
    localStorage.removeItem("mcai_token");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = "login.html";
    }
  },
  logout() {
    this.clear();
    window.location.href = "login.html";
  },
};

/**
 * Thin fetch wrapper: attaches JSON headers + bearer token, throws an Error
 * with a readable message on non-2xx responses.
 */
async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = Auth.getToken();
    if (!token) {
      Auth.logout();
      throw new Error("Not logged in");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    Auth.logout();
    throw new Error("Session expired - please log in again");
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (_) {
      /* ignore parse errors */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  if (res.status === 204) return null;
  return res.json();
}
