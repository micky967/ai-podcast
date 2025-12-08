/**
 * Document Text Extraction Step
 *
 * Extracts text from various document formats (PDF, DOC, DOCX, TXT).
 * Similar to transcription step but for documents instead of audio.
 *
 * Supported Formats:
 * - PDF: Uses pdf-parse library
 * - DOCX: Uses mammoth library
 * - DOC: Uses mammoth library (converts to DOCX format)
 * - TXT: Direct text reading
 *
 * Returns text in a format compatible with TranscriptWithExtras
 * so it can be used by the same AI generation functions.
 * Also saves the transcript to Convex for retry jobs.
 */

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";
import type { TranscriptWithExtras } from "../../types/assemblyai";

/**
 * Extracts text from a document file
 *
 * @param fileUrl - Public URL to document file (from Vercel Blob)
 * @param projectId - Convex project ID for status updates
 * @param mimeType - MIME type of the file (determines extraction method)
 * @returns TranscriptWithExtras - Text content in transcript format
 */
export async function extractTextFromDocument(
  fileUrl: string,
  projectId: Id<"projects">,
  mimeType: string,
): Promise<TranscriptWithExtras> {
  console.log(
    `Starting text extraction for project ${projectId} (${mimeType})`,
  );

  try {
    // Fetch the file from the URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";

    // Extract text based on file type
    if (mimeType === "application/pdf") {
      // PDF extraction
      const pdfParse = await import("pdf-parse");
      const pdfData = await pdfParse.default(buffer);
      extractedText = pdfData.text;
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      // DOCX or DOC extraction
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType === "text/plain") {
      // TXT file - direct text reading
      extractedText = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text could be extracted from the document");
    }

    console.log(
      `Text extraction completed: ${extractedText.length} characters extracted`,
    );

    // Format transcript in the same structure as audio transcription for compatibility
    // segments is required (empty array for documents), chapters and speakers are optional
    const transcriptData = {
      text: extractedText,
      segments: [] as Array<{
        id: number;
        start: number;
        end: number;
        text: string;
        words?: Array<{ word: string; start: number; end: number }>;
      }>, // Documents don't have time-based segments (empty array is required)
      // Omit chapters and speakers - they're optional and not needed for documents
    };

    // Save transcript to Convex (same as audio transcription)
    // This ensures retry jobs can access the transcript
    // CRITICAL: This must succeed for retry jobs to work
    try {
      await convex.mutation(api.projects.saveTranscript, {
        projectId,
        transcript: transcriptData,
      });
      console.log(
        `Transcript saved successfully for project ${projectId} (${extractedText.length} characters)`,
      );
      
      // Verify the save succeeded by checking the saved data
      // This helps catch any silent failures
      const savedProject = await convex.query(api.projects.getProject, {
        projectId,
      });
      if (!savedProject?.transcript?.text || savedProject.transcript.text.length === 0) {
        throw new Error(
          "Transcript save verification failed: text was not saved correctly to Convex",
        );
      }
      console.log(
        `Transcript save verified: ${savedProject.transcript.text.length} characters in Convex`,
      );
    } catch (saveError) {
      console.error("Failed to save transcript to Convex:", saveError);
      // Throw error - if we can't save, retry jobs won't work
      // Better to fail now than silently fail later
      throw new Error(
        `Failed to save document text to database: ${
          saveError instanceof Error ? saveError.message : "Unknown error"
        }. Please try uploading the file again.`,
      );
    }

    // Return in TranscriptWithExtras format for compatibility with AI generation functions
    // Documents don't have timestamps, speakers, or chapters, so we use empty arrays
    return {
      text: extractedText,
      segments: [], // Documents don't have time-based segments
      chapters: [], // Documents don't have auto-detected chapters
      utterances: [], // Documents don't have speaker diarization
      words: [], // Documents don't have word-level timestamps
    };
  } catch (error) {
    console.error("Document text extraction failed:", error);
    throw new Error(
      `Failed to extract text from document: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

