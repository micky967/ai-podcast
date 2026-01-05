/**
 * AssemblyAI Transcription Step
 *
 * Transcribes podcast audio using AssemblyAI's API with advanced features:
 * - Speaker diarization: Identifies who is speaking (always enabled, UI-gated for ULTRA)
 * - Auto chapters: AI-detected topic changes with summaries
 * - Word-level timestamps: Precise timing for each word
 * - Formatted text: Punctuation and capitalization
 *
 * Integration Flow:
 * 1. Receive audio URL from Vercel Blob and user's plan
 * 2. Submit to AssemblyAI with all features enabled
 * 3. AssemblyAI polls until transcription completes
 * 4. Transform response to match our Convex schema
 * 5. Save to Convex (triggers UI update)
 * 6. Return enhanced transcript for AI generation
 *
 * Feature Gating:
 * - Speaker diarization data is always captured during transcription
 * - UI access to speaker dialogue is restricted to ULTRA plan users
 * - Auto chapters and word timestamps for all plans
 *
 * Error Handling:
 * - AssemblyAI errors: Marked as failed, error recorded in Convex
 * - Inngest automatic retries: Transient failures are retried
 * - Status tracking: jobStatus.transcription updated in real-time
 *
 * Design Decision: Why AssemblyAI over OpenAI Whisper?
 * - Speaker diarization: AssemblyAI has better multi-speaker detection
 * - Auto chapters: Helps with AI content generation (better context)
 * - Faster processing: Optimized for speech (vs. Whisper for accuracy)
 * - Async API: Better for long podcasts (no timeout issues)
 */
import type { step as InngestStep } from "inngest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";
import type { PlanName } from "@/lib/tier-config";
import type {
  AssemblyAIChapter,
  AssemblyAISegment,
  AssemblyAIUtterance,
  AssemblyAIWord,
  TranscriptWithExtras,
} from "../../types/assemblyai";

type AssemblyAITranscriptCompleted = {
  status: "completed";
  text: string;
  segments: AssemblyAISegment[];
  chapters: AssemblyAIChapter[];
  utterances: AssemblyAIUtterance[];
  words: AssemblyAIWord[];
  audio_duration?: number;
};

type AssemblyAITranscriptError = {
  status: "error";
  error?: string;
};

type AssemblyAITranscriptProcessing = {
  status: Exclude<string, "completed" | "error">;
};

function isCompletedTranscript(
  status:
    | AssemblyAITranscriptCompleted
    | AssemblyAITranscriptError
    | AssemblyAITranscriptProcessing,
): status is AssemblyAITranscriptCompleted {
  return status.status === "completed";
}

function isErrorTranscript(
  status:
    | AssemblyAITranscriptCompleted
    | AssemblyAITranscriptError
    | AssemblyAITranscriptProcessing,
): status is AssemblyAITranscriptError {
  return status.status === "error";
}

/**
 * Create AssemblyAI client with user API key (REQUIRED)
 *
 * @param userApiKey - User-provided API key (required - no fallback)
 * @returns AssemblyAI client instance
 * @throws Error if userApiKey is not provided
 */
function getAssemblyAIHeaders(userApiKey?: string): Record<string, string> {
  if (!userApiKey) {
    throw new Error(
      "AssemblyAI API key is required. Please add your AssemblyAI API key in Settings.",
    );
  }
  return {
    authorization: userApiKey,
    "content-type": "application/json",
  };
}

// Medical terminology for improved transcription accuracy
const MEDICAL_KEYTERMS = [
  // Common medical suffixes
  "itis", "ectomy", "otomy", "ostomy", "plasty", "osis", "oma", "pathy", "algia", "emia",
  "uria", "penia", "cytosis", "trophy", "sclerosis", "stenosis", "megaly", "rrhea", "rrhage", "lysis",
  // Common medical prefixes
  "hyper", "hypo", "brady", "tachy", "poly", "oligo", "macro", "micro", "neo", "pseudo",
  "anti", "contra", "dys", "mal", "pre", "post", "peri", "intra", "inter", "trans",
  // Top clinical terms
  "carcinoma", "lymphoma", "leukemia", "metastasis", "biopsy", "chemotherapy", "radiotherapy",
  "diagnosis", "prognosis", "etiology", "pathophysiology", "pharmacology", "anesthesia",
  "cardiovascular", "respiratory", "gastrointestinal", "neurological", "endocrine", "immunology",
  "hematology", "oncology", "nephrology", "hepatology", "dermatology", "rheumatology",
  "diabetes", "hypertension", "arrhythmia", "myocardial", "infarction", "stroke", "sepsis",
  "pneumonia", "bronchitis", "asthma", "COPD", "tuberculosis", "HIV", "hepatitis",
  "thrombosis", "embolism", "aneurysm", "ischemia", "hemorrhage", "edema", "fibrosis",
  "inflammation", "infection", "necrosis", "apoptosis", "proliferation", "differentiation",
];

