/**
 * Sharing Groups Management
 *
 * Handles file sharing groups where users can share their files with others.
 * Plan restrictions:
 * - Free: Cannot create groups or share files
 * - Pro: Can create groups, max 2 members (Pro/Ultra only), share all files
 * - Ultra: Can create groups, unlimited members (anyone), share all files
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Create a new sharing group
 *
 * Used by: Server action after validating user's plan
 *
 * @param ownerId - User creating the group (Clerk userId)
 * @param name - Optional group name
 * @param maxMembers - Maximum members allowed (validated server-side)
 */
export const createGroup = mutation({
  args: {
    ownerId: v.string(),
    name: v.optional(v.string()),
    maxMembers: v.number(), // Passed from server action after plan validation
  },
  handler: async (ctx, args) => {
    // CRITICAL: Validate ownerId before creating group
    if (!args.ownerId || typeof args.ownerId !== "string" || args.ownerId.trim().length === 0) {
      throw new Error("Invalid ownerId: Owner ID is required and must be a non-empty string");
    }

    const normalizedOwnerId = args.ownerId.trim();
    const now = Date.now();

    // SECURITY LOG: Log what ownerId is being stored
    console.log("🔐 CONVEX: Creating group with ownerId:", {
      ownerId: normalizedOwnerId,
      name: args.name,
      timestamp: new Date().toISOString(),
    });

    const groupId = await ctx.db.insert("sharingGroups", {
      ownerId: normalizedOwnerId, // Use normalized ID
      name: args.name,
      createdAt: now,
      updatedAt: now,
    });

    // Add the owner as the first member of the group
    await ctx.db.insert("groupMembers", {
      groupId: groupId,
      userId: normalizedOwnerId,
      status: "active",
      addedAt: now,
      addedBy: "owner",
    });

    // Verify the group was created correctly
    const createdGroup = await ctx.db.get(groupId);
    if (createdGroup && createdGroup.ownerId !== normalizedOwnerId) {
      console.error("🚨 CRITICAL ERROR: Group stored with wrong ownerId!", {
        expectedOwnerId: normalizedOwnerId,
        actualOwnerId: createdGroup.ownerId,
        groupId,
      });
      throw new Error("Failed to create group: Owner ID mismatch");
    }

    return groupId;
  },
});

/**
 * Get all groups a user owns or is a member of
 *
 * Used by: Sharing dashboard to show user's groups
 *
 * @param userId - User's Clerk userId
 * @returns Array of groups with member counts
 */
export const getUserGroups = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get groups user owns
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();

    // Get groups user is a member of
    const memberGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const memberGroupIds = new Set(
      memberGroups.map((m) => m.groupId),
    );

    // Get group details for groups user is member of (but not owner of, to avoid duplicates)
    const ownedGroupIds = new Set(ownedGroups.map((g) => g._id));
    const groupsAsMember = await Promise.all(
      Array.from(memberGroupIds)
        .filter((groupId) => !ownedGroupIds.has(groupId)) // Exclude groups user owns
        .map(async (groupId) => {
          return await ctx.db.get(groupId);
        }),
    );

    // Combine and get member counts (no duplicates since we filtered out owned groups from member groups)
    const allGroups = [
      ...ownedGroups,
      ...groupsAsMember.filter((g) => g !== null),
    ];

    // Check if user has "owner" role (app owner) - only need to check once
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const isAppOwner = userSettings?.role === "owner";

    const groupsWithCounts = await Promise.all(
      allGroups.map(async (group) => {
        if (!group) return null;

        const activeMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", group._id).eq("status", "active"),
          )
          .collect();

        // CRITICAL: Strict check with normalization
        // Normalize both IDs to prevent whitespace/type issues
        const normalizedGroupOwnerId = (group.ownerId || "").trim();
        const normalizedUserId = (args.userId || "").trim();
        
        const isGroupOwner = normalizedGroupOwnerId === normalizedUserId &&
                             normalizedGroupOwnerId.length > 0 &&
                             normalizedUserId.length > 0 &&
                             typeof group.ownerId === "string" && 
                             typeof args.userId === "string";

        return {
          groupId: group._id,
          name: group.name,
          ownerId: group.ownerId,
          isOwner: isGroupOwner, // Only true if user is the actual owner (normalized comparison)
          canDelete: isGroupOwner || isAppOwner, // Group owner or app owner can delete
          memberCount: activeMembers.length,
          createdAt: group.createdAt,
        };
      }),
    );

    return groupsWithCounts.filter((g) => g !== null);
  },
});

/**
 * Get basic group info (no membership check)
 *
 * Used by: Accept invitation action (user isn't a member yet)
 *
 * @param groupId - Group ID
 * @returns Basic group info with ownerId
 */
export const getGroupBasicInfo = query({
  args: {
    groupId: v.id("sharingGroups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    return {
      groupId: group._id,
      name: group.name,
      ownerId: group.ownerId,
      createdAt: group.createdAt,
    };
  },
});

/**
 * Get group details including members
 *
 * Used by: Group management UI and members modal
 *
 * @param groupId - Group ID
 * @param userId - User requesting (for permission check)
 */
