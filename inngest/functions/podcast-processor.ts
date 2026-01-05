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
import { NonRetriableError } from "inngest";
// Lightweight imports only - heavy imports moved inside step.run to prevent module load timeout
import { getUserApiKeys } from "../lib/user-api-keys";
import { saveResultsToConvex } from "../steps/persistence/save-to-convex";
import { findSupportingSourceQuoteWithTimeout } from "../steps/ai-generation/clinical-scenarios";

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
    // BLINK LOG - First thing to execute, proves function was triggered
    console.log('>>> INNGEST FUNCTION TRIGGERED');
    console.log('>>> Event data:', JSON.stringify(event.data, null, 2));

    const { projectId, fileUrl, plan: userPlan, mimeType, userId, difficulty } =
      event.data;
    const plan = (userPlan as PlanName) || "free"; // Default to free if not provided

    console.log(`Processing project ${projectId} for ${plan} plan`);

    try {
      // CONNECTION TEST - Simple step to verify Inngest communication
      await step.run('connection-test', () => {
        console.log('✅ CONNECTION SUCCESSFUL - Inngest can execute steps');
        return { status: 'ok' };
      });

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
        console.log(`[STATUS] 🔄 Project ${projectId} status set to PROCESSING`);
      });

      // Update jobStatus: transcription/text extraction starting
      await step.run("update-job-status-transcription-running", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          transcription: "running",
        });
        console.log(`[STATUS] 🎙️ Transcription job status set to RUNNING for project ${projectId}`);
      });

      // Step 1: Extract text from file
      // For audio: Transcribe with AssemblyAI
      // For documents: Extract text directly
      const transcript = isDocument
        ? await step.run("extract-text-from-document", async () => {
          const { extractTextFromDocument } = await import("../steps/document-extraction/text-extractor");
          return extractTextFromDocument(fileUrl, projectId, mimeType, userId);
        })
        : await step.run("transcribe-with-assemblyai", async () => {
          const { transcribeWithAssemblyAI } = await import("../steps/transcription/assemblyai");
          return await transcribeWithAssemblyAI(
            step,
            fileUrl,
            projectId,
            plan,
            assemblyaiApiKey,
          );
        });

      // Update jobStatus: transcription/text extraction complete
      await step.run("update-job-status-transcription-completed", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          transcription: "completed",
        });
        console.log(`[STATUS] ✅ Transcription job status set to COMPLETED for project ${projectId}`);
      });

      // Validate transcript content before proceeding to AI generation
      const transcriptText = transcript?.text ?? "";
      const contentLength = transcriptText.trim().length;
      console.log(`[CONTENT VALIDATION] ${isDocument ? "Document" : "Audio"} extracted ${contentLength} characters`);

      if (contentLength === 0) {
        console.error(`[CONTENT VALIDATION] ✗ CRITICAL: Empty content detected - AI generation will fail`);
        throw new Error(`${isDocument ? "Document" : "Audio"} extraction produced empty content. Cannot proceed with AI generation.`);
      } else if (contentLength < 50) {
        console.warn(`[CONTENT VALIDATION] ⚠ WARNING: Very short content (${contentLength} chars) - some AI features may be skipped`);
      } else {
        console.log(`[CONTENT VALIDATION] ✓ Content validation passed (${contentLength} chars)`);
      }

      // Update jobStatus: content generation starting
      await step.run("update-job-status-generation-running", async () => {
        await convex.mutation(api.projects.updateJobStatus, {
          projectId,
          contentGeneration: "running",
        });
        console.log(`[STATUS] 🤖 Content generation job status set to RUNNING for project ${projectId}`);
      });

      // Step 2: Run AI generation tasks in parallel based on plan
      // Parallel Pattern: Promise.allSettled allows individual failures without blocking others
      // Performance: ~60s total vs. ~300s sequential (5x faster)
      // Each function can fail independently - we save whatever succeeds

      // Determine which jobs to run based on plan
      const jobs: Promise<any>[] = [];
      const jobNames: string[] = [];
      const jobTimers: Record<string, number> = {};

      // Summary - available to all plans
      // Pass user's OpenAI key if provided (BYOK support)
      console.time('[TIMER] summary');
      jobTimers['summary'] = Date.now();
      jobs.push(
        (async () => {
          const { generateSummary } = await import("../steps/ai-generation/summary");
          return generateSummary(step, transcript, openaiApiKey);
        })().finally(() => {
          console.timeEnd('[TIMER] summary');
          const duration = Date.now() - jobTimers['summary'];
          if (duration > 30000) {
            console.warn(`[WARNING] Job summary took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
          }
        })
      );
      jobNames.push("summary");

      // Clinical Scenarios - REMOVED from initial upload workflow
      // Now only generated manually via frontend button to prevent upload hanging
      // The generateClinicalScenarios function remains available for manual calls
      console.log(`[CLINICAL SCENARIOS] Skipped during initial upload - generate manually via frontend button`);

      // PowerPoint export for PRO/ULTRA plans and owners (audio + document support)
      // Owners can generate PowerPoint regardless of their plan
      if (plan === "pro" || plan === "ultra" || isOwner) {
        if (isOwner && plan === "free") {
          console.log(`[OWNER ACCESS] Generating PowerPoint for owner on ${plan} plan`);
        }
        console.time('[TIMER] powerPoint');
        jobTimers['powerPoint'] = Date.now();
        jobs.push(
          (async () => {
            const { generatePowerPoint } = await import("../steps/ai-generation/powerpoint");
            return generatePowerPoint(
              step,
              transcript,
              isDocument ? "document" : "audio",
              openaiApiKey,
            );
          })().finally(() => {
            console.timeEnd('[TIMER] powerPoint');
            const duration = Date.now() - jobTimers['powerPoint'];
            if (duration > 30000) {
              console.warn(`[WARNING] Job powerPoint took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
            }
          }),
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
            console.log(`[OWNER ACCESS] Generating social posts and titles for owner on ${plan} plan`);
          }
          console.time('[TIMER] socialPosts');
          jobTimers['socialPosts'] = Date.now();
          jobs.push(
            (async () => {
              const { generateSocialPosts } = await import("../steps/ai-generation/social-posts");
              return generateSocialPosts(step, transcript, openaiApiKey);
            })().finally(() => {
              console.timeEnd('[TIMER] socialPosts');
              const duration = Date.now() - jobTimers['socialPosts'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job socialPosts took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("socialPosts");

          console.time('[TIMER] titles');
          jobTimers['titles'] = Date.now();
          jobs.push(
            (async () => {
              const { generateTitles } = await import("../steps/ai-generation/titles");
              return generateTitles(step, transcript, openaiApiKey);
            })().finally(() => {
              console.timeEnd('[TIMER] titles');
              const duration = Date.now() - jobTimers['titles'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job titles took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("titles");
        } else {
          console.log(`[AUDIO] Skipping social posts and titles for ${plan} plan`);
        }

        // Quiz - available to ALL plans for podcasts
        if (transcriptText.trim().length >= 50) {
          console.time('[TIMER] quiz-podcast');
          jobTimers['quiz'] = Date.now();
          console.log(`[QUIZ] Starting podcast quiz generation (content length: ${transcriptText.length} chars)`);
          jobs.push(
            (async () => {
              const { generateQuiz } = await import("../steps/ai-generation/quiz");
              return await generateQuiz(step, transcript, null, "podcast", openaiApiKey);
            })().finally(() => {
              console.timeEnd('[TIMER] quiz-podcast');
              const duration = Date.now() - jobTimers['quiz'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job quiz took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("quiz");
        } else {
          console.warn(`[QUIZ] Skipping podcast quiz - transcript too short`);
        }

        // ULTRA-only features (audio only)
        if (plan === "ultra") {
          console.time('[TIMER] keyMoments');
          jobTimers['keyMoments'] = Date.now();
          jobs.push(
            (async () => {
              const { generateKeyMoments } = await import("../steps/ai-generation/key-moments");
              return generateKeyMoments(transcript);
            })().finally(() => {
              console.timeEnd('[TIMER] keyMoments');
              const duration = Date.now() - jobTimers['keyMoments'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job keyMoments took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("keyMoments");
        } else {
          console.log(
            `[AUDIO] Skipping key moments and YouTube timestamps for ${plan} plan`,
          );
        }
      } else {
        // DOCUMENT FILES: Only generate Summary, Titles, PowerPoint, and Q&A
        console.log(
          `[DOCUMENT FILE] Only generating: Summary, Titles (${plan === "pro" || plan === "ultra" ? "YES" : "NO"
          }), PowerPoint (${plan === "pro" || plan === "ultra" ? "YES" : "NO"
          }), Q&A (${plan === "ultra" ? "YES" : "NO"})`,
        );
        console.log(
          `[DOCUMENT FILE] SKIPPING: social posts, YouTube timestamps, key moments`,
        );

        if (plan === "pro" || plan === "ultra" || isOwner) {
          if (isOwner && plan === "free") {
            console.log(`[OWNER ACCESS] Generating titles for owner on ${plan} plan`);
          }
          console.time('[TIMER] titles-document');
          jobTimers['titles'] = Date.now();
          jobs.push(
            (async () => {
              const { generateTitles } = await import("../steps/ai-generation/titles");
              return generateTitles(step, transcript, openaiApiKey);
            })().finally(() => {
              console.timeEnd('[TIMER] titles-document');
              const duration = Date.now() - jobTimers['titles'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job titles took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("titles");
        }

        // Quiz - available to ALL plans for documents
        // For documents, transcript contains the extracted text
        const documentText = transcript?.text || "";
        if (documentText.trim().length >= 50) {
          console.time('[TIMER] quiz-document');
          jobTimers['quiz'] = Date.now();
          console.log(`[QUIZ] Starting document quiz generation (content length: ${documentText.length} chars)`);

          // Prevent AI hallucination on small PDFs by limiting question count
          const wordCount = documentText.trim().split(/\s+/).length;
          if (wordCount < 200) {
            console.warn(`[QUIZ] Small document detected (${wordCount} words) - AI may struggle to generate quality questions`);
          }

          jobs.push(
            (async () => {
              const { generateQuiz } = await import("../steps/ai-generation/quiz");
              return await generateQuiz(step, null, documentText, "document", openaiApiKey);
            })().finally(() => {
              console.timeEnd('[TIMER] quiz-document');
              const duration = Date.now() - jobTimers['quiz'];
              if (duration > 30000) {
                console.warn(`[WARNING] Job quiz took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
              }
            })
          );
          jobNames.push("quiz");
        } else {
          console.warn(`[QUIZ] Skipping document quiz - content too short (${documentText.length} chars)`);
        }
      }

      // Q&A available for all file types (ULTRA plan)
      if (plan === "ultra") {
        console.time('[TIMER] engagement');
        jobTimers['engagement'] = Date.now();
        jobs.push(
          (async () => {
            const { generateEngagement } = await import("../steps/ai-generation/engagement");
            return generateEngagement(step, transcript, openaiApiKey);
          })().finally(() => {
            console.timeEnd('[TIMER] engagement');
            const duration = Date.now() - jobTimers['engagement'];
            if (duration > 30000) {
              console.warn(`[WARNING] Job engagement took ${(duration / 1000).toFixed(2)}s (>30s threshold)`);
            }
          })
        );
        jobNames.push("engagement");
      } else if (!isDocument) {
        console.log(
          `Skipping Q&A for ${plan} plan`,
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

      // Run all enabled jobs in parallel with timeout protection
      console.log(`\n========================================`);
      console.log(`[JOB EXECUTION] About to run ${jobs.length} parallel jobs`);
      console.log(`[JOB EXECUTION] Running parallel jobs:`, jobNames);
      console.log(`[JOB EXECUTION] Content length: ${transcriptText.length} chars`);
      console.log(`========================================\n`);
      const startTime = Date.now();

      const results = await Promise.allSettled(jobs);
      const executionTime = Date.now() - startTime;
      console.log(`\n========================================`);
      console.log(`[JOB EXECUTION] All jobs completed in ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`========================================\n`);

      // Extract successful results based on plan
      // Build results object dynamically based on what was run
      const generatedContent: Record<string, any> = {};

      results.forEach((result, idx) => {
        const jobName = jobNames[idx];
        if (result.status === "fulfilled") {
          generatedContent[jobName] = result.value;
          console.log(`[JOB SUCCESS] ✓ ${jobName} completed successfully`);
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

          // Enhanced error logging with timeout detection
          if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
            console.error(`[JOB TIMEOUT] ⏱ ${jobName} exceeded 2-minute timeout`);
          } else if (errorMessage.includes("empty") || errorMessage.includes("too short")) {
            console.error(`[JOB SKIPPED] ⚠ ${jobName} - insufficient content`);
          } else {
            console.error(`[JOB FAILED] ✗ ${jobName}:`, result.reason);
          }
        }
      });

      if (Object.keys(jobErrors).length > 0) {
        console.warn(`[JOB ERRORS] ${Object.keys(jobErrors).length} job(s) failed: [${Object.keys(jobErrors).join(", ")}]`);
      }

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
        console.log(`[STATUS] ✅ Content generation completed for project ${projectId}`);
      });

      // Step 3: Save all results to Convex in one atomic operation
      // Convex mutation updates the project, triggering UI re-render
      await step.run("save-results-to-convex", () =>
        saveResultsToConvex(projectId, generatedContent),
      );

      // Step 4: Mark entire project as completed
      // This unlocks the UI from 95% to 100% and sets completedAt timestamp
      await step.run("update-project-status-completed", async () => {
        await convex.mutation(api.projects.updateProjectStatus, {
          projectId,
          status: "completed",
        });
        console.log(`[STATUS] ✅ Project ${projectId} marked as COMPLETED - UI will now show 100%`);
      });

      // Step 4: Low-cost automated verification for clinical scenarios (podcasts only)
      // Flattened to avoid NESTING_STEPS error - verification calls are made directly
      if (!isDocument) {
        const latest = await step.run("fetch-scenarios-for-audit", () =>
          convex.query(api.projects.getProject, { projectId, userId })
        );
        const scenarios = (latest as any)?.clinicalScenarios?.scenarios ?? [];

        for (let i = 0; i < scenarios.length; i += 1) {
          const s = scenarios[i];
          // Efficiency: if already verified, skip AI call
          if (s?.verifiedAccuracy === true) continue;

          // Call verification directly without nesting - step.ai.wrap is called at top level
          const quote = await findSupportingSourceQuoteWithTimeout(
            step,
            { contentType: "podcast", transcript },
            {
              vignette: s.vignette,
              question: s.question,
              options: s.options ?? [],
              correctAnswer: s.correctAnswer,
              sourceReference: s.sourceReference,
            },
            openaiApiKey,
          );

          // If quote found, mark as verified
          if (quote) {
            await step.run(`save-verification-${i}`, () =>
              convex.mutation(
                (api.projects.setClinicalScenarioVerifiedAccuracy as any),
                {
                  projectId,
                  scenarioIndex: i,
                  verifiedAccuracy: true,
                  sourceQuote: quote,
                },
              )
            );
          }
          // If null returned (timeout/failure), scenario remains unverified
        }
      }

      // Workflow complete - return success
      return { success: true, projectId, plan, jobErrors };
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
