/**
 * Retry Job Function - Retries Individual Failed Generation Steps
 *
 * Triggered when user clicks retry button on a failed tab.
 * Regenerates just that specific output without reprocessing everything.
 * Supports upgrade scenarios - if user upgraded, can generate newly-unlocked features.
 */
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex-client";
import type { FeatureName, PlanName } from "@/lib/tier-config";
import { FEATURE_TO_JOB_MAP } from "@/lib/tier-config";
import { planHasFeature } from "@/lib/tier-utils";
import { inngest } from "../client";
import { generateEngagement } from "../steps/ai-generation/engagement";
import { generateHashtags } from "../steps/ai-generation/hashtags";
import { generateKeyMoments } from "../steps/ai-generation/key-moments";
import { generatePowerPoint } from "../steps/ai-generation/powerpoint";
import { generateSocialPosts } from "../steps/ai-generation/social-posts";
import { generateSummary } from "../steps/ai-generation/summary";
import { generateTitles } from "../steps/ai-generation/titles";
import { generateYouTubeTimestamps } from "../steps/ai-generation/youtube-timestamps";
import { getUserApiKeys } from "../lib/user-api-keys";
import type { TranscriptWithExtras } from "../types/assemblyai";

export const retryJobFunction = inngest.createFunction(
  { id: "retry-job" },
  { event: "podcast/retry-job" },
  async ({ event, step }) => {
    const { projectId, job, originalPlan, currentPlan, userId } = event.data;

    // Check if user is owner - owners bypass plan restrictions
    const isOwner = await step.run("check-user-owner", async () => {
      if (!userId) {
        return false;
      }
      return await convex.query(api.userSettings.isUserOwner, { userId });
    });

    // Check if user has upgraded and now has access to this feature
    const currentUserPlan = (currentPlan as PlanName) || "free";
    const originalUserPlan = (originalPlan as PlanName) || "free";

    // Get feature key from job name using the shared mapping
    const jobToFeature = Object.fromEntries(
      Object.entries(FEATURE_TO_JOB_MAP).map(([k, v]) => [v, k]),
    );

    // Check if user has access to this feature with current plan (owners bypass)
    const featureKey = jobToFeature[job];
    if (
      !isOwner &&
      featureKey &&
      !planHasFeature(currentUserPlan, featureKey as FeatureName)
    ) {
      throw new Error(
        `This feature (${job}) is not available on your current plan. Please upgrade to access it.`,
      );
    }

    // Log if this is an upgrade scenario
    if (originalUserPlan !== currentUserPlan) {
      console.log(
        `User upgraded from ${originalUserPlan} to ${currentUserPlan}. Generating ${job}.`,
      );
    }

    // Get project to access transcript and userId
    if (!userId) {
      throw new Error("userId is required in event data");
    }
    const project = await convex.query(api.projects.getProject, { projectId, userId });
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if this is a document file (not audio)
    const isDocument =
      project.mimeType === "application/pdf" ||
      project.mimeType === "application/msword" ||
      project.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      project.mimeType === "text/plain";

    // Check for transcript - required for all jobs
    if (!project.transcript) {
      throw new Error(
        isDocument
          ? "Document text not found. Please re-upload the document file to extract the text."
          : "Transcript not found. Please re-upload the audio file to generate the transcript.",
      );
    }

    // For documents, certain jobs are not applicable
    if (isDocument) {
    if (
      job === "keyMoments" ||
      job === "youtubeTimestamps" ||
      job === "socialPosts"
    ) {
        throw new Error(
          `${job} is not available for document files. This feature requires audio content with timestamps.`,
        );
      }
    }

    // Get and decrypt user API keys (BYOK support)
    // Keys are stored encrypted in Convex, decrypted server-side here
    // userId is already available from event.data
    const userApiKeys = await getUserApiKeys(userId);

    const openaiApiKey = userApiKeys?.openaiApiKey;

    // Validate that required API keys are present (no fallback to shared keys)
    if (!openaiApiKey) {
      throw new Error(
        "OpenAI API key is required. Please add your OpenAI API key in Settings.",
      );
    }

    // Validate we have the complete transcript data needed for generation
    const transcript = project.transcript as TranscriptWithExtras;

    // Debug logging for transcript structure
    console.log(
      `[RETRY JOB] Transcript check for job ${job}:`,
      {
        hasTranscript: !!project.transcript,
        transcriptType: typeof project.transcript,
        hasText: !!(project.transcript as any)?.text,
        textLength: (project.transcript as any)?.text?.length || 0,
        transcriptKeys: project.transcript ? Object.keys(project.transcript) : [],
      },
    );

    // Basic validation: All jobs need transcript text
    if (!transcript || !transcript.text || transcript.text.trim().length === 0) {
      const errorMessage = isDocument
        ? "Document text is empty or missing. Please re-upload the document file to extract the text."
        : "Transcript text is empty or missing. Please re-upload the audio file to generate the transcript.";
      console.error(`[RETRY JOB] ${errorMessage}`, {
        projectId,
        job,
        hasTranscript: !!project.transcript,
        transcriptStructure: project.transcript,
      });
      throw new Error(errorMessage);
    }

    // Job-specific validation for jobs that require chapters
    // Documents don't have chapters, so skip this validation for documents
    if (!isDocument) {
      const jobsRequiringChapters = ["keyMoments", "youtubeTimestamps"];
      if (jobsRequiringChapters.includes(job)) {
        if (!transcript.chapters || transcript.chapters.length === 0) {
          throw new Error(
            `Cannot generate ${job}: transcript has no chapters. This podcast may be too short or lack distinct topics for chapter detection.`,
          );
        }
      }
    }

    // Other jobs (summary, socialPosts, titles, powerPoint) can work with just text
    // They will use chapters if available for better context, but don't require them

    // Regenerate the specific job
    try {
      switch (job) {
        case "keyMoments": {
          const result = await generateKeyMoments(transcript);
          await step.run("save-key-moments", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              keyMoments: result,
            }),
          );
          break;
        }

        case "summary": {
          const result = await generateSummary(step, transcript, openaiApiKey);
          await step.run("save-summary", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              summary: result,
            }),
          );
          break;
        }

        case "socialPosts": {
          const result = await generateSocialPosts(
            step,
            transcript,
            openaiApiKey,
          );
          await step.run("save-social-posts", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              socialPosts: result,
            }),
          );
          break;
        }

        case "hashtags": {
          const result = await generateHashtags(step, transcript, openaiApiKey);
          await step.run("save-hashtags", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              hashtags: result,
            }),
          );
          break;
        }

        case "titles": {
          const result = await generateTitles(step, transcript, openaiApiKey);
          await step.run("save-titles", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              titles: result,
            }),
          );
          break;
        }

        case "powerPoint": {
          const result = await generatePowerPoint(
            step,
            transcript,
            isDocument ? "document" : "audio",
            openaiApiKey,
          );
          // Transform PowerPoint AI output to match Convex schema
          const powerPointForConvex = {
            status: "completed" as const,
            template: result.theme,
            summary: result.summary,
            slides: result.slides,
            downloadUrl: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await step.run("save-powerpoint", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              powerPoint: powerPointForConvex,
            }),
          );
          break;
        }

        case "youtubeTimestamps": {
          const result = await generateYouTubeTimestamps(
            step,
            transcript,
            openaiApiKey,
          );
          await step.run("save-youtube-timestamps", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              youtubeTimestamps: result,
            }),
          );
          break;
        }

        case "engagement": {
          const result = await generateEngagement(
            step,
            transcript,
            openaiApiKey,
          );
          await step.run("save-engagement", () =>
            convex.mutation(api.projects.saveGeneratedContent, {
              projectId,
              engagement: result,
            }),
          );
          break;
        }

        default:
          throw new Error(`Unknown job type: ${job}`);
      }

      // Clear the error for this job after successful completion
      await step.run("clear-job-error", async () => {
        const currentErrors = project.jobErrors || {};
        const updatedErrors = { ...currentErrors };
        delete updatedErrors[job as keyof typeof updatedErrors];

        await convex.mutation(api.projects.saveJobErrors, {
          projectId,
          jobErrors: updatedErrors,
        });
      });

      return { success: true, job };
    } catch (error) {
      // Save the error back to Convex
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await convex.mutation(api.projects.saveJobErrors, {
        projectId,
        jobErrors: {
          [job]: errorMessage,
        },
      });

      throw error;
    }
  },
);
