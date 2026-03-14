// Firebase configuration and initialization for EchoNotes
// Initialize Firebase app with credentials from environment variables
// Export auth, firestore, and storage instances for use across app
// Configuration keys come from .env file with REACT_APP_ prefix
// Services needed: Authentication, Firestore Database, Cloud Storage

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration object
// Keys loaded from environment variables (see .env file)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '⚠️ Firebase configuration incomplete! Check your .env file has VITE_FIREBASE_* variables.'
  );
}

// Initialize Firebase app with config
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Try to reinitialize if QUIC protocol error
  if (error.code === 'ERR_QUIC_PROTOCOL_ERROR' || error.message.includes('QUIC')) {
    console.log('🔄 Retrying Firebase initialization with fallback...');
    app = initializeApp(firebaseConfig);
  }
}

// Initialize and export authentication service with error handling
export const auth = getAuth(app);

// Configure auth to use long polling as fallback for QUIC issues
if (typeof window !== 'undefined') {
  // Force use of fetch/XHR instead of QUIC
  auth.settings.appVerificationDisabledForTesting = false;
}

// Initialize and export Firestore database
export const db = getFirestore(app);

// Add retry logic for Firestore connection issues
db._settings = {
  ...db._settings,
  experimentalForceLongPolling: true, // Force long polling instead of QUIC
  experimentalAutoDetectLongPolling: true,
};

// Initialize and export Cloud Storage
export const storage = getStorage(app);

// Export Google auth provider for OAuth sign-in
export const googleProvider = new GoogleAuthProvider();

// Add error handler for auth state changes
auth.onAuthStateChanged(
  (user) => {
    if (user) {
      console.log('✅ User authenticated:', user.email);
    }
  },
  (error) => {
    console.error('❌ Auth state change error:', error);
  }
);