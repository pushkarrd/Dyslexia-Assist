// Re-export everything from the single source of truth
// This prevents duplicate initializeApp() calls
export { auth, db, storage, googleProvider } from '@/lib/firebase';
