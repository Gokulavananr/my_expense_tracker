// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkx0jipXI5yoOXaEoH5VtQ62_7HrMiSc4",
  authDomain: "expense-tracker-51ba4.firebaseapp.com",
  projectId: "expense-tracker-51ba4",
  storageBucket: "expense-tracker-51ba4.firebasestorage.app",
  messagingSenderId: "598972816251",
  appId: "1:598972816251:web:2edd77ed402612dcb0bbde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth and db so other files can use them
export const auth = getAuth(app);
export const db = getFirestore(app);