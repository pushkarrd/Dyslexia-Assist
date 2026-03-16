// Firebase configuration and initialization for NeuroLex
// Single source of truth - all files should import from here
// Export auth, firestore, and storage instances for use across app

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration object
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '⚠️ Firebase configuration incomplete! Check your .env.local file has NEXT_PUBLIC_FIREBASE_* variables.'
  );
}

// Initialize Firebase app (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize and export authentication service
export const auth = getAuth(app);

// Initialize Firestore — auto-detect long polling to avoid QUIC protocol errors
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

// Initialize and export Cloud Storage
export const storage = getStorage(app);

// Export Google auth provider for OAuth sign-in
export const googleProvider = new GoogleAuthProvider();