export const getGroupDetails = query({
  args: {
    groupId: v.id("sharingGroups"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if user is owner or member
    const isOwner = group.ownerId === args.userId;
    const memberRecord = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();
    const isMember = memberRecord?.status === "active";

    if (!isOwner && !isMember) {
      throw new Error("Unauthorized: You don't have access to this group");
    }

    // Get all active members
    const activeMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "active"),
      )
      .collect();

    return {
      groupId: group._id,
      name: group.name,
      ownerId: group.ownerId,
      isOwner,
      isMember,
      members: activeMembers.map((m) => ({
        userId: m.userId,
        addedAt: m.addedAt,
        addedBy: m.addedBy,
      })),
      memberCount: activeMembers.length,
      createdAt: group.createdAt,
    };
  },
});

/**
 * Add a member to a group
 *
 * Used by: Server action after validating plan and limits
 *
 * @param groupId - Group ID
 * @param userId - User to add (Clerk userId)
 * @param addedBy - Who is adding ("owner" | "admin")
 * @param ownerId - Group owner (for validation)
 * @param maxMembers - Maximum members allowed (validated server-side)
 */
export const addMember = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    userId: v.string(),
    addedBy: v.union(v.literal("owner"), v.literal("admin")),
    ownerId: v.string(), // For validation
    maxMembers: v.number(), // Passed from server action
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (group.ownerId !== args.ownerId && args.addedBy !== "admin") {
      throw new Error("Unauthorized: Only group owner or admin can add members");
    }

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();

    if (existingMember) {
      if (existingMember.status === "active") {
        throw new Error("User is already a member of this group");
      }
      // User left before, reactivate them
      await ctx.db.patch(existingMember._id, {
        status: "active",
        addedAt: Date.now(),
        addedBy: args.addedBy,
      });
      return existingMember._id;
    }

    // Check member limit (only if not admin override)
    if (args.addedBy !== "admin" && args.maxMembers !== null) {
      const activeMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_status", (q) =>
          q.eq("groupId", args.groupId).eq("status", "active"),
        )
        .collect();

      if (activeMembers.length >= args.maxMembers) {
        throw new Error(
          `Group has reached the maximum of ${args.maxMembers} members`,
        );
      }
    }

    // Add new member
    const memberId = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      status: "active",
      addedAt: Date.now(),
      addedBy: args.addedBy,
    });

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: Date.now(),
    });

    return memberId;
  },
});

/**
 * Remove a member from a group (owner/admin only)
 *
 * Used by: Server action when owner/admin removes a member
 *
 * @param groupId - Group ID
 * @param userId - User to remove
 * @param requesterId - User making the request (owner or admin)
 */
export const removeMember = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    userId: v.string(),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if requester is group owner
    const isGroupOwner = group.ownerId === args.requesterId;
    
    // Check if requester has "owner" role (app owner) - can remove from any group
    const requesterSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.requesterId))
      .first();
    const isAppOwner = requesterSettings?.role === "owner";
    const isAdmin = requesterSettings?.role === "admin";

    // Only group owner, app owner, or admin can remove members
    // App owner can remove from any group, admin can remove from any group
    if (!isGroupOwner && !isAppOwner && !isAdmin) {
      throw new Error("Unauthorized: Only group owner, app owner, or admin can remove members");
    }

    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();

    if (!member) {
      throw new Error("User is not a member of this group");
    }

    // Delete the member record
    await ctx.db.delete(member._id);

    // Delete all join requests for this user and group (pending, accepted, or rejected)
    // This ensures that if the user is removed and re-invited, they see a fresh invitation
    // and prevents showing stale "accepted" requests after removal
    const allRequests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group_and_requester", (q) =>
        q.eq("groupId", args.groupId).eq("requesterId", args.userId),
      )
      .collect();

    // Delete all requests (pending, accepted, rejected) to ensure clean state
    for (const request of allRequests) {
      await ctx.db.delete(request._id);
    }

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: Date.now(),
    });
  },
});

/**
 * User leaves a group
 *
 * Used by: Server action when user clicks "Leave Group"
 *
 * @param groupId - Group ID
 * @param userId - User leaving
 */
export const leaveGroup = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // User cannot leave their own group (they should delete it instead)
    if (group.ownerId === args.userId) {
      throw new Error("Group owner cannot leave their own group. Delete the group instead.");
    }

    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();

    if (!member || member.status !== "active") {
      throw new Error("You are not an active member of this group");
    }

    // Set status to "left" instead of deleting (allows tracking for rejoin)
    await ctx.db.patch(member._id, {
      status: "left",
    });

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: Date.now(),
    });
  },
});

/**
 * Request to join a group (or rejoin after leaving)
 *
 * Used by: Server action when user requests to join
 *
 * @param groupId - Group ID
 * @param requesterId - User requesting to join
 */
