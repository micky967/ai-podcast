/**
 * User API Keys Utility for Inngest Functions
 *
 * Retrieves and decrypts user API keys for use in processing workflows.
 * This is server-side only - keys are never exposed to client.
 *
 * Security:
 * - Keys are stored encrypted in Convex
 * - Decryption happens server-side in Inngest functions
 * - Frontend never sees decrypted keys
 */

import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex-client";
import { decrypt } from "@/lib/encryption";

export interface DecryptedUserApiKeys {
  openaiApiKey?: string;
  assemblyaiApiKey?: string;
}

/**
 * Get and decrypt user API keys
 *
 * Retrieves encrypted keys from Convex and decrypts them for use in processing.
 * Returns undefined values if keys are not set.
 *
 * @param userId - User ID to get keys for
 * @returns Decrypted API keys, or null if user settings don't exist
 * @throws Error if decryption fails (invalid encryption key or corrupted data)
 */
export async function getUserApiKeys(
  userId: string,
): Promise<DecryptedUserApiKeys | null> {
  // Get encrypted settings from Convex
  const userSettings = await convex.query(api.userSettings.getUserSettings, {
    userId,
  });

  if (!userSettings) {
    return null;
  }

  // Decrypt the keys (server-side only)
  const decrypted: DecryptedUserApiKeys = {};

  if (userSettings.openaiApiKey) {
    try {
      decrypted.openaiApiKey = decrypt(userSettings.openaiApiKey);
    } catch (error) {
      console.error(`Failed to decrypt OpenAI key for user ${userId}:`, error);
      throw new Error(
        `Failed to decrypt OpenAI API key. This may indicate a configuration issue.`,
      );
    }
  }

  if (userSettings.assemblyaiApiKey) {
    try {
      decrypted.assemblyaiApiKey = decrypt(userSettings.assemblyaiApiKey);
    } catch (error) {
      console.error(
        `Failed to decrypt AssemblyAI key for user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to decrypt AssemblyAI API key. This may indicate a configuration issue.`,
      );
    }
  }

  return decrypted;
}

