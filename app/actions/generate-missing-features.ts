"use server";

/**
 * Server Action: Generate All Missing Features After Upgrade
 *
 * When a user upgrades their plan, this action triggers generation of ALL
 * features available in their new plan that weren't generated when the project
 * was processed on their old plan.
 *
 * Example: User had Free plan (only Summary), upgrades to Pro.
 * This will generate: Social Posts, Titles, Hashtags all at once.
 *
 * Note: Transcription is NOT a feature - it's available to all users.
 */

import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inngest } from "@/inngest/client";
// Removed getUserPlan - using Clerk's has() directly per docs
import { convex } from "@/lib/convex-client";
import { FEATURE_TO_JOB_MAP, PLAN_FEATURES } from "@/lib/tier-config";
import type { RetryableJob } from "./retry-job";

/**
 * Generate all missing features for user's current plan
 *
 * Determines which features are available in current plan but missing from project,
 * then triggers parallel Inngest jobs to generate them all at once.
 */
export async function generateMissingFeatures(projectId: Id<"projects">) {
  const authObj = await auth();
  const { userId, has } = authObj;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Get user's current plan using Clerk's has() method
  let currentPlan: "free" | "pro" | "ultra" = "free";
  if (has?.({ plan: "ultra" })) {
    currentPlan = "ultra";
  } else if (has?.({ plan: "pro" })) {
    currentPlan = "pro";
  }

  // Get project to check what's already generated
  const project = await convex.query(api.projects.getProject, { projectId, userId });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Unauthorized - not your project");
  }

  // Check if this is a document file (not audio)
  const isDocument =
    project.mimeType === "application/pdf" ||
    project.mimeType === "application/msword" ||
    project.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    project.mimeType === "text/plain";

  // Infer what plan was used during processing based on generated features
  let originalPlan: "free" | "pro" | "ultra" = "free";
  if (project.keyMoments || project.youtubeTimestamps) {
    originalPlan = "ultra";
  } else if (project.socialPosts || project.titles || project.hashtags) {
    originalPlan = "pro";
  }

  // Get all features available in current plan
  const availableFeatures = PLAN_FEATURES[currentPlan];

  const missingJobs: RetryableJob[] = [];

  // Check which features are available but not yet generated
  for (const feature of availableFeatures) {
    const jobName =
      FEATURE_TO_JOB_MAP[feature as keyof typeof FEATURE_TO_JOB_MAP];
    if (!jobName) continue; // Skip transcription and summary (always present)

    // For documents, skip features that don't apply:
    // - keyMoments (requires timestamps/chapters)
    // - youtubeTimestamps (requires timestamps)
    // - socialPosts (not generated for documents)
    // - hashtags (not generated for documents)
    if (isDocument) {
      if (
        jobName === "keyMoments" ||
        jobName === "youtubeTimestamps" ||
        jobName === "socialPosts" ||
        jobName === "hashtags"
      ) {
        continue; // Skip these for documents
      }
    }

    // Check if this data exists in the project
    const hasData = Boolean(project[jobName as keyof typeof project]);

    if (!hasData) {
      missingJobs.push(jobName as RetryableJob);
    }
  }

  if (missingJobs.length === 0) {
    throw new Error(
      "No missing features to generate. All features for your plan are already available.",
    );
  }

  // Trigger Inngest jobs for all missing features in parallel
  await Promise.all(
    missingJobs.map((job) =>
      inngest.send({
        name: "podcast/retry-job",
        data: {
          projectId,
          job,
          userId,
          originalPlan,
          currentPlan,
        },
      }),
    ),
  );

  return {
    success: true,
    generated: missingJobs,
    message: `Generating ${missingJobs.length} feature${
      missingJobs.length > 1 ? "s" : ""
    }: ${missingJobs.join(", ")}`,
  };
}
