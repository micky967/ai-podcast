/**
 * Document Text Extraction Step
 *
 * Extracts text from various document formats (PDF, DOC, DOCX, TXT).
 * Similar to transcription step but for documents instead of audio.
 *
 * Supported Formats:
 * - PDF: Uses pdf2json library
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
import mammoth from "mammoth";

/**
 * Extracts text from a document file
 *
 * @param fileUrl - Public URL to document file (from Vercel Blob)
 * @param projectId - Convex project ID for status updates
 * @param mimeType - MIME type of the file (determines extraction method)
 * @param userId - User ID for Convex query authorization
 * @returns TranscriptWithExtras - Text content in transcript format
 */
export async function extractTextFromDocument(
  fileUrl: string,
  projectId: Id<"projects">,
  mimeType: string,
  userId: string,
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
      // PDF extraction - using pdf2json (simple and reliable for Node.js)
      // Use require() inside function to avoid Next.js/Turbopack static analysis issues
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const PDFParser = require("pdf2json");
        const pdfParser = new PDFParser(null, 1);
        
        // Extract text from PDF using promise-based approach
        const pdfText = await new Promise<string>((resolve, reject) => {
          const textParts: string[] = [];
          
          pdfParser.on("pdfParser_dataError", (errData: any) => {
            reject(new Error(`PDF parsing error: ${errData.parserError}`));
          });
          
          pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            try {
              // Extract text from all pages - improved to capture all text elements
              if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
                for (const page of pdfData.Pages) {
                  const pageTextParts: string[] = [];
                  
                  // Extract text from Texts array (main text content)
                  if (page.Texts && Array.isArray(page.Texts)) {
                    const texts = page.Texts.map((textItem: any) => {
                      // Decode URI-encoded text
                      if (textItem.R && Array.isArray(textItem.R)) {
                        return textItem.R.map((r: any) => {
                          if (r.T) {
                            return decodeURIComponent(r.T);
                          }
                          return "";
                        }).join("");
                      }
                      // Also check for direct text property
                      if (textItem.T) {
                        return decodeURIComponent(textItem.T);
                      }
                      return "";
                    }).filter((text: string) => text.trim().length > 0);
                    
                    if (texts.length > 0) {
                      pageTextParts.push(texts.join(" "));
                    }
                  }
                  
                  // Extract text from FillText array (filled text, often in forms/tables)
                  if (page.FillText && Array.isArray(page.FillText)) {
                    const fillTexts = page.FillText.map((fillItem: any) => {
                      if (fillItem.R && Array.isArray(fillItem.R)) {
                        return fillItem.R.map((r: any) => {
                          if (r.T) {
                            return decodeURIComponent(r.T);
                          }
                          return "";
                        }).join("");
                      }
                      if (fillItem.T) {
                        return decodeURIComponent(fillItem.T);
                      }
                      return "";
                    }).filter((text: string) => text.trim().length > 0);
                    
                    if (fillTexts.length > 0) {
                      pageTextParts.push(fillTexts.join(" "));
                    }
                  }
                  
                  // Combine all text from this page
                  if (pageTextParts.length > 0) {
                    textParts.push(pageTextParts.join("\n"));
                  }
                }
              }
              
              // Join all pages with double newline for better separation
              const fullText = textParts.join("\n\n").trim();
              
              // Log extraction stats for debugging
              console.log(`PDF text extraction: ${pdfData.Pages?.length || 0} pages, ${fullText.length} characters extracted`);
              
              resolve(fullText);
            } catch (extractError) {
              reject(new Error(`Failed to extract text from PDF: ${extractError instanceof Error ? extractError.message : "Unknown error"}`));
            }
          });
          
          // Parse the PDF buffer
          pdfParser.parseBuffer(buffer);
        });
        
        extractedText = pdfText;
        
        if (!extractedText || extractedText.length === 0) {
          throw new Error(
            "This PDF appears to be image-based (scanned) and contains no extractable text. Please use a PDF with selectable text, or convert your scanned PDF to text using OCR software first."
          );
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes("image-based")) {
          throw parseError;
        }
        
        console.error("PDF parsing error with pdf2json:", parseError);
        throw new Error(
          `PDF parsing failed: ${parseError instanceof Error ? parseError.message : "Unknown error"}. The PDF file may be corrupted, encrypted, or in an unsupported format.`
        );
      }
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      // DOCX or DOC extraction
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType === "text/plain") {
      // TXT file - direct text reading
      extractedText = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    // Check if text was extracted
    const trimmedText = extractedText?.trim() || "";
    if (trimmedText.length === 0) {
      // Provide more helpful error message
      const errorDetails = {
        mimeType,
        extractedLength: extractedText?.length || 0,
        hasText: !!extractedText,
        isWhitespaceOnly: extractedText && extractedText.trim().length === 0,
      };
      console.error("Text extraction failed - no text found:", errorDetails);
      throw new Error(
        `No text could be extracted from the document. This may be because:\n` +
        `1. The PDF is image-based (scanned) and requires OCR\n` +
        `2. The PDF is encrypted or password-protected\n` +
        `3. The PDF contains only images/diagrams without text layers\n` +
        `Please ensure your PDF has selectable text.`
      );
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
        userId,
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

