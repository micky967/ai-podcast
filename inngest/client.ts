/**
 * Inngest Client Configuration
 *
 * Inngest is a durable execution engine for background jobs and workflows.
 * It provides:
 * - Durable execution: Steps are retried on failure, progress is never lost
 * - Parallel execution: Run multiple steps simultaneously for better performance
 * - Observability: Built-in logging, metrics, and tracing
 * - Type safety: Full TypeScript support for events and functions
 */
import { Inngest } from "inngest";

// Initialize Inngest client
// The ID must match across all environments (dev, staging, prod)
export const inngest = new Inngest({
  id: "ai-podcast-saas-inngest-coderabbit-clerk",
});