export const requestToJoin = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if user is already an active member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.requesterId),
      )
      .first();

    if (existingMember?.status === "active") {
      throw new Error("You are already a member of this group");
    }

    // Check if there's already a pending request
    const existingRequest = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group_and_requester", (q) =>
        q.eq("groupId", args.groupId).eq("requesterId", args.requesterId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      // If it's an owner-initiated invite, tell user to accept/decline it instead
      if (existingRequest.initiatedBy === "owner") {
        throw new Error("You have been invited to this group. Please accept or decline the invitation.");
      }
      // If it's a user-initiated request, they already requested
      throw new Error("You already have a pending request for this group");
    }

    // Create join request (user-initiated)
    const requestId = await ctx.db.insert("groupJoinRequests", {
      groupId: args.groupId,
      requesterId: args.requesterId,
      status: "pending",
      requestedAt: Date.now(),
      initiatedBy: "user", // User initiated this request
    });

    console.log("✅ User-initiated join request created:", {
      requestId,
      groupId: args.groupId,
      requesterId: args.requesterId,
      groupOwnerId: group.ownerId,
      initiatedBy: "user"
    });

    return requestId;
  },
});

/**
 * Invite a user to a group (owner/admin creates a join request)
 *
 * Used by: Server action when owner/admin invites a user
 * This creates a join request that the invited user will see in their notification bell
 *
 * @param groupId - Group ID
 * @param requesterId - User being invited (will be the requester in the request)
 * @param invitedBy - User doing the inviting (owner/admin)
 */
export const inviteUserToGroup = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    requesterId: v.string(), // User being invited
    invitedBy: v.string(), // Owner/admin doing the inviting
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Verify that the inviter is the owner or an admin
    if (group.ownerId !== args.invitedBy) {
      // Check if inviter is admin
      const inviterSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.invitedBy))
        .first();

      if (inviterSettings?.role !== "admin" && inviterSettings?.role !== "owner") {
        throw new Error("Unauthorized: Only group owner or admin can invite users");
      }
    }

    // Check if user is already an active member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.requesterId),
      )
      .first();

    if (existingMember?.status === "active") {
      throw new Error("User is already a member of this group");
    }

    // Check if there's already a pending request (either user-initiated or owner-initiated)
    const existingRequest = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group_and_requester", (q) =>
        q.eq("groupId", args.groupId).eq("requesterId", args.requesterId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("User already has a pending request for this group");
    }

    // Create join request (invited user will see this in their notification bell)
    // Mark as owner-initiated since the owner is doing the inviting
    const requestId = await ctx.db.insert("groupJoinRequests", {
      groupId: args.groupId,
      requesterId: args.requesterId,
      status: "pending",
      requestedAt: Date.now(),
      initiatedBy: "owner", // Owner initiated this invite
    });

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: Date.now(),
    });

    console.log("✅ Owner-initiated invite created:", {
      requestId,
      groupId: args.groupId,
      requesterId: args.requesterId,
      ownerId: args.invitedBy,
      initiatedBy: "owner"
    });

    return requestId;
  },
});

/**
 * Get invitations sent by a user (owner-initiated invites)
 * Used by: Notification to show invitations the user has sent
 *
 * @param userId - User ID (group owner who sent invitations)
 * @returns Array of pending invitations sent by this user
 */
export const getSentInvitations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedUserId = args.userId.trim();
    
    // Get all groups owned by this user
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", normalizedUserId))
      .collect();

    if (ownedGroups.length === 0) {
      return [];
    }

    const groupIds = ownedGroups.map((g) => g._id);
    const groupMap = new Map(ownedGroups.map((g) => [g._id, g]));

    // Get all owner-initiated invites for these groups
    const allInvites = await Promise.all(
      groupIds.map(async (groupId) => {
        const invites = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "pending"),
          )
          .filter((q) => q.eq(q.field("initiatedBy"), "owner"))
          .collect();

        return invites.map((r) => ({
          requestId: r._id,
          groupId: r.groupId,
          groupName: groupMap.get(r.groupId)?.name || "Unnamed Group",
          requesterId: r.requesterId,
          requestedAt: r.requestedAt,
        }));
      }),
    );

    return allInvites.flat();
  },
});

/**
 * Get count of invitations sent by a user
 * Used by: Notification badge
 */
export const getSentInvitationsCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedUserId = args.userId.trim();
    
    // Get all groups owned by this user
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", normalizedUserId))
      .collect();

    if (ownedGroups.length === 0) {
      return 0;
    }

    const groupIds = ownedGroups.map((g) => g._id);

    // Get all owner-initiated invites for these groups
    const allInvites = await Promise.all(
      groupIds.map(async (groupId) => {
        const invites = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "pending"),
          )
          .filter((q) => q.eq(q.field("initiatedBy"), "owner"))
          .collect();
        return invites;
      }),
    );

    return allInvites.flat().length;
  },
});

/**
 * Get a join request by ID
 *
 * Used by: Server action to get request details
 *
 * @param requestId - Join request ID
 */
export const getJoinRequest = query({
  args: {
    requestId: v.id("groupJoinRequests"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Join request not found");
    }

    return {
      requestId: request._id,
      groupId: request.groupId,
      requesterId: request.requesterId,
      status: request.status,
      requestedAt: request.requestedAt,
    };
  },
});

