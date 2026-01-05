/**
 * Project Server Actions
 *
 * Next.js server actions for project creation and workflow triggering.
 * Called from client components after file upload completes.
 *
 * Server Actions vs. API Routes:
 * - Server actions are RSC (React Server Components) feature
 * - Simpler than API routes (no route definition, just async functions)
 * - Automatic form integration, progressive enhancement
 * - Type-safe: Client gets full TypeScript types
 *
 * Security & Feature Gating:
 * - Runs on server (access to server-only APIs)
 * - Validates auth via Clerk
 * - Validates plan limits (defense-in-depth with upload route)
 * - Can't be bypassed by client
 */
"use server";

import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inngest } from "@/inngest/client";
import { validateUserApiKeys } from "@/lib/api-key-utils";
import { convex } from "@/lib/convex-client";
import { checkUploadLimits } from "@/lib/tier-utils";

/**
 * Validate upload before starting
 *
 * Pre-validates upload against plan limits to provide clear error messages
 * before attempting the actual upload to Vercel Blob.
 */
export async function validateUploadAction(input: {
  fileSize: number;
  duration?: number;
}): Promise<{ success: boolean; error?: string }> {
  const authObj = await auth();
  const { userId } = authObj;

  if (!userId) {
    return { success: false, error: "You must be signed in to upload files" };
  }

  // Validate that user has API keys configured (required - no fallback)
  const apiKeyValidation = await validateUserApiKeys(userId);
  if (!apiKeyValidation.valid) {
    return {
      success: false,
      error:
        apiKeyValidation.error ||
        "API keys are required. Please configure them in Settings before uploading.",
    };
  }

  const validation = await checkUploadLimits(
    authObj,
    userId,
    input.fileSize,
    input.duration,
  );

  if (!validation.allowed) {
    console.log("[VALIDATE] Failed:", {
      userId,
      reason: validation.reason,
      message: validation.message,
    });
    return { success: false, error: validation.message };
  }

  console.log("[VALIDATE] Passed:", { userId, fileSize: input.fileSize });
  return { success: true };
}

interface CreateProjectInput {
  fileUrl: string; // Vercel Blob URL
  fileName: string; // Original filename
  fileSize: number; // Bytes
  mimeType: string; // MIME type
  fileDuration?: number; // Seconds (optional)
  categoryId?: Id<"categories">; // Category ID (required)
  subcategoryId?: Id<"categories">; // Subcategory ID (optional)
  difficulty?: number; // Optional difficulty level for clinical scenarios (1-5)
}

/**
 * Create project and trigger Inngest workflow
 *
 * Atomic Operation (both or neither):
 * 1. Validate user's plan and limits
 * 2. Create project record in Convex with user's plan
 * 3. Send event to Inngest to start processing
 *
 * Flow:
 * 1. Client uploads file to Vercel Blob (validated in upload route)
 * 2. Client calls this server action with file metadata
 * 3. This action validates limits again (defense-in-depth)
 * 4. This action creates Convex project (status: "uploaded")
 * 5. This action triggers Inngest workflow with plan info
 * 6. Inngest processes podcast asynchronously based on plan
 * 7. Client redirects to project detail page
 *
 * Error Handling:
 * - Throws on auth failure (caught by client)
 * - Throws on missing fields (caught by client)
 * - Throws on plan limit exceeded (caught by client)
 * - Throws on Convex/Inngest errors (caught by client)
 * - Client shows error toast and allows retry
 *
 * @param input - File metadata from Vercel Blob upload
 * @returns Project ID for navigation
 * @throws Error if authentication fails, limits exceeded, or required fields missing
 */
