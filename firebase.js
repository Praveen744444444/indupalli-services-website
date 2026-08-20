import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "indupalli-services-18404.firebaseapp.com",
  projectId: "indupalli-services-18404",
  storageBucket: "indupalli-services-18404.firebasestorage.app",
  messagingSenderId: "187485195719",
  appId: "1:187485195719:web:a2f422b12c47ea2d549de2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