/**
 * Cancel a join request (requester only)
 *
 * Used by: Server action when user cancels their own request
 *
 * @param groupId - Group ID
 * @param requesterId - User canceling the request
 */
export const cancelJoinRequest = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the pending request
    const request = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group_and_requester", (q) =>
        q.eq("groupId", args.groupId).eq("requesterId", args.requesterId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!request) {
      throw new Error("No pending request found to cancel");
    }

    // Delete the request
    await ctx.db.delete(request._id);

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get pending join requests for a group (owner only)
 *
 * Used by: Group management UI to show pending requests
 *
 * @param groupId - Group ID
 * @param ownerId - Group owner (for validation)
 */
export const getPendingJoinRequests = query({
  args: {
    groupId: v.id("sharingGroups"),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (group.ownerId !== args.ownerId) {
      throw new Error("Unauthorized: Only group owner can view join requests");
    }

    const requests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "pending"),
      )
      .collect();

    return requests.map((r) => ({
      requestId: r._id,
      requesterId: r.requesterId,
      requestedAt: r.requestedAt,
    }));
  },
});

/**
 * Get pending join requests count for all groups owned by a user
 *
 * Used by: Header notification badge
 *
 * @param userId - User ID (group owner)
 * @returns Total count of pending requests across all owned groups
 */
export const getPendingRequestsCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize userId
    const normalizedUserId = args.userId.trim();
    
    // Get all groups owned by this user
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", normalizedUserId))
      .collect();

    console.log("🔔 getPendingRequestsCount Debug:", {
      userId: normalizedUserId,
      ownedGroupsCount: ownedGroups.length,
      ownedGroupIds: ownedGroups.map((g) => g._id),
    });

    if (ownedGroups.length === 0) {
      return 0;
    }

    const groupIds = ownedGroups.map((g) => g._id);

    // Get all pending requests for these groups
    // BUT only user-initiated requests (where someone requested to join)
    // NOT owner-initiated invites (those should only show to the invited user)
    const allRequests = await Promise.all(
      groupIds.map(async (groupId) => {
        const requests = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "pending"),
          )
          .filter((q) => 
            q.eq(q.field("initiatedBy"), "user") || 
            q.eq(q.field("initiatedBy"), undefined) // Include old requests without initiatedBy
          )
          .collect();
        
        console.log(`🔔 getPendingRequestsCount - Group ${groupId} has ${requests.length} user-initiated requests:`, 
          requests.map((r) => ({
            requestId: r._id,
            requesterId: r.requesterId,
            initiatedBy: r.initiatedBy,
            status: r.status,
            requestedAt: r.requestedAt
          }))
        );
        return requests;
      }),
    );

    const totalCount = allRequests.flat().length;
    console.log("🔔 getPendingRequestsCount - Total pending requests count:", totalCount, {
      userId: normalizedUserId,
      ownedGroupsCount: ownedGroups.length,
      groupIds: groupIds.map((id) => id.toString())
    });
    
    return totalCount;
  },
});

/**
 * Get all pending join requests where user is the requester (invited user)
 *
 * Used by: Notification dropdown for invited users to see their pending invitations
 *
 * @param userId - User ID (the requester/invited user)
 * @returns Array of pending requests where user was invited
 */
export const getPendingRequestsForRequester = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize userId
    const normalizedUserId = args.userId.trim();
    
    // Get all pending requests where this user is the requester
    // Include both owner-initiated invites AND user-initiated requests
    // This allows users to see their own join requests in the notification bell
    const requests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", normalizedUserId))
      .filter((q) => 
        q.eq(q.field("status"), "pending")
        // Include both owner-initiated invites and user-initiated requests
      )
      .collect();

    if (requests.length === 0) {
      return [];
    }

    // Filter out requests where user is already an active member of the group
    // This prevents showing invitations for groups the user has already joined
    const filteredRequests = await Promise.all(
      requests.map(async (request) => {
        // Check if user is already an active member
        const existingMember = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_and_user", (q) =>
            q.eq("groupId", request.groupId).eq("userId", normalizedUserId),
          )
          .first();

        // Only include request if user is NOT already an active member
        if (existingMember?.status === "active") {
          return null;
        }

        const group = await ctx.db.get(request.groupId);
        return {
          requestId: request._id,
          groupId: request.groupId,
          groupName: group?.name || "Unnamed Group",
          requesterId: request.requesterId,
          requestedAt: request.requestedAt,
          initiatedBy: request.initiatedBy, // Include initiatedBy to distinguish user-initiated vs owner-initiated
        };
      }),
    );

    // Filter out null values (requests where user is already a member)
    return filteredRequests.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Get count of pending join requests where user is the requester
 *
 * Used by: Notification badge for invited users
 *
 * @param userId - User ID (the requester/invited user)
 * @returns Count of pending requests
 */