export async function createProjectAction(input: CreateProjectInput) {
  try {
    // Authenticate user and get plan via Clerk
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const {
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      fileDuration,
      categoryId,
      subcategoryId,
      difficulty,
    } = input;

    // Validate required fields
    if (!fileUrl || !fileName) {
      throw new Error("Missing required fields");
    }

    // Validate category is provided (required)
    if (!categoryId) {
      throw new Error("Category is required. Please select a category.");
    }

    // Validate limits using Clerk's has() method
    const { has } = authObj;

    // Determine user's plan using Clerk
    let plan: "free" | "pro" | "ultra" = "free";
    if (has?.({ plan: "ultra" })) {
      plan = "ultra";
    } else if (has?.({ plan: "pro" })) {
      plan = "pro";
    }

    const validation = await checkUploadLimits(
      authObj,
      userId,
      fileSize || 0,
      fileDuration,
    );

    if (!validation.allowed) {
      throw new Error(validation.message || "Upload not allowed for your plan");
    }

    // Validate API keys are configured (required - no fallback to shared keys)
    const apiKeyValidation = await validateUserApiKeys(userId);
    if (!apiKeyValidation.valid) {
      throw new Error(
        apiKeyValidation.error ||
          "API keys are required. Please configure OpenAI and AssemblyAI keys in Settings before processing podcasts.",
      );
    }

    // Extract file extension for display
    const fileExtension = fileName.split(".").pop() || "unknown";

    // Create project in Convex database
    // Status starts as "uploaded", will be updated by Inngest
    const projectId = await convex.mutation(api.projects.createProject, {
      userId,
      inputUrl: fileUrl,
      fileName,
      fileSize: fileSize || 0,
      fileDuration,
      fileFormat: fileExtension,
      mimeType: mimeType,
      categoryId: categoryId,
      subcategoryId: subcategoryId || undefined,
    });

    // Trigger Inngest workflow asynchronously with user's current plan
    // Event name "podcast/uploaded" matches workflow trigger
    // Fire-and-forget: don't await to avoid blocking HTTP response
    console.log(
      `[INNGEST] 🚀 Sending event "podcast/uploaded" for project ${projectId}`,
    );
    console.log(`[INNGEST] Event data:`, {
      projectId,
      userId,
      plan,
      fileUrl: `${fileUrl.substring(0, 50)}...`,
      fileName,
      fileSize,
      mimeType,
      difficulty,
    });

    // biome-ignore lint/suspicious/noExplicitAny: Inngest event types defined in podcast-processor
    (inngest.send as any)({
      name: "podcast/uploaded",
      data: {
        projectId,
        userId,
        plan,
        fileUrl,
        fileName,
        fileSize: fileSize || 0,
        mimeType: mimeType,
        difficulty,
      },
    })
      .then(() => {
        console.log(
          `[INNGEST] ✅ Event sent successfully for project ${projectId}`,
        );
      })
      .catch((error) => {
        console.error(
          `[INNGEST] ❌ Failed to send event for project ${projectId}:`,
          error,
        );
      });

    console.log(
      `[INNGEST] Event dispatched (fire-and-forget), returning to client`,
    );
    // Return immediately - don't wait for Inngest workflow to complete
    return { success: true, projectId };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error; // Re-throw for client error handling
  }
}

/**
 * Delete project and associated Blob storage
 *
 * Flow:
 * 1. Validate user authentication
 * 2. Call Convex mutation to delete project (validates ownership)
 * 3. Delete file from Vercel Blob storage
 *
 * Error Handling:
 * - Throws on auth failure
 * - Throws if project not found or user doesn't own it
 * - Logs but doesn't throw on Blob deletion failure (already deleted from DB)
 *
 * @param projectId - Convex project ID
 * @returns Success response
 * @throws Error if authentication fails or user doesn't own project
 */
