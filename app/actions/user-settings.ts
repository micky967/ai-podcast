/**
 * User Settings Server Actions
 *
 * Handles saving and updating user-provided API keys.
 * These keys allow users to use their own API keys instead of shared ones.
 */

"use server";

import { auth } from "@clerk/nextjs/server";
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

