"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

/**
 * Client component that initializes user settings when user first signs in
 * 
 * This ensures users appear in Convex immediately after sign-up/sign-in
 * Runs client-side so it has proper authentication context
 */
export function UserSettingsInitializer() {
  const { userId, isLoaded } = useAuth();
  const initializeUserSettings = useMutation(api.userSettings.initializeUserSettings);

  useEffect(() => {
    // Only run when auth is loaded and user is signed in
    if (!isLoaded || !userId) {
      return;
    }

    // Initialize user settings (fire and forget)
    // This creates the userSettings record if it doesn't exist
    initializeUserSettings({ userId })
      .catch((error) => {
        // Log error but don't show to user
        console.error("Failed to initialize user settings:", error);
      });
  }, [userId, isLoaded, initializeUserSettings]);

  // This component doesn't render anything
  return null;
}