export async function deleteProjectAction(projectId: Id<"projects">) {
  try {
    // Authenticate user via Clerk
    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    console.log(
      `[DELETE] Attempting to delete project ${projectId} by user ${userId}`,
    );

    // Delete from Convex (validates ownership, returns inputUrl)
    // The mutation validates that the user owns the project
    const result = await convex.mutation(api.projects.deleteProject, {
      projectId,
      userId,
    });

    console.log(
      `[DELETE] Project ${projectId} successfully soft-deleted in Convex`,
    );

    // Delete file from Vercel Blob
    // If this fails, we've already deleted from DB - log but don't throw
    try {
      await del(result.inputUrl);
      console.log(`[DELETE] File ${result.inputUrl} deleted from Blob storage`);
    } catch (blobError) {
      console.error(
        "[DELETE] Failed to delete file from Blob storage:",
        blobError,
      );
      // Don't throw - project is already deleted from database
    }

    return { success: true };
  } catch (error) {
    console.error("[DELETE] Error deleting project:", error);
    console.error("[DELETE] Error details:", {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Update project display name
 *
 * Flow:
 * 1. Validate user authentication
 * 2. Call Convex mutation to update displayName (validates ownership)
 *
 * Real-time Impact:
 * - All subscribed components instantly see the new name
 *
 * @param projectId - Convex project ID
 * @param displayName - New display name
 * @returns Success response
 * @throws Error if authentication fails or user doesn't own project
 */
export async function updateDisplayNameAction(
  projectId: Id<"projects">,
  displayName: string,
) {
  try {
    // Authenticate user via Clerk
    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Validate display name
    if (!displayName || displayName.trim().length === 0) {
      throw new Error("Display name cannot be empty");
    }

    if (displayName.length > 200) {
      throw new Error("Display name is too long (max 200 characters)");
    }

    // Update in Convex (validates ownership)
    await convex.mutation(api.projects.updateProjectDisplayName, {
      projectId,
      userId,
      displayName: displayName.trim(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating display name:", error);
    throw error;
  }
}

/**
 * Generate quiz for an existing project
 *
 * Allows users to manually generate quiz for old projects that have hashtags.
 * Works for both podcasts and documents.
 *
 * Flow:
 * 1. Validate user authentication
 * 2. Get project to determine content type
 * 3. Trigger Inngest event to generate quiz
 *
 * @param projectId - Convex project ID
 * @returns Success response
 * @throws Error if authentication fails or project not found
 */
export async function generateQuizAction(input: {
  projectId: Id<"projects">;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get project to check ownership and determine content type
    const project = await convex.query(api.projects.getProject, {
      projectId: input.projectId,
      userId,
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Check if quiz already exists with questions
    // Allow regeneration if quiz is empty, failed, or has no questions
    if (
      project.quiz?.questions &&
      project.quiz.questions.length > 0 &&
      project.quiz.status !== "failed"
    ) {
      return { success: false, error: "Quiz already exists for this project" };
    }

    // Determine content type (kept for future use)
    const _isDocument =
      project.mimeType === "application/pdf" ||
      project.mimeType === "application/msword" ||
      project.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      project.mimeType === "text/plain";

    // Get user's current plan
    const authObj = await auth();
    const { has } = authObj;
    let currentPlan: "free" | "pro" | "ultra" = "free";
    if (has?.({ plan: "ultra" })) {
      currentPlan = "ultra";
    } else if (has?.({ plan: "pro" })) {
      currentPlan = "pro";
    }

    // Infer original plan (for retry-job compatibility)
    let originalPlan: "free" | "pro" | "ultra" = "free";
    if (project.keyMoments || project.youtubeTimestamps || project.engagement) {
      originalPlan = "ultra";
    } else if (
      project.socialPosts ||
      project.hashtags ||
      project.titles ||
      project.powerPoint
    ) {
      originalPlan = "pro";
    }

    // Trigger Inngest event to generate quiz
    // biome-ignore lint/suspicious/noExplicitAny: Inngest event types defined in retry-job function
    await (inngest.send as any)({
      name: "podcast/retry-job",
      data: {
        projectId: input.projectId,
        job: "quiz",
        userId,
        originalPlan,
        currentPlan,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error generating quiz:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate quiz",
    };
  }
}
