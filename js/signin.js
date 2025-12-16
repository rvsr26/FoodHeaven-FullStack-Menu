// js/signin.js
import { auth, db } from './firebase_config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DOM Elements ---
const signInForm = document.getElementById('login-form');
const signUpForm = document.getElementById('signup-form');
const container = document.querySelector(".container");

// UI Toggling
const toggleForms = () => {
    const signUpBtn = document.getElementById('sign-up-btn');
    const signInBtn = document.getElementById('sign-in-btn');
    
    if (signUpBtn) {
        signUpBtn.addEventListener("click", () => {
            container.classList.add("sign-up-mode");
        });
    }

    if (signInBtn) {
        signInBtn.addEventListener("click", () => {
            container.classList.remove("sign-up-mode");
        });
    }
};

/**
 * Handles redirect after successful authentication by checking user role.
 */
const handleAuthSuccess = async (user) => {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        let userRole = 'customer'; // Default role for all new signups

        if (userDoc.exists()) {
            userRole = userDoc.data().role;
        } else {
            // Create user document if it doesn't exist (e.g., first time login)
            await setDoc(userDocRef, {
                email: user.email,
                name: user.displayName || null,
                role: userRole,
                createdAt: new Date()
            });
        }

        if (userRole === 'admin') {
            window.location.href = 'admin.html'; // Admin Dashboard
        } else {
            window.location.href = 'menu.html'; // Customer Menu
        }

    } catch (error) {
        console.error("Login Error (Role Check):", error);
        alert("Login successful, but failed to fetch role. Redirecting to menu.");
        window.location.href = 'menu.html';
    }
};

// --- SIGN UP ---
signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document with default 'customer' role
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            name: username,
            role: 'customer', 
            createdAt: new Date()
        });

        alert("Sign up successful! Redirecting to menu.");
        window.location.href = 'menu.html';

    } catch (error) {
        console.error("Sign up error:", error);
        alert(`Sign up failed: ${error.message}`);
    }
});

// --- SIGN IN (Login) ---
signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await handleAuthSuccess(userCredential.user);

    } catch (error) {
        console.error("Sign in error:", error);
        alert(`Login failed: ${error.message}`);
    }
});


// --- GUEST LOGIN ---
document.getElementById('guest-btn-signin').addEventListener('click', () => {
    window.location.href = 'menu.html';
});
document.getElementById('guest-btn-signup').addEventListener('click', () => {
    window.location.href = 'menu.html';
});


// --- INITIALIZATION ---
toggleForms();

// Check for existing session and redirect
onAuthStateChanged(auth, (user) => {
    if (user) {
        handleAuthSuccess(user);
    }
});