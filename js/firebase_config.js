// js/firebase_config.js
// Firebase v9 SDK Modular Imports

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// !!! IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIG !!!
export const firebaseConfig = {
    apiKey: "AIzaSyApuqg142ds-EtzCQj62BSQVaH8gYmyfMs",
    authDomain: "zomat-8e948.firebaseapp.com",
    projectId: "zomat-8e948",
    storageBucket: "zomat-8e948.firebasestorage.app",
    messagingSenderId: "426255965986",
    appId: "1:426255965986:web:b47c68f03f8681e4790f7b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);