"use client";

import { useCallback } from "react";
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

/**
 * Loads Google Identity Services script from Google's CDN.
 * Using GIS bypasses Firebase's auth handler on firebaseapp.com,
 * which fixes ERR_CONNECTION_CLOSED / ERR_QUIC_PROTOCOL_ERROR errors.
 */
function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load GIS in server context"));
      return;
    }
    // Already loaded
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function useGoogleAuth() {
  const signInWithGoogle = useCallback(async (): Promise<void> => {
    await setPersistence(auth, browserLocalPersistence);

    // Primary path: Firebase popup flow. This avoids custom OAuth client misconfig issues
    // and only requires Firebase Auth Google provider + authorized domain setup.
    try {
      await signInWithPopup(auth, googleProvider);
      return;
    } catch (popupErr: any) {
      const popupCode = popupErr?.code || "";

      // If popup is blocked/closed or operation cancelled, stop early with readable errors.
      if (
        popupCode === "auth/popup-blocked" ||
        popupCode === "auth/popup-closed-by-user" ||
        popupCode === "auth/cancelled-popup-request"
      ) {
        throw new Error(popupErr?.message || "Google sign-in popup was blocked or closed.");
      }
      // Otherwise continue to GIS fallback below.
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Google sign-in failed via Firebase popup and NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing for fallback."
      );
    }

    await loadGIS();

    return new Promise<void>((resolve, reject) => {
      const google = (window as any).google;
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          try {
            // Create Firebase credential from Google access token
            const credential = GoogleAuthProvider.credential(null, response.access_token);
            await signInWithCredential(auth, credential);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        error_callback: (err: any) => {
          // User closed the popup or cancelled
          reject(new Error(err?.message || "Google sign-in was cancelled"));
        },
      });

      // Open Google's account picker popup (runs on accounts.google.com — NOT firebaseapp.com)
      tokenClient.requestAccessToken({ prompt: "select_account" });
    });
  }, []);

  return { signInWithGoogle };
}
