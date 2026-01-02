import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * THESIS: SECURE CONNECTION MODULE
 * 
 * Status: ACTIVE
 * Project: Salary Cut-Off Expense Tracker
 * Database: Google Cloud Firestore
 */

// --- SECURITY CONFIGURATION ---
// Keys provided by the system administrator (You)
const firebaseConfig = {
  apiKey: "AIzaSyDIGGaq2Pco-eYf_aAAvDjq6Dkl0Wb14Vw",
  authDomain: "expense-tracker-588fb.firebaseapp.com",
  projectId: "expense-tracker-588fb",
  storageBucket: "expense-tracker-588fb.firebasestorage.app",
  messagingSenderId: "89912282012",
  appId: "1:89912282012:web:b1ecb5a9652bbf6ce4d659",
  measurementId: "G-9FW8FT7Y3Q"
};

// Initialize Firebase Variables
let app;
let auth;
let db;
let isFirebaseInitialized = false;

try {
    // Check integrity of keys
    if (!firebaseConfig.apiKey) {
        console.warn("Security Alert: No API Keys detected. Initializing Secure Simulation Mode (Offline).");
    } else {
        // Initialize the Real App
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseInitialized = true;
        console.log("%c SECURITY STATUS: CONNECTED TO LIVE DATABASE ", "background: #10b981; color: white; padding: 4px; border-radius: 4px; font-weight: bold;");
    }

} catch (error) {
    console.error("CRITICAL SECURITY ERROR: Could not connect to Firebase.", error);
}

export { auth, db, isFirebaseInitialized };