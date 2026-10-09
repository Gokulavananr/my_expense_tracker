import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

// Tab switching
const tabs = document.querySelectorAll(".tab-btn");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

function switchTab(tab) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  loginForm.classList.toggle("hidden", tab !== "login");
  signupForm.classList.toggle("hidden", tab !== "signup");
}

tabs.forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
document.querySelectorAll("[data-switch]").forEach(a =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(a.dataset.switch);
  })
);

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  err.textContent = "";
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (error) {
    err.textContent = friendlyError(error.code);
  }
});

// Signup
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("signup-error");
  err.textContent = "";
  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    window.location.href = "dashboard.html";
  } catch (error) {
    err.textContent = friendlyError(error.code);
  }
});

function friendlyError(code) {
  const map = {
    "auth/invalid-email": "Invalid email address.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Password must be at least 6 characters."
  };
  return map[code] || "Something went wrong. Please try again.";
}