export const getPendingRequestsCountForRequester = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize userId
    const normalizedUserId = args.userId.trim();
    
    // Get all pending requests where this user is the requester
    // Include both owner-initiated invites AND user-initiated requests
    // This allows users to see their own join requests in the notification badge
    const requests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", normalizedUserId))
      .filter((q) => 
        q.eq(q.field("status"), "pending")
        // Include both owner-initiated invites and user-initiated requests
      )
      .collect();

    if (requests.length === 0) {
      return 0;
    }

    // Filter out requests where user is already an active member
    // Count only requests for groups where user is NOT already a member
    let count = 0;
    for (const request of requests) {
      const existingMember = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", request.groupId).eq("userId", normalizedUserId),
        )
        .first();

      // Only count if user is NOT already an active member
      if (existingMember?.status !== "active") {
        count++;
      }
    }

    return count;
  },
});

/**
 * Get all pending join requests for groups owned by a user
 *
 * Used by: Notification dropdown to show all pending requests
 *
 * @param userId - User ID (group owner)
 * @returns Array of pending requests with group details
 */
export const getAllPendingRequestsForOwner = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize userId
    const normalizedUserId = args.userId.trim();
    
    // Get all groups owned by this user
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", normalizedUserId))
      .collect();

    console.log("🔔 getAllPendingRequestsForOwner Debug:", {
      userId: normalizedUserId,
      ownedGroupsCount: ownedGroups.length,
      ownedGroupIds: ownedGroups.map((g) => g._id),
    });

    if (ownedGroups.length === 0) {
      return [];
    }

    const groupIds = ownedGroups.map((g) => g._id);
    const groupMap = new Map(ownedGroups.map((g) => [g._id, g]));

    // Get all pending requests for these groups
    // BUT only user-initiated requests (where someone requested to join)
    // NOT owner-initiated invites (those should only show to the invited user)
    const allRequests = await Promise.all(
      groupIds.map(async (groupId) => {
        const requests = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "pending"),
          )
          .filter((q) => 
            q.eq(q.field("initiatedBy"), "user") || 
            q.eq(q.field("initiatedBy"), undefined) // Include old requests without initiatedBy
          )
          .collect();

        console.log(`🔔 getAllPendingRequestsForOwner - Group ${groupId} has ${requests.length} user-initiated requests:`, 
          requests.map((r) => ({ 
            requestId: r._id, 
            requesterId: r.requesterId,
            initiatedBy: r.initiatedBy,
            status: r.status,
            requestedAt: r.requestedAt
          }))
        );

        return requests.map((r) => ({
          requestId: r._id,
          groupId: r.groupId,
          groupName: groupMap.get(r.groupId)?.name || "Unnamed Group",
          requesterId: r.requesterId,
          requestedAt: r.requestedAt,
        }));
      }),
    );

    const flatRequests = allRequests.flat();
    console.log("🔔 Total requests returned:", flatRequests.length);
    
    return flatRequests;
  },
});

/**
 * Get recent accepted/rejected requests for groups the user owns
 * Used for notifications when someone accepts/declines an invitation
 *
 * @param userId - User's Clerk userId (group owner)
 * @param since - Timestamp to get requests since (default: last 24 hours)
 */
export const getRecentRequestResponses = query({
  args: {
    userId: v.string(),
    since: v.optional(v.number()), // Timestamp - defaults to 24 hours ago
  },
  handler: async (ctx, args) => {
    const normalizedUserId = args.userId.trim();
    
    // Default to last 24 hours if not specified
    const since = args.since || Date.now() - 24 * 60 * 60 * 1000;

    // Get groups user owns
    const ownedGroups = await ctx.db
      .query("sharingGroups")
      .withIndex("by_owner", (q) => q.eq("ownerId", normalizedUserId))
      .collect();

    if (ownedGroups.length === 0) {
      return [];
    }

    const groupIds = ownedGroups.map((g) => g._id);
    const groupMap = new Map(ownedGroups.map((g) => [g._id, g]));

    // Get all accepted/rejected requests for these groups since the timestamp
    const allResponses = await Promise.all(
      groupIds.map(async (groupId) => {
        const acceptedRequests = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "accepted"),
          )
          .collect();

        const rejectedRequests = await ctx.db
          .query("groupJoinRequests")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", groupId).eq("status", "rejected"),
          )
          .collect();

        // Filter by respondedAt timestamp (must exist and be >= since)
        const filteredAccepted = acceptedRequests.filter(
          (r) => r.respondedAt && r.respondedAt >= since
        );
        const filteredRejected = rejectedRequests.filter(
          (r) => r.respondedAt && r.respondedAt >= since
        );

        return [
          ...filteredAccepted.map((r) => ({ ...r, responseType: "accepted" as const })),
          ...filteredRejected.map((r) => ({ ...r, responseType: "rejected" as const })),
        ];
      }),
    );

    const flatResponses = allResponses.flat();

    // Sort by respondedAt (most recent first)
    flatResponses.sort((a, b) => (b.respondedAt || 0) - (a.respondedAt || 0));

    return flatResponses.map((r) => ({
      requestId: r._id,
      groupId: r.groupId,
      groupName: groupMap.get(r.groupId)?.name || "Unnamed Group",
      requesterId: r.requesterId,
      responseType: r.responseType,
      respondedAt: r.respondedAt || r.requestedAt,
    }));
  },
});

