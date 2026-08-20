import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJWdsNykkCp9tJfoBiZNoVfWT0orM6BHA",
  authDomain: "indupalli-services-18404.firebaseapp.com",
  projectId: "indupalli-services-18404",
  storageBucket: "indupalli-services-18404.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Add your actual ID here if you have it
  appId: "YOUR_APP_ID" // Add your actual ID here if you have it
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
