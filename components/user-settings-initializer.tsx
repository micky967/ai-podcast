"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Client component that initializes user settings when user first signs in
 *
 * This ensures users appear in Convex immediately after sign-up/sign-in
 * Runs client-side so it has proper authentication context
 * 
 * The mutation itself checks if settings exist, so it's safe to call multiple times
 */
export function UserSettingsInitializer() {
  const { userId, isLoaded } = useAuth();
  const initializeUserSettings = useMutation(
    api.userSettings.initializeUserSettings
  );
  const initializationAttempted = useRef<string | null>(null);

  useEffect(() => {
    // Only run when auth is loaded and user is signed in
    if (!isLoaded || !userId) {
      return;
    }

    // Prevent duplicate initialization for the same user
    if (initializationAttempted.current === userId) {
      return;
    }

    // Mark as attempted immediately to prevent duplicate calls
    initializationAttempted.current = userId;

    console.log("[UserSettingsInitializer] Initializing user settings for:", userId);

    // Initialize user settings (fire and forget)
    // The mutation itself checks if settings exist, so it's idempotent
    initializeUserSettings({ userId })
      .then((result) => {
        console.log("[UserSettingsInitializer] Successfully initialized user settings. ID:", result);
      })
      .catch((error) => {
        // Reset flag on error so we can retry for this user
        if (initializationAttempted.current === userId) {
          initializationAttempted.current = null;
        }
        console.error("[UserSettingsInitializer] Failed to initialize user settings:", error);
        console.error("[UserSettingsInitializer] Error details:", {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          userId,
        });
      });
  }, [userId, isLoaded, initializeUserSettings]);

  // This component doesn't render anything
  return null;
}