/**
 * Get accepted requests where the user was the requester
 * 
 * Used by: Notification component to show when user's join request was accepted
 * 
 * @param userId - User ID (the requester)
 * @param since - Optional timestamp (defaults to 24 hours ago)
 * @returns Array of accepted requests with group info
 */
export const getAcceptedRequestsForRequester = query({
  args: {
    userId: v.string(),
    since: v.optional(v.number()), // Timestamp - defaults to 24 hours ago
  },
  handler: async (ctx, args) => {
    const normalizedUserId = args.userId.trim();
    
    // Default to last 24 hours if not specified
    const since = args.since || Date.now() - 24 * 60 * 60 * 1000;

    // Get all requests where this user was the requester
    const allRequests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", normalizedUserId))
      .collect();

    // Filter for accepted requests with respondedAt >= since
    const acceptedRequests = allRequests.filter(
      (r) => r.status === "accepted" && r.respondedAt && r.respondedAt >= since
    );

    if (acceptedRequests.length === 0) {
      return [];
    }

    // Get group info for each request
    const groupIds = [...new Set(acceptedRequests.map((r) => r.groupId))];
    const groups: Array<{ groupId: Id<"sharingGroups">; groupName: string } | null> = await Promise.all(
      groupIds.map(async (groupId) => {
        const group = await ctx.db.get(groupId);
        return group ? { groupId, groupName: group.name || "Unnamed Group" } : null;
      })
    );

    const groupMap = new Map<Id<"sharingGroups">, string>(
      groups.filter((g): g is { groupId: Id<"sharingGroups">; groupName: string } => g !== null)
        .map((g) => [g.groupId, g.groupName])
    );

    // Sort by respondedAt (most recent first)
    acceptedRequests.sort((a, b) => (b.respondedAt || 0) - (a.respondedAt || 0));

    return acceptedRequests.map((r) => ({
      requestId: r._id,
      groupId: r.groupId,
      groupName: groupMap.get(r.groupId) || "Unnamed Group",
      respondedAt: r.respondedAt || r.requestedAt,
    }));
  },
});

/**
 * Respond to a join request (accept or reject)
 *
 * Used by: Server action when owner accepts/rejects request
 *
 * @param requestId - Join request ID
 * @param groupOwnerId - Group owner (for validation)
 * @param accept - True to accept, false to reject
 * @param maxMembers - Maximum members allowed (validated server-side)
 */
export const respondToJoinRequest = mutation({
  args: {
    requestId: v.id("groupJoinRequests"),
    groupOwnerId: v.string(),
    accept: v.boolean(),
    maxMembers: v.number(), // Passed from server action
    isRequesterResponding: v.optional(v.boolean()), // True if requester is responding to owner-initiated invite
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Join request not found");
    }

    const group = await ctx.db.get(request.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Allow requester to respond if this is an owner-initiated invite
    if (args.isRequesterResponding && request.initiatedBy === "owner") {
      // Requester can respond to owner-initiated invites
      // In this case, groupOwnerId parameter contains the requesterId
      if (request.requesterId !== args.groupOwnerId) {
        throw new Error("Unauthorized: You can only respond to your own invitations");
      }
      // Validation passed - requester is responding to their own invitation
    } else {
      // Normal flow: only group owner can respond
      if (group.ownerId !== args.groupOwnerId) {
        throw new Error("Unauthorized: Only group owner can respond to requests");
      }
    }

    if (request.status !== "pending") {
      throw new Error("Request has already been responded to");
    }

    const now = Date.now();

    if (args.accept) {
      // Check member limit
      if (args.maxMembers !== null) {
        const activeMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", request.groupId).eq("status", "active"),
          )
          .collect();

        if (activeMembers.length >= args.maxMembers) {
          throw new Error(
            `Group has reached the maximum of ${args.maxMembers} members`,
          );
        }
      }

      // Add user as member
      const existingMember = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", request.groupId).eq("userId", request.requesterId),
        )
        .first();

      if (existingMember) {
        // Reactivate if they left before
        await ctx.db.patch(existingMember._id, {
          status: "active",
          addedAt: now,
          addedBy: "owner",
        });
      } else {
        // Add new member
        console.log("✅ Adding new member to group:", {
          groupId: request.groupId,
          userId: request.requesterId,
          requestId: args.requestId,
          isRequesterResponding: args.isRequesterResponding,
        });
        const memberId = await ctx.db.insert("groupMembers", {
          groupId: request.groupId,
          userId: request.requesterId,
          status: "active",
          addedAt: now,
          addedBy: "owner",
        });
        console.log("✅ Member added successfully:", memberId);
      }

      // Update request status
      await ctx.db.patch(args.requestId, {
        status: "accepted",
        respondedAt: now,
      });
    } else {
      // Reject request
      await ctx.db.patch(args.requestId, {
        status: "rejected",
        respondedAt: now,
      });
    }

    // Update group timestamp
    await ctx.db.patch(request.groupId, {
      updatedAt: now,
    });
  },
});

