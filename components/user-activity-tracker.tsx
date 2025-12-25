"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Component that tracks user sessions
 * Creates/updates session when user is active, deletes session on sign out
 */
export function UserActivityTracker() {
  const { userId } = useAuth();
  const createOrUpdateSession = useMutation(api.sessions.createOrUpdateSession);
  const deleteSession = useMutation(api.sessions.deleteSession);
  const previousUserIdRef = useRef<string | null | undefined>(userId);

  // Delete session when user signs out
  useEffect(() => {
    // If user was signed in before and now they're not, delete their session
    if (previousUserIdRef.current && !userId) {
      console.log(`[ActivityTracker] User signed out, deleting session for ${previousUserIdRef.current}`);
      deleteSession({ userId: previousUserIdRef.current }).catch((error) => {
        console.error("Error deleting user session:", error);
      });
    }
    previousUserIdRef.current = userId;
  }, [userId, deleteSession]);

  useEffect(() => {
    if (!userId) return;

    const currentUserId = userId; // Capture userId for cleanup

    const updateSession = () => {
      createOrUpdateSession({ userId: currentUserId })
        .then(() => {
          console.log(`[ActivityTracker] Updated session for user ${currentUserId}`);
        })
        .catch((error) => {
          console.error("Error updating user session:", error);
        });
    };

    // Create/update session immediately on mount
    updateSession();

    // Update session every 30 minutes to extend expiration (sessions last 24 hours)
    const interval = setInterval(updateSession, 30 * 60 * 1000); // 30 minutes

    // Also update when user becomes visible (switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      // Delete session when this effect cleans up (user signed out or component unmounts)
      if (currentUserId) {
        console.log(`[ActivityTracker] Cleaning up, deleting session for user ${currentUserId}`);
        deleteSession({ userId: currentUserId }).catch((error) => {
          console.error("Error deleting user session on cleanup:", error);
        });
      }
    };
  }, [userId, createOrUpdateSession, deleteSession]);

  return null; // This component doesn't render anything
}

