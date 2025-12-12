/**
 * Podcast Processing Workflow - Main Orchestration Function
 *
 * This is the core of the application - a durable, observable workflow that:
 * 1. Analyzes audio using AssemblyAI (transcription for AI use - runs for ALL plans)
 * 2. Generates AI content in parallel based on user's plan (FREE/PRO/ULTRA)
 * 3. Saves all results to Convex for real-time UI updates
 *
 * Feature Gating by Plan:
 * - FREE: Summary only
 * - PRO: + Social Posts, Titles, PowerPoint Outlines
 * - ULTRA: + YouTube Timestamps, Key Moments, Full Transcript Access
 *
 * Note: Audio analysis (transcription) runs for ALL users to power AI features.
 * Speaker diarization data is always captured but only viewable to ULTRA users.
 *
 * Inngest Benefits for This Use Case:
 * - Durable execution: If OpenAI times out, the step retries automatically
 * - Parallel execution: AI jobs run simultaneously, reducing total time
 * - Real-time updates: UI shows progress via Convex subscriptions
 * - Observability: Full execution history and logs in Inngest dashboard
 * - Type safety: Events and steps are fully typed
 *
 * Triggered by: Server action after file upload to Vercel Blob
 * Event: "podcast/uploaded" with { projectId, fileUrl, userPlan }
 *
 * Workflow Pattern:
 * 1. Update project status to "processing"
 * 2. Transcribe audio (sequential - required for next steps)
 * 3. Generate content in parallel (conditionally based on plan)
 * 4. Save all results atomically to Convex
 *
 * Real-time Updates:
 * - Convex jobStatus updates trigger automatic UI re-renders
 * - No polling or manual refetching required
 * - UI always shows accurate status from database
 */
import { api } from "@/convex/_generated/api";
import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";
import type { PlanName } from "@/lib/tier-config";
import { generateEngagement } from "../steps/ai-generation/engagement";
import { generateHashtags } from "../steps/ai-generation/hashtags";
import { generateKeyMoments } from "../steps/ai-generation/key-moments";
import { generatePowerPoint } from "../steps/ai-generation/powerpoint";
import { generateSocialPosts } from "../steps/ai-generation/social-posts";
import { generateSummary } from "../steps/ai-generation/summary";
import { generateTitles } from "../steps/ai-generation/titles";
import { generateYouTubeTimestamps } from "../steps/ai-generation/youtube-timestamps";
import { getUserApiKeys } from "../lib/user-api-keys";
import { saveResultsToConvex } from "../steps/persistence/save-to-convex";
import { transcribeWithAssemblyAI } from "../steps/transcription/assemblyai";
import { extractTextFromDocument } from "../steps/document-extraction/text-extractor";