/**
 * Check if a user can delete a group (group owner or app owner only)
 *
 * Used by: Server action to verify permissions before deletion
 *
 * @param groupId - Group ID
 * @param requesterId - User requesting deletion
 */
export const canDeleteGroup = query({
  args: {
    groupId: v.id("sharingGroups"),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (!args.groupId || !args.requesterId) {
      return { 
        canDelete: false, 
        reason: "Invalid request: Missing groupId or requesterId",
        isGroupOwner: false,
        isAppOwner: false,
        idsMatch: false,
      };
    }

    if (typeof args.requesterId !== "string" || args.requesterId.trim().length === 0) {
      return { 
        canDelete: false, 
        reason: "Invalid requester ID",
        isGroupOwner: false,
        isAppOwner: false,
        idsMatch: false,
      };
    }

    // CRITICAL: Fetch group directly from database - don't trust any cached data
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      return { 
        canDelete: false, 
        reason: "Group not found",
        isGroupOwner: false,
        isAppOwner: false,
        idsMatch: false,
      };
    }

    // CRITICAL: Multiple strict checks for ownership
    // Check 1: Verify group ownerId exists and is a string
    if (!group.ownerId || typeof group.ownerId !== "string") {
      return { 
        canDelete: false, 
        reason: "Invalid group: Group owner ID is missing or invalid",
        isGroupOwner: false,
        isAppOwner: false,
        idsMatch: false,
      };
    }

    // Check 2: Normalize and compare ownerId with requesterId (exact match required)
    // Use strict comparison - no type coercion
    const normalizedOwnerId = String(group.ownerId).trim();
    const normalizedRequesterId = String(args.requesterId).trim();
    
    // CRITICAL: IDs must match exactly character by character
    const idsMatch = normalizedOwnerId === normalizedRequesterId &&
                     normalizedOwnerId.length > 0 &&
                     normalizedRequesterId.length > 0 &&
                     normalizedOwnerId.length === normalizedRequesterId.length; // Extra length check
    
    const isGroupOwner = idsMatch; // Only true if IDs match exactly

    // Check 3: Verify requester has "owner" role (app owner) if not group owner
    let isAppOwner = false;
    if (!isGroupOwner) {
      const requesterSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", normalizedRequesterId))
        .first();
      isAppOwner = requesterSettings?.role === "owner";
    }

    // Only allow deletion if user is the actual group owner OR app owner
    const result = {
      canDelete: isGroupOwner || isAppOwner,
      isGroupOwner,
      isAppOwner,
      groupOwnerId: normalizedOwnerId,
      requesterId: normalizedRequesterId,
      idsMatch,
      // Debug info
      ownerIdLength: normalizedOwnerId.length,
      requesterIdLength: normalizedRequesterId.length,
      ownerIdFirst10: normalizedOwnerId.substring(0, 10),
      requesterIdFirst10: normalizedRequesterId.substring(0, 10),
    };
    
    return result;
  },
});

/**
 * Delete a group (group owner or app owner role only)
 *
 * Used by: Server action when owner deletes group
 *
 * @param groupId - Group ID
 * @param requesterId - User requesting deletion (group owner or app owner role)
 */
export const deleteGroup = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (!args.groupId || !args.requesterId) {
      throw new Error("Invalid request: Missing groupId or requesterId");
    }

    if (typeof args.requesterId !== "string" || args.requesterId.trim().length === 0) {
      throw new Error("Invalid requester ID");
    }

    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // CRITICAL: Multiple strict checks for ownership
    // Check 1: Verify group ownerId exists and is a string
    if (!group.ownerId || typeof group.ownerId !== "string") {
      throw new Error("Invalid group: Group owner ID is missing or invalid");
    }

    // Check 2: Normalize and compare ownerId with requesterId (exact match required)
    const normalizedOwnerId = group.ownerId.trim();
    const normalizedRequesterId = args.requesterId.trim();
    
    const isGroupOwner = normalizedOwnerId === normalizedRequesterId &&
                         normalizedOwnerId.length > 0 &&
                         normalizedRequesterId.length > 0;
    
    // Check 3: Verify requester has "owner" role (app owner) if not group owner
    let isAppOwner = false;
    if (!isGroupOwner) {
      const requesterSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", normalizedRequesterId))
        .first();
      isAppOwner = requesterSettings?.role === "owner";
    }

    // Final check: Only group owner OR app owner can delete
    if (!isGroupOwner && !isAppOwner) {
      throw new Error(
        `Unauthorized: Only group owner or app owner can delete the group. ` +
        `Group owner ID: "${normalizedOwnerId}", Requester ID: "${normalizedRequesterId}"`
      );
    }

    // Delete all members
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all join requests
    const requests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const request of requests) {
      await ctx.db.delete(request._id);
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
  },
});

/**
 * Admin: Delete any group
 *
 * Used by: Admin dashboard to delete groups
 *
 * @param groupId - Group ID
 * @param adminId - Admin making the change
 */
