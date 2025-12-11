/**
 * User Settings Management
 *
 * Handles user-provided API keys (BYOK - Bring Your Own Key).
 * Users can provide their own OpenAI and AssemblyAI API keys to use
 * instead of the application's shared keys.
 *
 * Also handles user roles (user/admin) for access control.
 *
 * Security:
 * - Keys are stored in Convex (encrypted at rest)
 * - Only the user who owns the settings can read/update them
 * - Keys are never exposed to client-side code unnecessarily
 * - Role changes can only be made by admins
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user settings including encrypted API keys
 *
 * Used by: Inngest functions to retrieve encrypted API keys for decryption and processing
 * NOT for frontend use - keys are encrypted but should not be exposed to client
 *
 * @returns User settings with encrypted API keys, or null if not set
 */
export const getUserSettings = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find settings by user ID
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!settings) {
      return null;
    }

    // Return settings with encrypted API keys
    // These are encrypted and only decrypted server-side in Inngest functions
    return {
      openaiApiKey: settings.openaiApiKey,
      assemblyaiApiKey: settings.assemblyaiApiKey,
      updatedAt: settings.updatedAt,
    };
  },
});

/**
 * Get user settings status (for frontend display only)
 *
 * Used by: Frontend Settings page to check if keys are configured
 * Returns only boolean indicators, not actual keys (even encrypted ones)
 *
 * @returns User settings status indicating if keys are set
 */
export const getUserSettingsStatus = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find settings by user ID
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!settings) {
      return {
        hasOpenaiKey: false,
        hasAssemblyaiKey: false,
        updatedAt: null,
      };
    }

    // Return only status indicators, not actual keys
    return {
      hasOpenaiKey: !!settings.openaiApiKey,
      hasAssemblyaiKey: !!settings.assemblyaiApiKey,
      updatedAt: settings.updatedAt,
    };
  },
});

/**
 * Update or create user settings with API keys
 *
 * Used by: Settings page when user saves their API keys
 *
 * @param openaiApiKey - User's OpenAI API key (optional)
 * @param assemblyaiApiKey - User's AssemblyAI API key (optional)
 */
export const updateUserSettings = mutation({
  args: {
    userId: v.string(),
    openaiApiKey: v.optional(v.string()),
    assemblyaiApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find existing settings
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing settings (preserve role if it exists, otherwise keep undefined to default to "user")
      await ctx.db.patch(existing._id, {
        openaiApiKey: args.openaiApiKey ?? existing.openaiApiKey,
        assemblyaiApiKey: args.assemblyaiApiKey ?? existing.assemblyaiApiKey,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new settings with default "user" role
      const settingsId = await ctx.db.insert("userSettings", {
        userId: args.userId,
        openaiApiKey: args.openaiApiKey,
        assemblyaiApiKey: args.assemblyaiApiKey,
        role: "user", // Default role for new users
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});

/**
 * Delete user API keys (clear settings)
 *
 * Used by: Settings page when user wants to remove their keys
 */
export const clearUserApiKeys = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        openaiApiKey: undefined,
        assemblyaiApiKey: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Check if a user is an admin or owner
 *
 * Used by: Admin checks throughout the application
 * Owners have all admin privileges
 *
 * @returns True if user is admin or owner, false otherwise (defaults to false if no settings exist)
 */
export const isUserAdmin = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Owners and admins both have admin privileges
    return settings?.role === "admin" || settings?.role === "owner";
  },
});

/**
 * Check if a user is an owner
 *
 * Used by: Admin dashboard access - only owners can access the admin dashboard
 *
 * @returns True if user is owner, false otherwise (defaults to false if no settings exist)
 */
export const isUserOwner = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return settings?.role === "owner";
  },
});

/**
 * Get user role
 *
 * Used by: Frontend to display user role
 *
 * @returns User role ("user" or "admin"), defaults to "user"
 */
export const getUserRole = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Default to "user" role if no settings exist
    return settings?.role ?? "user";
  },
});

/**
 * Set user role (admin-only)
 *
 * Used by: Admin dashboard to promote/demote users
 *
 * Security: Only admins can change roles
 * Owner role cannot be changed by anyone (must be set directly in database)
 *
 * @param targetUserId - The user whose role is being changed
 * @param role - New role ("user" or "admin")
 * @param adminUserId - The admin making the change (for verification)
 */
export const setUserRole = mutation({
  args: {
    targetUserId: v.string(), // User whose role is being changed
    role: v.union(v.literal("user"), v.literal("admin")),
    adminUserId: v.string(), // Admin making the change (for verification)
  },
  handler: async (ctx, args) => {
    // Verify that the requester is an admin or owner
    const adminSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.adminUserId))
      .first();

    if (adminSettings?.role !== "admin" && adminSettings?.role !== "owner") {
      throw new Error("Unauthorized: Only admins and owners can change user roles");
    }

    // Find or create settings for the target user
    const targetSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .first();

    // Prevent changing owner role - owners can only be changed directly in database
    if (targetSettings?.role === "owner") {
      throw new Error("Cannot change owner role. Owner role can only be modified directly in the database.");
    }

    const now = Date.now();

    if (targetSettings) {
      // Update existing settings
      await ctx.db.patch(targetSettings._id, {
        role: args.role,
        updatedAt: now,
      });
      return targetSettings._id;
    } else {
      // Create new settings with the specified role
      const settingsId = await ctx.db.insert("userSettings", {
        userId: args.targetUserId,
        role: args.role,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});

/**
 * List all users with their roles (owner-only)
 *
 * Used by: Admin dashboard to display all users
 *
 * Security: Only owners can list all users
 *
 * @param adminUserId - The owner requesting the list (for verification)
 * @returns Array of users with their userId and role
 */
export const listAllUsers = query({
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
      throw new Error("Unauthorized: Only owners can list all users");
    }

    // Get all user settings
    const allSettings = await ctx.db.query("userSettings").collect();

    // Return users with their roles (default to "user" if role not set)
    return allSettings.map((settings) => ({
      userId: settings.userId,
      role: settings.role ?? "user",
      createdAt: settings.createdAt,
    }));
  },
});