async function submitTranscriptionJob(params: {
  audioUrl: string;
  userApiKey: string;
}): Promise<{ id: string }> {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: getAssemblyAIHeaders(params.userApiKey),
    body: JSON.stringify({
      audio_url: params.audioUrl,
      // Use slam-1 model for maximum medical accuracy (2026 flagship)
      speech_model: "slam-1",
      // Enable speaker diarization for multi-speaker medical podcasts
      speaker_labels: true,
      // Auto chapters for better content organization
      auto_chapters: true,
      // Format text with proper punctuation and capitalization
      format_text: true,
      // Enable entity detection for medical terms
      entity_detection: true,
      // Provide medical terminology hints for improved accuracy (slam-1 compatible)
      keyterms_prompt: [
        "lung cancer", "oncology", "nodules", "biopsy", "adenocarcinoma",
        "carcinoma", "lymphoma", "leukemia", "metastasis", "chemotherapy",
        "radiotherapy", "diagnosis", "prognosis", "etiology", "pathophysiology",
        "pharmacology", "cardiovascular", "respiratory", "gastrointestinal",
        "neurological", "endocrine", "diabetes", "hypertension", "arrhythmia",
        "myocardial", "infarction", "stroke", "sepsis", "pneumonia", "bronchitis",
        "asthma", "COPD", "tuberculosis", "HIV", "hepatitis", "thrombosis",
        "embolism", "aneurysm", "ischemia", "hemorrhage", "inflammation",
        "infection", "necrosis"
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `AssemblyAI submit failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
    );
  }

  const json = (await res.json()) as { id?: string };
  if (!json.id) {
    throw new Error("AssemblyAI submit failed: missing transcript id");
  }
  return { id: json.id };
}

async function getTranscriptResult(params: {
  transcriptId: string;
  userApiKey: string;
}): Promise<any> {
  const res = await fetch(
    `https://api.assemblyai.com/v2/transcript/${params.transcriptId}`,
    {
      method: "GET",
      headers: getAssemblyAIHeaders(params.userApiKey),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `AssemblyAI status check failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
    );
  }

  return await res.json();
}

/**
 * Main transcription function called by Inngest workflow
 *
 * @param audioUrl - Public URL to audio file (from Vercel Blob)
 * @param projectId - Convex project ID for status updates
 * @param userPlan - User's subscription plan (for logging, speaker data always captured)
 * @param userApiKey - Optional user-provided AssemblyAI API key (BYOK)
 * @returns TranscriptWithExtras - Enhanced transcript with chapters and speakers
 */
export async function transcribeWithAssemblyAI(
  step: typeof InngestStep,
  audioUrl: string,
  projectId: Id<"projects">,
  userPlan: PlanName = "free",
  userApiKey?: string,
): Promise<TranscriptWithExtras> {
  console.log("[DEBUG] Bypassing step.run for AssemblyAI to clear Nesting Error");
  console.log(
    `Starting AssemblyAI transcription for project ${projectId} (${userPlan} plan)`,
  );

  try {
    if (!userApiKey) {
      throw new Error(
        "AssemblyAI API key is required. Please add your AssemblyAI API key in Settings before processing audio files.",
      );
    }

    // Submit transcription job (bypassing step.run to avoid NESTING_STEPS error)
    console.log(`[AssemblyAI] Submitting transcription job...`);
    const { id: transcriptId } = await submitTranscriptionJob({ audioUrl, userApiKey });

    console.log(`[AssemblyAI] Transcription job submitted: ${transcriptId}`);
    console.log(`[AssemblyAI] Starting polling loop (checking every 10 seconds)`);

    const maxAttempts = 360; // 60 minutes at 10s intervals
    const pollIntervalSeconds = 10;
    let response: AssemblyAITranscriptCompleted | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[AssemblyAI] Polling attempt ${attempt}/${maxAttempts} for transcript ${transcriptId}...`);

      // Poll status (bypassing step.run to avoid NESTING_STEPS error)
      const status = (await getTranscriptResult({ transcriptId, userApiKey })) as
        | AssemblyAITranscriptCompleted
        | AssemblyAITranscriptError
        | AssemblyAITranscriptProcessing;

      console.log(`[AssemblyAI] Status: ${status.status}`);

      if (isCompletedTranscript(status)) {
        console.log(`[AssemblyAI] ✅ Transcription completed after ${attempt} attempts (${(attempt * pollIntervalSeconds / 60).toFixed(1)} minutes)`);
        response = status;
        break;
      }

      if (isErrorTranscript(status)) {
        console.error(`[AssemblyAI] ❌ Transcription failed:`, status.error);
        throw new Error(status.error || "AssemblyAI transcription failed");
      }

      // Still processing, wait before next attempt
      // Using regular delay instead of step.sleep to avoid NESTING_STEPS error
      if (attempt < maxAttempts) {
        console.log(`[AssemblyAI] Still processing... waiting ${pollIntervalSeconds} seconds before next check`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalSeconds * 1000));
      }
    }

    if (!response) {
      throw new Error(
        `AssemblyAI transcription timed out after ${maxAttempts * pollIntervalSeconds}s (${maxAttempts} attempts)`,
      );
    }

    console.log("AssemblyAI transcription completed");

    console.log(
      `Transcribed ${response.words?.length || 0} words, ${response.segments?.length || 0
      } segments, ${response.chapters?.length || 0} chapters, ${response.utterances?.length || 0
      } speakers`,
    );

    // Transform AssemblyAI response to match our Convex schema
    const assemblySegments: AssemblyAISegment[] = response.segments || [];
    const assemblyChapters: AssemblyAIChapter[] = response.chapters || [];
    const assemblyUtterances: AssemblyAIUtterance[] = response.utterances || [];

    // Format segments with word-level timing data
    const formattedSegments = assemblySegments.map((segment, idx) => ({
      id: idx,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      // Transform word structure to match Convex schema
      words: (segment.words || []).map((word) => ({
        word: word.text,
        start: word.start,
        end: word.end,
      })),
    }));

    // Prepare transcript object for Convex
    // Use response.text directly (AssemblyAI always provides this when status is "completed")
    const formattedTranscript = {
      text: response.text || "",
      segments: formattedSegments,
    };

    // Transform speaker utterances (convert milliseconds to seconds for consistency)
    const speakers = assemblyUtterances.map(
      (utterance: AssemblyAIUtterance) => ({
        speaker: utterance.speaker,
        start: utterance.start / 1000, // ms to seconds
        end: utterance.end / 1000, // ms to seconds
        text: utterance.text,
        confidence: utterance.confidence,
      }),
    );

    // Format chapters for Convex (keep milliseconds as AssemblyAI provides them)
    const chapters = assemblyChapters.map((chapter: AssemblyAIChapter) => ({
      start: chapter.start,
      end: chapter.end,
      headline: chapter.headline,
      summary: chapter.summary,
      gist: chapter.gist,
    }));

    // Save complete transcript with speakers AND chapters to Convex
    // This ensures retry jobs have all the data they need
    await convex.mutation(api.projects.saveTranscript, {
      projectId,
      transcript: {
        ...formattedTranscript,
        speakers,
        chapters, // Include chapters so retry can access them
      },
    });

    console.log(`[AssemblyAI] ✅ Transcript saved to Convex for project ${projectId}`);

    // Return enhanced transcript for AI generation steps
    // Includes chapters and utterances which help improve AI content quality
    // Note: Status updates are handled by podcast-processor.ts orchestration
    return {
      text: response.text || "",
      segments: formattedSegments,
      chapters: assemblyChapters,
      utterances: assemblyUtterances,
      audio_duration: response.audio_duration, // Include audio duration
    };
  } catch (error) {
    console.error("AssemblyAI transcription error:", error);

    // Record detailed error for debugging
    await convex.mutation(api.projects.recordError, {
      projectId,
      message: error instanceof Error ? error.message : "Transcription failed",
      step: "transcription",
    });

    // Re-throw to stop workflow execution (Inngest will retry based on config)
    throw error;
  }
}
