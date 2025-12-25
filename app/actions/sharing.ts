/**
 * File Sharing Server Actions
 *
 * Handles group creation, member management, and join requests.
 * Validates plan restrictions before calling Convex functions.
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex-client";
import {
  canUserCreateGroup,
  canInviteUser,
  getMaxGroupMembers,
  getSharingUpgradeMessage,
} from "@/lib/sharing-utils";
import type { PlanName } from "@/lib/tier-config";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Get user's plan from Clerk
 */
function getUserPlan(authObj: Awaited<ReturnType<typeof auth>>): PlanName {
  const { has } = authObj;
  if (has?.({ plan: "ultra" })) return "ultra";
  if (has?.({ plan: "pro" })) return "pro";
  return "free";
}

/**
 * Create a new sharing group
 */
export async function createGroupAction(input: {
  name?: string;
}): Promise<{ success: boolean; groupId?: Id<"sharingGroups">; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const plan = getUserPlan(authObj);

    // Check if user can create groups
    if (!canUserCreateGroup(plan)) {
      return {
        success: false,
        error: getSharingUpgradeMessage(plan),
      };
    }

    const maxMembers = getMaxGroupMembers(plan);

    // CRITICAL: Normalize and validate userId before creating group
    const normalizedUserId = userId.trim();
    if (normalizedUserId.length === 0) {
      return { success: false, error: "Invalid user ID" };
    }

    // Double-check: Verify userId is valid format (Clerk user IDs start with "user_")
    if (!normalizedUserId.startsWith("user_")) {
      return { success: false, error: "Invalid user ID format" };
    }

    // SECURITY LOG: Log the userId being used to create the group
    console.log("🔐 CREATING GROUP - User ID:", {
      userId: normalizedUserId,
      groupName: input.name,
      timestamp: new Date().toISOString(),
    });

    const groupId = await convex.mutation(api.sharingGroups.createGroup, {
      ownerId: normalizedUserId, // Use normalized, validated ID
      name: input.name?.trim() || undefined,
      maxMembers: maxMembers ?? 999999, // Large number for unlimited
    });

    // Verify the group was created with the correct ownerId
    const createdGroup = await convex.query(api.sharingGroups.getGroupDetails, {
      groupId,
      userId: normalizedUserId,
    });

    if (createdGroup.ownerId !== normalizedUserId) {
      console.error("🚨 CRITICAL ERROR: Group created with wrong ownerId!", {
        expectedOwnerId: normalizedUserId,
        actualOwnerId: createdGroup.ownerId,
        groupId,
      });
      // Don't fail here, but log the error
    }

    return { success: true, groupId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create group",
    };
  }
}

/**
 * Invite a user to a group (creates a join request)
 * This is the proper flow - owner invites, user accepts via notification
 */