export const podcastProcessor = inngest.createFunction(
  {
    id: "podcast-processor",
    // Optimizes parallel step execution (important for the 6 parallel AI jobs)
    optimizeParallelism: true,
    // Retry configuration: 3 attempts with exponential backoff
    retries: 3,
  },
  // Event trigger: sent by server action after upload
  { event: "podcast/uploaded" },
  async ({ event, step }) => {
    const { projectId, fileUrl, plan: userPlan, mimeType, userId } = event.data;
    const plan = (userPlan as PlanName) || "free"; // Default to free if not provided

    console.log(`Processing project ${projectId} for ${plan} plan`);

    try {
      // Get project to retrieve userId, then fetch user API keys (BYOK support)
      const project = await step.run("get-project-for-user-keys", async () => {
        if (!userId) {
          throw new Error("userId is required in event data");
        }
        return await convex.query(api.projects.getProject, { projectId, userId });
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // userId is already available from event.data
      // Verify that the userId from event matches the project's userId for security
      if (project.userId !== userId) {
        throw new Error("Project userId does not match event userId");
      }

      // Determine if this is a document file
      const isDocument =
        mimeType === "application/pdf" ||
        mimeType === "application/msword" ||
        mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "text/plain";

      console.log(
        `[FILE TYPE] mimeType="${mimeType}", isDocument=${isDocument}, plan=${plan}`,
      );

      // Check if user is owner - owners bypass plan restrictions
      const isOwner = await step.run("check-user-owner", async () => {
        return await convex.query(api.userSettings.isUserOwner, { userId });
      });

      if (isOwner) {
        console.log(`[OWNER ACCESS] User ${userId} is owner - bypassing plan restrictions`);
      }

      // Get and decrypt user API keys (BYOK - Bring Your Own Key)
      // Keys are stored encrypted in Convex, decrypted server-side here
      const userApiKeys = await step.run("get-and-decrypt-user-api-keys", async () => {
        return await getUserApiKeys(userId);
      });

      const openaiApiKey = userApiKeys?.openaiApiKey;
      const assemblyaiApiKey = userApiKeys?.assemblyaiApiKey;

      // Validate that required API keys are present (no fallback to shared keys)
      if (!openaiApiKey) {
        throw new Error(
          "OpenAI API key is required. Please add your OpenAI API key in Settings before processing files.",
        );
      }

      // AssemblyAI is only required for audio files
      if (!isDocument && !assemblyaiApiKey) {
        throw new Error(
          "AssemblyAI API key is required. Please add your AssemblyAI API key in Settings before processing audio files.",
        );
      }

      console.log("Using user-provided API keys for processing");

      // Mark project as processing in Convex (UI will show "Processing..." state)
      await step.run("update-status-processing", async () => {
        await convex.mutation(api.projects.updateProjectStatus, {
          projectId,
          status: "processing",
        });
      });

      // Update jobStatus: transcription/text extraction starting
      await step.run("update-job-status-transcription-running", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          transcription: "running",
        });
      });

      // Step 1: Extract text from file
      // For audio: Transcribe with AssemblyAI
      // For documents: Extract text directly
      const transcript = await step.run(
        isDocument ? "extract-text-from-document" : "transcribe-audio",
        () => {
          if (isDocument) {
            return extractTextFromDocument(fileUrl, projectId, mimeType, userId);
          } else {
            return transcribeWithAssemblyAI(
              fileUrl,
              projectId,
              plan,
              assemblyaiApiKey,
            );
          }
        },
      );

      // Update jobStatus: transcription/text extraction complete
      await step.run("update-job-status-transcription-completed", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          transcription: "completed",
        });
      });

      // Update jobStatus: content generation starting
      await step.run("update-job-status-generation-running", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          contentGeneration: "running",
        });
      });

      // Step 2: Run AI generation tasks in parallel based on plan
      // Parallel Pattern: Promise.allSettled allows individual failures without blocking others
      // Performance: ~60s total vs. ~300s sequential (5x faster)
      // Each function can fail independently - we save whatever succeeds

      // Determine which jobs to run based on plan
      const jobs: Promise<any>[] = [];
      const jobNames: string[] = [];

      // Summary - available to all plans
      // Pass user's OpenAI key if provided (BYOK support)
      jobs.push(generateSummary(step, transcript, openaiApiKey));
      jobNames.push("summary");

      // PowerPoint export for PRO/ULTRA plans and owners (audio + document support)
      // Owners can generate PowerPoint regardless of their plan
      if (plan === "pro" || plan === "ultra" || isOwner) {
        if (isOwner && plan === "free") {
          console.log(`[OWNER ACCESS] Generating PowerPoint for owner on ${plan} plan`);
        }
        jobs.push(
          generatePowerPoint(
            step,
            transcript,
            isDocument ? "document" : "audio",
            openaiApiKey,
          ),
        );
        jobNames.push("powerPoint");
      }

      // For documents, skip certain features (YouTube timestamps, social posts, key moments)
      // Documents don't have timestamps or need social media optimization
      if (!isDocument) {
        // AUDIO FILES: Generate all features based on plan
        console.log(`[AUDIO FILE] Generating audio-specific features for ${plan} plan`);

        // PRO and ULTRA features (audio only) - owners also get access
        if (plan === "pro" || plan === "ultra" || isOwner) {
          if (isOwner && plan === "free") {
            console.log(`[OWNER ACCESS] Generating social posts, hashtags, and titles for owner on ${plan} plan`);
          }
          jobs.push(generateSocialPosts(step, transcript, openaiApiKey));
          jobNames.push("socialPosts");

          jobs.push(generateHashtags(step, transcript, openaiApiKey));
          jobNames.push("hashtags");

          jobs.push(generateTitles(step, transcript, openaiApiKey));
          jobNames.push("titles");
        } else {
          console.log(`[AUDIO] Skipping social posts, hashtags and titles for ${plan} plan`);
        }

        // ULTRA-only features (audio only)
        if (plan === "ultra") {
          jobs.push(generateKeyMoments(transcript));
          jobNames.push("keyMoments");

          jobs.push(
            generateYouTubeTimestamps(step, transcript, openaiApiKey),
          );
          jobNames.push("youtubeTimestamps");
        } else {
          console.log(
            `[AUDIO] Skipping key moments and YouTube timestamps for ${plan} plan`,
          );
        }
      } else {
        // DOCUMENT FILES: Only generate Summary, Titles, PowerPoint, and Engagement Tools
        console.log(
          `[DOCUMENT FILE] Only generating: Summary, Titles (${
            plan === "pro" || plan === "ultra" ? "YES" : "NO"
          }), PowerPoint (${
            plan === "pro" || plan === "ultra" ? "YES" : "NO"
          }), Engagement Tools (${plan === "ultra" ? "YES" : "NO"})`,
        );
        console.log(
          `[DOCUMENT FILE] SKIPPING: social posts, YouTube timestamps, key moments`,
        );

        if (plan === "pro" || plan === "ultra" || isOwner) {
          if (isOwner && plan === "free") {
            console.log(`[OWNER ACCESS] Generating hashtags and titles for owner on ${plan} plan`);
          }
          jobs.push(generateHashtags(step, transcript, openaiApiKey));
          jobNames.push("hashtags");

          jobs.push(generateTitles(step, transcript, openaiApiKey));
          jobNames.push("titles");
        }
      }

      // Engagement tools available for all file types (ULTRA plan)
      if (plan === "ultra") {
        jobs.push(generateEngagement(step, transcript, openaiApiKey));
        jobNames.push("engagement");
      } else if (!isDocument) {
        console.log(
          `Skipping engagement tools for ${plan} plan`,
        );
      }

      // Log which jobs will be executed
      console.log(
        `[JOB EXECUTION] ${isDocument ? "DOCUMENT" : "AUDIO"} file - Executing ${jobs.length} jobs for ${plan} plan:`,
        jobNames,
      );
      console.log(
        `[JOB EXECUTION] Jobs array length: ${jobs.length}, Job names: [${jobNames.join(", ")}]`,
      );
      
      // Verify no unwanted jobs for documents
      if (isDocument) {
        const unwantedJobs = ["keyMoments", "youtubeTimestamps", "socialPosts"];
        const foundUnwanted = jobNames.filter((name) => unwantedJobs.includes(name));
        if (foundUnwanted.length > 0) {
          console.error(
            `[ERROR] Document file should not have these jobs: ${foundUnwanted.join(", ")}`,
          );
        }
      }

      // Run all enabled jobs in parallel
      const results = await Promise.allSettled(jobs);

      // Extract successful results based on plan
      // Build results object dynamically based on what was run
      const generatedContent: Record<string, any> = {};

      results.forEach((result, idx) => {
        const jobName = jobNames[idx];
        if (result.status === "fulfilled") {
          generatedContent[jobName] = result.value;
        }
      });

      // Track errors for each failed job
      const jobErrors: Record<string, string> = {};

      results.forEach((result, idx) => {
        if (result.status === "rejected") {
          const jobName = jobNames[idx];
          const errorMessage =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);

          jobErrors[jobName] = errorMessage;
          console.error(`Failed to generate ${jobName}:`, result.reason);
        }
      });

      // Save errors to Convex if any jobs failed
      if (Object.keys(jobErrors).length > 0) {
        await step.run("save-job-errors", () =>
          convex.mutation(api.projects.saveJobErrors, {
            projectId,
            jobErrors,
          }),
        );
      }

      // Update jobStatus: content generation complete
      await step.run("update-job-status-generation-completed", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          contentGeneration: "completed",
        });
      });

      // Step 3: Save all results to Convex in one atomic operation
      // Convex mutation updates the project, triggering UI re-render
      await step.run("save-results-to-convex", () =>
        saveResultsToConvex(projectId, generatedContent),
      );

      // Workflow complete - return success
      return { success: true, projectId, plan };
    } catch (error) {
      // Handle any errors that occur during the workflow
      console.error("Podcast processing failed:", error);

      // Update project status to failed with error details
      // NOTE: NOT wrapped in step.run() so this executes immediately, even during retries
      try {
        await convex.mutation(api.projects.recordError, {
          projectId,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          step: "workflow",
          details: error instanceof Error
            ? { stack: error.stack }
            : undefined,
        });
      } catch (cleanupError) {
        // If cleanup fails, log it but don't prevent the original error from being thrown
        console.error("Failed to update project status:", cleanupError);
      }

      // Re-throw to mark function as failed in Inngest (triggers retry if attempts remain)
      throw error;
    }
  },
);
