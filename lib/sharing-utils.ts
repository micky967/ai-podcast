/**
 * File Sharing Utilities
 *
 * Helper functions for plan-based file sharing restrictions and validation.
 * Enforces plan limits for group creation and member management.
 */

import type { PlanName } from "./tier-config";

/**
 * Check if a user can create sharing groups based on their plan
 *
 * @param plan - User's current plan
 * @returns True if user can create groups
 */
export function canUserCreateGroup(plan: PlanName): boolean {
  return plan === "pro" || plan === "ultra";
}

/**
 * Get maximum number of members allowed in a group based on plan
 *
 * @param plan - Group owner's plan
 * @returns Maximum members (null = unlimited)
 */
export function getMaxGroupMembers(plan: PlanName): number | null {
  switch (plan) {
    case "free":
      return 0; // Cannot create groups
    case "pro":
      return 2; // Max 2 members (owner + 2 others = 3 total)
    case "ultra":
      return null; // Unlimited members
    default:
      return 0;
  }
}

/**
 * Check if a user can share files (create groups or join groups)
 *
 * @param plan - User's current plan
 * @returns True if user can share files
 */
export function canUserShareFiles(plan: PlanName): boolean {
  return plan === "pro" || plan === "ultra";
}

/**
 * Check if a user can be invited to a group based on their plan
 *
 * Pro groups can only invite Pro/Ultra users
 * Ultra groups can invite anyone (Free/Pro/Ultra)
 *
 * @param inviterPlan - Plan of the user creating/inviting
 * @param inviteePlan - Plan of the user being invited
 * @returns True if invitee can be invited
 */
export function canInviteUser(
  inviterPlan: PlanName,
  inviteePlan: PlanName,
): boolean {
  // Free users cannot be invited or invite
  if (inviterPlan === "free" || inviteePlan === "free") {
    return false;
  }

  // Pro users can only invite Pro/Ultra users
  if (inviterPlan === "pro") {
    return inviteePlan === "pro" || inviteePlan === "ultra";
  }

  // Ultra users can invite anyone (Pro/Ultra - Free users can't share anyway)
  if (inviterPlan === "ultra") {
    return inviteePlan === "pro" || inviteePlan === "ultra";
  }

  return false;
}

/**
 * Get upgrade message for users who cannot share files
 *
 * @param currentPlan - User's current plan
 * @returns Upgrade message
 */
export function getSharingUpgradeMessage(currentPlan: PlanName): string {
  if (currentPlan === "free") {
    return "Upgrade to Pro or Ultra to share your files with others";
  }
  return "";
}





