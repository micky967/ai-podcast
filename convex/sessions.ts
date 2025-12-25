/**
 * User Session Management
 *
 * Tracks active user sessions to determine who is currently logged in.
 * Sessions expire after 24 hours and are automatically cleaned up.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create or update a user session
 *
 * Used by: Activity tracker when user is active
 * Creates a new session or updates existing session expiration
 *
 * @param userId - User ID to create/update session for
 */
export const createOrUpdateSession = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours from now

    // Check if user already has an active session
    const existingSession = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingSession) {
      // Update existing session expiration
      await ctx.db.patch(existingSession._id, {
        expiresAt,
      });
    } else {
      // Create new session
      await ctx.db.insert("sessions", {
        userId: args.userId,
        createdAt: now,
        expiresAt,
      });
    }
  },
});

/**
 * Delete a user session (when user signs out)
 *
 * Used by: Activity tracker when user signs out
 *
 * @param userId - User ID to delete session for
 */
export const deleteSession = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find and delete all sessions for this user
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

/**
 * Get all active sessions (not expired)
 *
 * Used by: Admin dashboard to show logged-in users
 *
 * Security: Only owners can query this
 *
 * @param adminUserId - The owner requesting the list (for verification)
 * @returns Array of active sessions with user info
 */
export const getActiveSessions = query({
  args: {
    adminUserId: v.string(), // Owner requesting the list (for verification)
  },
  handler: async (ctx, args) => {
    // Verify that the requester is an owner
    const ownerSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.adminUserId))
      .first();

    if (ownerSettings?.role !== "owner") {
      throw new Error("Unauthorized: Only owners can view active sessions");
    }

    const now = Date.now();

    // Get all sessions that haven't expired
    const allSessions = await ctx.db.query("sessions").collect();
    const activeSessions = allSessions.filter(
      (session) => session.expiresAt > now,
    );

    // Sort by most recent first
    activeSessions.sort((a, b) => b.createdAt - a.createdAt);

    // Return sessions with user info
    return activeSessions.map((session) => ({
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  },
});

/**
 * Clean up expired sessions (can be called periodically)
 *
 * Used by: Scheduled cleanup or manual cleanup
 */
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all sessions
    const allSessions = await ctx.db.query("sessions").collect();

    // Delete expired sessions
    let deletedCount = 0;
    for (const session of allSessions) {
      if (session.expiresAt <= now) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});
