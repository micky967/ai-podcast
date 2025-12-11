/**
 * API Key Validation Utilities
 *
 * Validates that users have provided their API keys before processing.
 * Users MUST have their own keys - no fallback to shared keys.
 */

import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex-client";

export interface ApiKeyValidationResult {
  valid: boolean;
  missingKeys?: string[];
  error?: string;
}

/**
 * Check if user has required API keys configured
 *
 * Validates that user has both OpenAI and AssemblyAI keys.
 * Both are required for processing to work.
 *
 * @param userId - User ID to check
 * @returns Validation result with details about missing keys
 */
export async function validateUserApiKeys(
  userId: string,
): Promise<ApiKeyValidationResult> {
  try {
    const userSettings = await convex.query(
      api.userSettings.getUserSettings,
      { userId },
    );

    const missingKeys: string[] = [];

    if (!userSettings?.openaiApiKey) {
      missingKeys.push("OpenAI");
    }

    if (!userSettings?.assemblyaiApiKey) {
      missingKeys.push("AssemblyAI");
    }

    if (missingKeys.length > 0) {
      return {
        valid: false,
        missingKeys,
        error: `API keys required: ${missingKeys.join(" and ")}. Please add them in Settings.`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error validating API keys:", error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to validate API keys. Please try again.",
    };
  }
}