export const adminDeleteGroup = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const adminSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.adminId))
      .first();

    if (
      adminSettings?.role !== "admin" &&
      adminSettings?.role !== "owner"
    ) {
      throw new Error("Unauthorized: Only admins can delete groups");
    }

    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Delete all members
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all join requests
    const requests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const request of requests) {
      await ctx.db.delete(request._id);
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
  },
});

/**
 * Get active member count for a group
 *
 * Used by: Validation and UI display
 *
 * @param groupId - Group ID
 */
export const getGroupMemberCount = query({
  args: {
    groupId: v.id("sharingGroups"),
  },
  handler: async (ctx, args) => {
    const activeMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "active"),
      )
      .collect();

    return activeMembers.length;
  },
});

/**
 * Admin: Add member to any group
 *
 * Used by: Admin dashboard to add users to groups
 *
 * @param groupId - Group ID
 * @param userId - User to add
 * @param adminId - Admin making the change
 */
export const adminAddMember = mutation({
  args: {
    groupId: v.id("sharingGroups"),
    userId: v.string(),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const adminSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.adminId))
      .first();

    if (
      adminSettings?.role !== "admin" &&
      adminSettings?.role !== "owner"
    ) {
      throw new Error("Unauthorized: Only admins can add members");
    }

    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .first();

    if (existingMember?.status === "active") {
      throw new Error("User is already a member of this group");
    }

    const now = Date.now();

    if (existingMember) {
      // Reactivate if they left before
      await ctx.db.patch(existingMember._id, {
        status: "active",
        addedAt: now,
        addedBy: "admin",
      });
    } else {
      // Add new member (admin override - no limit check)
      await ctx.db.insert("groupMembers", {
        groupId: args.groupId,
        userId: args.userId,
        status: "active",
        addedAt: now,
        addedBy: "admin",
      });
    }

    // Update group timestamp
    await ctx.db.patch(args.groupId, {
      updatedAt: now,
    });
  },
});

/**
 * Admin: List all groups
 *
 * Used by: Admin dashboard
 *
 * @param adminId - Admin requesting the list
 */
/**
 * Browse groups available to join (excludes groups user owns or is already a member of)
 *
 * Used by: Browse groups UI
 *
 * @param userId - User browsing groups
 * @returns Array of groups user can request to join
 */
export const browseGroups = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all groups
    const allGroups = await ctx.db.query("sharingGroups").collect();

    // Get groups user owns
    const ownedGroupIds = new Set(
      allGroups.filter((g) => g.ownerId === args.userId).map((g) => g._id),
    );

    // Get groups user is an ACTIVE member of (exclude "left" status)
    // Users who left should be able to see the group in browse and request to rejoin
    const activeMemberGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const activeMemberGroupIds = new Set(activeMemberGroups.map((m) => m.groupId));

    // Get user's pending requests (both user-initiated and owner-initiated)
    const pendingRequests = await ctx.db
      .query("groupJoinRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Separate user-initiated and owner-initiated requests
    const userInitiatedRequestGroupIds = new Set(
      pendingRequests
        .filter((r) => r.initiatedBy === "user" || !r.initiatedBy)
        .map((r) => r.groupId),
    );
    
    const ownerInitiatedRequestMap = new Map(
      pendingRequests
        .filter((r) => r.initiatedBy === "owner")
        .map((r) => [r.groupId, r]),
    );

    // Filter out groups user owns or is currently an ACTIVE member of
    // Users who left can see the group and request to rejoin
    const browsableGroups = allGroups.filter(
      (group) =>
        !ownedGroupIds.has(group._id) && !activeMemberGroupIds.has(group._id),
    );

    // Get member counts and request status
    const groupsWithDetails = await Promise.all(
      browsableGroups.map(async (group) => {
        const activeMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", group._id).eq("status", "active"),
          )
          .collect();

        const hasPendingUserRequest = userInitiatedRequestGroupIds.has(group._id);
        const ownerInvite = ownerInitiatedRequestMap.get(group._id);

        return {
          groupId: group._id,
          name: group.name,
          ownerId: group.ownerId,
          memberCount: activeMembers.length,
          createdAt: group.createdAt,
          hasPendingRequest: hasPendingUserRequest, // User-initiated request
          hasOwnerInvite: !!ownerInvite, // Owner-initiated invite
          inviteRequestId: ownerInvite?._id, // Request ID if owner invited
        };
      }),
    );

    return groupsWithDetails;
  },
});

export const listAllGroups = query({
  args: {
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const adminSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.adminId))
      .first();

    if (
      adminSettings?.role !== "admin" &&
      adminSettings?.role !== "owner"
    ) {
      throw new Error("Unauthorized: Only admins can list all groups");
    }

    const allGroups = await ctx.db.query("sharingGroups").collect();

    const groupsWithCounts = await Promise.all(
      allGroups.map(async (group) => {
        const activeMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", group._id).eq("status", "active"),
          )
          .collect();

        return {
          groupId: group._id,
          name: group.name,
          ownerId: group.ownerId,
          memberCount: activeMembers.length,
          createdAt: group.createdAt,
        };
      }),
    );

    return groupsWithCounts;
  },
});

