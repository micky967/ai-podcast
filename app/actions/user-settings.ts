/**
 * User Settings Server Actions
 *
 * Handles saving and updating user-provided API keys.
 * These keys allow users to use their own API keys instead of shared ones.
 * Also handles subscription cancellation.
 */

"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex-client";
import { encrypt } from "@/lib/encryption";

/**
 * Update user API keys
 *
 * Saves user-provided OpenAI and/or AssemblyAI API keys.
 * Keys are stored securely in Convex and used for processing if provided.
 *
 * @param openaiApiKey - User's OpenAI API key (optional, can be empty string to clear)
 * @param assemblyaiApiKey - User's AssemblyAI API key (optional, can be empty string to clear)
 */
export async function updateUserApiKeysAction(input: {
  openaiApiKey?: string;
  assemblyaiApiKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const authObj = await auth();
  const { userId } = authObj;

  if (!userId) {
    return { success: false, error: "You must be signed in to update settings" };
  }

  try {
    // Normalize empty strings to undefined
    const openaiApiKey = input.openaiApiKey?.trim() || undefined;
    const assemblyaiApiKey = input.assemblyaiApiKey?.trim() || undefined;

    // Validate OpenAI key format if provided
    if (openaiApiKey && !openaiApiKey.startsWith("sk-")) {
      return {
        success: false,
        error: "Invalid OpenAI API key format. Keys should start with 'sk-'",
      };
    }

    // Validate AssemblyAI key format if provided (usually alphanumeric, no specific prefix)
    if (assemblyaiApiKey && assemblyaiApiKey.length < 10) {
      return {
        success: false,
        error: "Invalid AssemblyAI API key format",
      };
    }

    // Encrypt keys before storing in database
    const encryptedOpenaiKey = openaiApiKey ? encrypt(openaiApiKey) : undefined;
    const encryptedAssemblyaiKey = assemblyaiApiKey ? encrypt(assemblyaiApiKey) : undefined;

    // Save encrypted keys to Convex
    await convex.mutation(api.userSettings.updateUserSettings, {
      userId,
      openaiApiKey: encryptedOpenaiKey,
      assemblyaiApiKey: encryptedAssemblyaiKey,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to update user API keys:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update settings. Please try again.",
    };
  }
}

/**
 * Clear user API keys
 *
 * Removes user-provided API keys, falling back to shared keys.
 */
export async function clearUserApiKeysAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const authObj = await auth();
  const { userId } = authObj;

  if (!userId) {
    return { success: false, error: "You must be signed in to update settings" };
  }

  try {
    await convex.mutation(api.userSettings.clearUserApiKeys, {
      userId,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to clear user API keys:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to clear settings. Please try again.",
    };
  }
}

/**
 * End user subscription
 *
 * Ends the user's active subscription through Clerk's backend API.
 * This matches the "End subscription" action in Clerk's dashboard.
 * The subscription will be ended immediately.
 *
 * @returns Success response or error message
 */
export async function cancelSubscriptionAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const authObj = await auth();
  const { userId } = authObj;

  if (!userId) {
    return { success: false, error: "You must be signed in to cancel subscription" };
  }

  try {
    const client = await clerkClient();
    
    // Get user's billing subscription
    const subscription = await client.billing.getUserBillingSubscription(userId);

    console.log("[CANCEL SUBSCRIPTION] Subscription data:", {
      userId,
      hasSubscription: !!subscription,
      subscriptionItemsCount: subscription?.subscriptionItems?.length || 0,
    });

    if (!subscription || !subscription.subscriptionItems || subscription.subscriptionItems.length === 0) {
      return {
        success: false,
        error: "No active subscription found to cancel",
      };
    }

    // Filter to only active subscription items (not already canceled or ended)
    const activeItems = subscription.subscriptionItems.filter(
      (item) => 
        item.status !== "canceled" && 
        item.status !== "ended" &&
        item.status !== "abandoned" &&
        item.status !== "expired"
    );

    if (activeItems.length === 0) {
      // Check if items are already canceled
      const canceledItems = subscription.subscriptionItems.filter(
        (item) => item.status === "canceled" || item.status === "ended"
      );
      
      if (canceledItems.length > 0) {
        return {
          success: false,
          error: "Your subscription is already canceled. You'll retain access until the end of your billing period.",
        };
      }
      
      return {
        success: false,
        error: "No active subscription items found to cancel",
      };
    }

    console.log("[CANCEL SUBSCRIPTION] Active items to cancel:", activeItems.map(item => ({
      id: item.id,
      status: item.status,
      planId: item.planId,
    })));

    // Cancel subscription items one at a time to handle errors better
    const results = [];
    for (const item of activeItems) {
      try {
        console.log(`[CANCEL SUBSCRIPTION] Canceling item ${item.id} (status: ${item.status}, planId: ${item.planId})`);
        
        // End the subscription item (matches Clerk dashboard's "End subscription" button)
        // Clerk API: cancelSubscriptionItem(subscriptionItemId, params?)
        // Using endNow: true to end immediately (like "End subscription" in Clerk dashboard)
        const result = await client.billing.cancelSubscriptionItem(item.id, {
          endNow: true, // End subscription immediately (matches "End subscription" in Clerk dashboard)
        });
        
        console.log(`[CANCEL SUBSCRIPTION] Successfully canceled item ${item.id}`);
        results.push(result);
      } catch (itemError) {
        console.error(`[CANCEL SUBSCRIPTION] Error canceling item ${item.id}:`, itemError);
        
        // Log the full error for debugging
        if (itemError instanceof Error) {
          console.error(`[CANCEL SUBSCRIPTION] Error details:`, {
            message: itemError.message,
            name: itemError.name,
            stack: itemError.stack,
          });
        }
        
        // If one item fails, log but continue with others
        // Only fail completely if all items fail
        if (results.length === 0 && activeItems.length === 1) {
          throw itemError;
        }
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        error: "Failed to cancel subscription. All cancellation attempts failed. Please contact support or cancel through Clerk's dashboard.",
      };
    }

    console.log("[CANCEL SUBSCRIPTION] Successfully canceled all subscription items");
    return { success: true };
  } catch (error) {
    console.error("[CANCEL SUBSCRIPTION] Failed to cancel subscription:", error);
    
      // Provide more specific error messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorString = JSON.stringify(error);
        
        console.error("[CANCEL SUBSCRIPTION] Full error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack,
          errorString,
        });
        
        // Check for specific Clerk API errors
        if (errorMessage.includes("422") || errorMessage.includes("unprocessable entity")) {
          return {
            success: false,
            error: "Unable to cancel subscription through the app. Please cancel your subscription directly through Clerk's dashboard or contact support for assistance.",
          };
        }
        if (errorMessage.includes("404") || errorMessage.includes("not found")) {
          return {
            success: false,
            error: "Subscription not found. You may not have an active subscription.",
          };
        }
        if (errorMessage.includes("billing") && errorMessage.includes("not configured")) {
          return {
            success: false,
            error: "Billing is not properly configured. Please contact support to cancel your subscription.",
          };
        }
        return {
          success: false,
          error: error.message || "Failed to cancel subscription. Please try again or contact support.",
        };
      }
    
    return {
      success: false,
      error: "Failed to cancel subscription. Please try again or contact support.",
    };
  }
}

