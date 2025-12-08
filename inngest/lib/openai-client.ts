/**
 * OpenAI Client Configuration
 *
 * Centralized OpenAI client used by all AI generation steps.
 * Supports both shared (environment) and user-provided API keys (BYOK).
 *
 * Usage Pattern:
 * - Import createOpenAIClient() in all AI generation functions
 * - Pass optional userApiKey to use user's key, otherwise uses environment key
 * - Wrap calls with step.ai.wrap() for Inngest observability
 * - Use Structured Outputs (zodResponseFormat) for type-safe responses
 *
 * Environment:
 * - Falls back to OPENAI_API_KEY environment variable if user key not provided
 * - Configure in Vercel/Inngest dashboard
 *
 * Models Used:
 * - gpt-5-mini: Fast and cost-effective for content generation
 * - Can be swapped to gpt-4 for higher quality if needed
 */
import OpenAI from "openai";

// Default client using environment variable (for backward compatibility)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create an OpenAI client instance with user API key or fallback to environment key
 *
 * @param userApiKey - Optional user-provided API key (falls back to environment key if not provided)
 * @returns OpenAI client instance using user key or environment key
 */
export function createOpenAIClient(userApiKey?: string): OpenAI {
  // Use user key if provided, otherwise fall back to environment key
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is required. Please add your OpenAI API key in Settings or configure OPENAI_API_KEY environment variable.",
    );
  }

  return new OpenAI({
    apiKey,
  });
}

/**
 * Create a bound OpenAI completion function for use with step.ai.wrap()
 * This reduces code duplication across AI generation functions
 *
 * @param userApiKey - Optional user-provided API key
 * @returns Bound createCompletion function ready for step.ai.wrap()
 */
export function createBoundCompletion(userApiKey?: string) {
  const openai = createOpenAIClient(userApiKey);
  return openai.chat.completions.create.bind(openai.chat.completions);
}
