"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Client component that initializes user settings when user first signs in
 *
 * This ensures users appear in Convex immediately after sign-up/sign-in
 * Runs client-side so it has proper authentication context
 */
export function UserSettingsInitializer() {
  const { userId, isLoaded } = useAuth();
  const initializeUserSettings = useMutation(
    api.userSettings.initializeUserSettings
  );
  const settingsStatus = useQuery(
    api.userSettings.getUserSettingsStatus,
    userId ? { userId } : "skip"
  );
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run when auth is loaded and user is signed in
    if (!isLoaded || !userId) {
      return;
    }

    // Wait for settings status to load
    if (settingsStatus === undefined) {
      return;
    }

    // If settings already exist, no need to initialize
    if (settingsStatus !== null) {
      return;
    }

    // Prevent duplicate initialization
    if (hasInitialized.current) {
      return;
    }

    // Mark as initialized immediately to prevent duplicate calls
    hasInitialized.current = true;

    console.log("[UserSettingsInitializer] Initializing user settings for:", userId);

    // Initialize user settings (fire and forget)
    // This creates the userSettings record if it doesn't exist
    initializeUserSettings({ userId })
      .then((result) => {
        console.log("[UserSettingsInitializer] Successfully initialized user settings:", result);
      })
      .catch((error) => {
        // Reset flag on error so we can retry
        hasInitialized.current = false;
        console.error("[UserSettingsInitializer] Failed to initialize user settings:", error);
        console.error("[UserSettingsInitializer] Error details:", {
          message: error?.message,
          stack: error?.stack,
          userId,
        });
      });
  }, [userId, isLoaded, settingsStatus, initializeUserSettings]);

  // This component doesn't render anything
  return null;
}
