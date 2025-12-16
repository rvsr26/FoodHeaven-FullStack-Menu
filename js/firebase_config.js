// js/firebase_config.js
// Firebase v9 SDK Modular Imports

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// !!! IMPORTANT: Importing configuration from a separate, ignored file !!!
// This ensures the secret key is not checked into Git.
import { privateFirebaseConfig } from './secure_config.js';


const app = initializeApp(privateFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// NOTE: The 'firebaseConfig' variable is no longer exported or hardcoded here.
// Only the initialized 'auth' and 'db' objects are exported.