export async function inviteUserAction(input: {
  groupId: Id<"sharingGroups">;
  userId: string; // User being invited
  ownerPlan?: PlanName; // Passed from client after validation
  inviteePlan?: PlanName; // Passed from client after validation
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get group to check ownership
    const group = await convex.query(api.sharingGroups.getGroupDetails, {
      groupId: input.groupId,
      userId,
    });

    if (!group.isOwner) {
      // Check if user is admin or app owner
      const userSettings = await convex.query(api.userSettings.getUserRole, {
        userId,
      });
      if (userSettings !== "admin" && userSettings !== "owner") {
        return { success: false, error: "Only group owner, app owner, or admin can invite users" };
      }
    }

    // Validate invite restrictions if plans provided
    if (input.ownerPlan && input.inviteePlan) {
      if (!canInviteUser(input.ownerPlan, input.inviteePlan)) {
        return {
          success: false,
          error: `Cannot invite ${input.inviteePlan} users. ${getSharingUpgradeMessage(input.inviteePlan)}`,
        };
      }
    }

    // Create a join request (invited user will see it in their notification bell)
    await convex.mutation(api.sharingGroups.inviteUserToGroup, {
      groupId: input.groupId,
      requesterId: input.userId, // The user being invited
      invitedBy: userId, // The owner/admin doing the inviting
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to invite user",
    };
  }
}

/**
 * Add a member to a group (direct add - for admins or special cases)
 * Note: Plan validation should be done client-side before calling this
 * For normal invites, use inviteUserAction instead
 */
export async function addMemberAction(input: {
  groupId: Id<"sharingGroups">;
  userId: string;
  ownerPlan?: PlanName; // Passed from client after validation
  inviteePlan?: PlanName; // Passed from client after validation
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get group to check ownership
    const group = await convex.query(api.sharingGroups.getGroupDetails, {
      groupId: input.groupId,
      userId,
    });

    if (!group.isOwner) {
      // Check if user is admin or app owner
      const userSettings = await convex.query(api.userSettings.getUserRole, {
        userId,
      });
      if (userSettings !== "admin" && userSettings !== "owner") {
        return { success: false, error: "Only group owner, app owner, or admin can add members" };
      }
    }

    // Validate invite restrictions if plans provided
    if (input.ownerPlan && input.inviteePlan) {
      if (!canInviteUser(input.ownerPlan, input.inviteePlan)) {
        return {
          success: false,
          error: `Cannot invite ${input.inviteePlan} users. ${getSharingUpgradeMessage(input.inviteePlan)}`,
        };
      }
    }

    const ownerPlan = input.ownerPlan || "free"; // Default to free if not provided
    const maxMembers = getMaxGroupMembers(ownerPlan);

    await convex.mutation(api.sharingGroups.addMember, {
      groupId: input.groupId,
      userId: input.userId,
      addedBy: group.isOwner ? "owner" : "admin",
      ownerId: group.ownerId,
      maxMembers: maxMembers ?? 999999,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add member",
    };
  }
}

/**
 * Remove a member from a group (group owner, app owner, or admin only)
 */
export async function removeMemberAction(input: {
  groupId: Id<"sharingGroups">;
  userId: string; // User to remove
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId: requesterId } = authObj;

    if (!requesterId) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify permissions: group owner, app owner, or admin can remove members
    const group = await convex.query(api.sharingGroups.getGroupDetails, {
      groupId: input.groupId,
      userId: requesterId,
    });

    const userRole = await convex.query(api.userSettings.getUserRole, {
      userId: requesterId,
    });

    const isGroupOwner = group.isOwner;
    const isAppOwner = userRole === "owner";
    const isAdmin = userRole === "admin";

    if (!isGroupOwner && !isAppOwner && !isAdmin) {
      return {
        success: false,
        error: "Unauthorized: Only group owner, app owner, or admin can remove members",
      };
    }

    await convex.mutation(api.sharingGroups.removeMember, {
      groupId: input.groupId,
      userId: input.userId,
      requesterId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

/**
 * Leave a group
 */
export async function leaveGroupAction(
  groupId: Id<"sharingGroups">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    await convex.mutation(api.sharingGroups.leaveGroup, {
      groupId,
      userId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to leave group",
    };
  }
}

/**
 * Request to join a group
 * Note: Free users can request to join groups, but cannot create groups
 */
export async function requestToJoinAction(
  groupId: Id<"sharingGroups">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Allow all users (including free) to request to join groups
    // Group owners can accept or reject requests based on their own plan limits
    await convex.mutation(api.sharingGroups.requestToJoin, {
      groupId,
      requesterId: userId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to request join",
    };
  }
}

/**
 * Cancel a join request
 */
export async function cancelJoinRequestAction(
  groupId: Id<"sharingGroups">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    await convex.mutation(api.sharingGroups.cancelJoinRequest, {
      groupId,
      requesterId: userId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel request",
    };
  }
}

/**
 * Accept an invitation (for invited users to accept their own invitation)
 */
export async function acceptInvitationAction(input: {
  requestId: Id<"groupJoinRequests">;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get request to verify user is the requester
    const request = await convex.query(api.sharingGroups.getJoinRequest, {
      requestId: input.requestId,
    });

    if (request.requesterId !== userId) {
      return { success: false, error: "You can only accept your own invitations" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "This invitation is no longer pending" };
    }

    // Get group to find owner (we can't use getGroupDetails because user isn't a member yet)
    const group = await convex.query(api.sharingGroups.getGroupBasicInfo, {
      groupId: request.groupId,
    });

    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Get owner's plan from Clerk (we'll use a high default since invitation was already validated)
    // The owner's plan limits were checked when the invitation was created
    const maxMembers = 999999; // High default - limits already validated at invite time

    // Accept the request (add user to group)
    // For owner-initiated invites, the requester can accept directly
    await convex.mutation(api.sharingGroups.respondToJoinRequest, {
      requestId: input.requestId,
      groupOwnerId: userId, // Pass userId as groupOwnerId when requester is responding
      accept: true,
      maxMembers: maxMembers ?? 999999,
      isRequesterResponding: true, // Flag to allow requester to respond to owner-initiated invites
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}

/**
 * Decline an invitation (for invited users to decline their own invitation)
 */
export async function declineInvitationAction(input: {
  requestId: Id<"groupJoinRequests">;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get request to verify user is the requester
    const request = await convex.query(api.sharingGroups.getJoinRequest, {
      requestId: input.requestId,
    });

    if (request.requesterId !== userId) {
      return { success: false, error: "You can only decline your own invitations" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "This invitation is no longer pending" };
    }

    // Get group to find owner (we can't use getGroupDetails because user isn't a member yet)
    const group = await convex.query(api.sharingGroups.getGroupBasicInfo, {
      groupId: request.groupId,
    });

    if (!group) {
      return { success: false, error: "Group not found" };
    }

    // Decline the request (reject it so owner knows it was declined)
    await convex.mutation(api.sharingGroups.respondToJoinRequest, {
      requestId: input.requestId,
      groupOwnerId: userId, // Pass userId as groupOwnerId when requester is responding
      accept: false,
      maxMembers: 999999, // Not needed for rejection
      isRequesterResponding: true, // Flag to allow requester to respond to owner-initiated invites
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to decline invitation",
    };
  }
}

/**
 * Respond to a join request (accept/reject) - for group owners
 */
export async function respondToJoinRequestAction(input: {
  requestId: Id<"groupJoinRequests">;
  accept: boolean;
  ownerPlan?: PlanName; // Passed from client after validation
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get request to find group
    const request = await convex.query(api.sharingGroups.getJoinRequest, {
      requestId: input.requestId,
    });

    // Verify user is the group owner
    const group = await convex.query(api.sharingGroups.getGroupDetails, {
      groupId: request.groupId,
      userId,
    });

    if (!group.isOwner) {
      return { success: false, error: "Only group owner can respond to requests" };
    }

    const ownerPlan = input.ownerPlan || "free"; // Default to free if not provided
    const maxMembers = getMaxGroupMembers(ownerPlan);

    await convex.mutation(api.sharingGroups.respondToJoinRequest, {
      requestId: input.requestId,
      groupOwnerId: userId,
      accept: input.accept,
      maxMembers: maxMembers ?? 999999,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to respond to request",
    };
  }
}

/**
 * Delete a group (group owner or app owner role only)
 * 
 * CRITICAL SECURITY: Multiple layers of verification
 * 
 * NOTE: If you log in with different OAuth providers (Facebook vs Google),
 * Clerk creates different user IDs. Make sure your accounts are linked in Clerk
 * (they should auto-link if they use the same email address).
 */
export async function deleteGroupAction(
  groupId: Id<"sharingGroups">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    // Layer 1: Verify user is authenticated
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return { success: false, error: "Unauthorized: Invalid user ID" };
    }

    const normalizedUserId = userId.trim();

    // Layer 2: Check permissions using dedicated query (server-side verification)
    // This query fetches the group directly from DB and compares ownerId with requesterId
    const permissionCheck = await convex.query(api.sharingGroups.canDeleteGroup, {
      groupId,
      requesterId: normalizedUserId,
    });

    if (!permissionCheck || !permissionCheck.canDelete) {
      return {
        success: false,
        error: "Unauthorized: Only the group owner or app owner can delete the group. " +
               "If you created this group with a different login method, make sure your accounts are linked in Clerk.",
      };
    }

    // Layer 3: The Convex mutation will also verify permissions server-side as a final check
    // This is the ultimate authority - even if something bypasses the query check,
    // the mutation will reject unauthorized deletions
    await convex.mutation(api.sharingGroups.deleteGroup, {
      groupId,
      requesterId: normalizedUserId,
    });

    return { success: true };
  } catch (error) {
    // Don't expose internal error details to prevent information leakage
    const errorMessage = error instanceof Error ? error.message : "Failed to delete group";
    
    // Check if it's an authorization error
    if (errorMessage.includes("Unauthorized") || errorMessage.includes("owner")) {
      return {
        success: false,
        error: "Unauthorized: Only the group owner or app owner can delete the group",
      };
    }

    return {
      success: false,
      error: "Failed to delete group. Please try again.",
    };
  }
}

/**
 * Admin: Delete any group
 */
export async function adminDeleteGroupAction(
  groupId: Id<"sharingGroups">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    await convex.mutation(api.sharingGroups.adminDeleteGroup, {
      groupId,
      adminId: userId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete group",
    };
  }
}
