/**
 * AI Engagement & Growth Tools Generation Step
 *
 * Generates audience engagement assets using OpenAI GPT to help creators:
 * - Spark conversations with anticipated questions/comments
 * - Build community with welcoming pinned comments
 * - Maintain momentum with follow-up post ideas
 * - Create descriptions optimized for different contexts
 *
 * Output Formats:
 * - Comment Starters: 40 study flashcard questions with answers for memorization
 * - Pin Comment: Welcoming comment for YouTube to build community
 * - Community Posts: 3 follow-up ideas to keep audience engaged
 * - Descriptions: Short (preview), Medium (podcast feed), Long (blog/show notes)
 *
 * Integration:
 * - Uses OpenAI Structured Outputs (zodResponseFormat) for type safety
 * - Wrapped in step.ai.wrap() for Inngest observability and automatic retries
 * - Leverages transcript and chapters for context-aware suggestions
 *
 * Design Decision: Why engagement tools?
 * - Comments drive YouTube algorithm (engagement signals)
 * - Pinned comments set the tone for community culture
 * - Follow-up posts maintain audience connection between episodes
 * - Multiple description lengths support different distribution channels
 */
import type { step as InngestStep } from "inngest";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createBoundCompletion } from "../../lib/openai-client";
import { type Engagement, engagementSchema } from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

// System prompt defines GPT's role and expertise
const ENGAGEMENT_SYSTEM_PROMPT =
  "You are an expert educational content creator specializing in creating effective study flashcards. You understand how to break down complex information into concise, memorable questions and accurate answers that facilitate learning and retention.";

/**
 * Builds the user prompt with transcript context and detailed instructions
 *
 * Prompt Engineering Techniques:
 * - Provides transcript excerpt for topic understanding
 * - Includes AssemblyAI chapters to identify discussion points
 * - Specific instructions for each engagement asset type
 * - Examples and best practices to guide GPT output
 */
function buildEngagementPrompt(transcript: TranscriptWithExtras): string {
  // Check if this is from a document (no chapters/timestamps) or audio (has chapters)
  const isDocument = !transcript.chapters || transcript.chapters.length === 0;
  const contentType = isDocument ? "document" : "podcast/audio content";
  
  // Determine content length to decide how many flashcards to generate
  const contentLength = transcript.text.length;
  const isLongDocument = isDocument && contentLength > 15000; // Long documents with lots of content
  
  const flashcardCount = isDocument 
    ? isLongDocument 
      ? "40-50 flashcards - this document has extensive content including tables, spreadsheets, and detailed information. Generate 40-50 comprehensive flashcards to cover all the material."
      : contentLength > 8000
        ? "30-40 flashcards - this document has substantial content. Generate 30-40 flashcards to comprehensively cover the material."
        : "20-30 flashcards based on content length"
    : "EXACTLY 50 flashcards - this is REQUIRED for podcasts/audio files. You MUST generate exactly 50 flashcards, no more, no less.";
  
  // For documents, send more content to ensure questions are based on actual document content
  // For long documents with tables/spreadsheets, send even more content
  // For audio, 3000 chars is usually enough since podcasts are more conversational
  const contentPreview = isDocument
    ? isLongDocument
      ? transcript.text.substring(0, 20000) // Very long preview for documents with tables/spreadsheets
      : transcript.text.substring(0, 12000) // Extended preview for documents
    : transcript.text.substring(0, 3000); // Standard preview for audio

  return `Analyze this content and create comprehensive study materials and engagement tools.

${isDocument ? "DOCUMENT CONTENT" : "CONTENT"} (${isDocument ? (isLongDocument ? "first 20000 chars" : "first 12000 chars") : "first 3000 chars"}):
${contentPreview}${transcript.text.length > (isDocument ? (isLongDocument ? 20000 : 12000) : 3000) ? "..." : ""}

${
  transcript.chapters && transcript.chapters.length > 0
    ? `\nAUTO-DETECTED CHAPTERS:\n${transcript.chapters
        .map((ch, idx) => `${idx + 1}. ${ch.headline} - ${ch.summary}`)
        .join("\n")}`
    : ""
}

Create study materials and engagement assets:

${isDocument 
    ? `CRITICAL FOR DOCUMENTS: All questions and answers MUST be extracted directly from the document content provided above. Every flashcard question must be about what the document is talking about. DO NOT generate generic questions - all questions must relate to the specific topics, concepts, and information covered in THIS document. If the document is about medicine, all questions must be about the medical topics in the document. If the document is about business, all questions must be about the business topics in the document. Generate ${flashcardCount} based on the document's content.`
    : `IMPORTANT: Extract factual information from the ${contentType}, but present it as standalone general knowledge. The facts come FROM the ${contentType}, but questions must be about the facts themselves - not about cases, discussions, or presentations. Generate ${flashcardCount}. The goal is comprehensive coverage of all factual information.`}

1. STUDY FLASHCARDS (${isDocument ? (isLongDocument ? "40-50 items" : "20-40 items") : "50 items"}):
   Generate concise study flashcard questions with accurate answers based on the factual content.
   ${isDocument 
     ? isLongDocument
       ? `- CRITICAL: This document contains extensive content including tables, spreadsheets, and detailed information
   - Generate 40-50 comprehensive flashcards to cover ALL the material
   - Extract questions from ALL sections: text content, tables, spreadsheets, data points, lists, and any embedded content
   - Each table row, spreadsheet cell, data point, and fact should be considered for flashcard generation
   - Break down complex tables and spreadsheets into multiple focused questions
   - Cover every major topic, concept, definition, fact, and data point in the document
   - Quality AND quantity - ensure comprehensive coverage of all information
   - Don't skip any sections - tables and spreadsheets often contain critical information`
       : `- For short documents (< 5000 chars): Generate 20-25 flashcards covering all key information
   - For medium documents (5000-15000 chars): Generate 30-40 flashcards for comprehensive coverage
   - For long documents (> 15000 chars): Generate 40-50 flashcards to cover all major topics, tables, and data
   - Always aim to cover ALL factual information from the content including tables and spreadsheets
   - Extract questions from text, tables, lists, and any structured data
   - Quality over quantity - each flashcard should test distinct, valuable information`
     : `- CRITICAL: Generate EXACTLY 50 flashcards - this is REQUIRED, not optional
   - You MUST return exactly 50 flashcards for podcasts/audio files
   - Cover all factual information from the podcast/audio content
   - Ensure comprehensive coverage of all major topics, concepts, and key information
   - Each flashcard should test distinct, valuable information
   - If you run out of unique topics, create variations or deeper questions on covered topics to reach exactly 50`}
   
   ${isDocument 
     ? `CRITICAL REQUIREMENTS FOR DOCUMENTS:
   - Extract ALL factual information DIRECTLY from the document content provided above
   - Every question MUST be about what the document is talking about
   - Questions must relate to the specific topics, subjects, and information in THIS document
   - DO NOT create generic questions that could apply to any document
   - DO NOT create questions about topics not covered in this document
   - If the document is about medicine, create questions about the medical topics in the document
   - If the document is about business, create questions about the business topics in the document
   - If the document is about history, create questions about the historical topics in the document
   - Questions must be specific to what THIS document covers
   - Convert specific examples into general knowledge questions, but the underlying facts must come from this document
   - DO NOT use phrases like "discussed", "mentioned", "presented with", "noted in case", "in the case study", "the patient", "case 1/2/3", "shown in", etc.
   - Focus on WHAT the document is talking about, not WHERE it came from or HOW it was presented
   
   EXTRACTION PROCESS FOR DOCUMENTS:
   - Read through the entire document content provided
   - Identify what topics, subjects, and themes the document is about
   - Identify all key facts, concepts, definitions, principles, and information in the document
   - For each piece of information, create a question that tests understanding of that specific fact FROM THE DOCUMENT
   - If the document mentions specific examples, extract the underlying concept and create a general question about that concept (but based on what the document says)
   - Ensure questions cover different aspects of the document (not all from one section)
   - Questions should test understanding of what the document is talking about`
     : `CRITICAL REQUIREMENTS:
   - Extract ALL factual information from the ${contentType} (definitions, facts, concepts, principles, symptoms, treatments, etc.)
   - Convert case-specific information into general knowledge
   - DO NOT create questions about specific cases, case studies, examples, or scenarios
   - DO NOT use phrases like "discussed", "mentioned", "presented with", "noted in case", "in the case study", "the patient", "case 1/2/3", "shown in", etc.
   - Focus on WHAT the information is, not WHERE it came from or HOW it was presented
   - Questions must be about general facts that stand alone - as if from a textbook, not from a case presentation
   
   EXTRACTION PROCESS:
   - When you see case information (e.g., "10-year-old male with fever"), extract the MEDICAL FACT (e.g., "fever is a symptom")
   - When you see "case 1 showed X", extract the MEDICAL FACT "X" and ask about it generally
   - When you see "discussed types of leukemia", extract "types of leukemia" and ask about them generally
   - Always convert case-specific details into universal medical knowledge`}
   
   For each item, provide:
   - question: A concise, clear question${isDocument ? " about what the document is talking about" : " about general medical knowledge"} (1-2 sentences max)
   - answer: An accurate, informative answer that is complete but concise (2-4 sentences)
   
   Questions should:
   ${isDocument 
     ? `- Be about what the document is talking about - the specific topics, concepts, and information in the document
   - Test understanding of information that appears in the document
   - Cover different topics and sections from the document (not all from one area)
   - Relate to the subject matter of the document (if document is about medicine, questions are about medicine; if about business, questions are about business, etc.)
   - NOT reference specific examples, cases, or scenarios from the document (extract the underlying concept)
   - NOT ask about "what was discussed" or "what the document said"
   - Focus on the knowledge that can be extracted from what the document is talking about
   - Be suitable for memorization and recall practice
   - Stand alone as testable knowledge, but must be about what the document covers
   
   Answers should:
   - Contain information that appears in or can be inferred from the document
   - Be accurate and factually correct based on what the document says
   - Be concise but complete (enough detail to understand, not overly verbose)
   - Standalone (no references to source material)
   - Focus on the key information from the document being tested
   
   What to extract FROM THE DOCUMENT:
   - Definitions of terms and concepts the document talks about
   - Facts and principles the document describes
   - Classifications and categories the document explains
   - Mechanisms, processes, and how things work as the document describes
   - Criteria, standards, and findings the document mentions
   - Principles, approaches, and methodologies the document covers
   - Key concepts and knowledge areas the document discusses`
     : `- Be about general medical facts, concepts, definitions, and principles
   - NOT reference specific patients, cases, examples, or scenarios from the content
   - NOT ask about "what was discussed" or "what case showed"
   - NOT ask about symptoms of specific patients or findings from specific cases
   - Focus on the underlying medical knowledge itself
   - Be suitable for memorization and recall practice
   - Stand completely alone without any context from the source
   
   Answers should:
   - Contain general medical knowledge and facts
   - NOT reference any specific cases, patients, or examples
   - Be accurate and factually correct
   - Be concise but complete (enough detail to understand, not overly verbose)
   - Standalone (no references to any source material, cases, or examples)
   - Focus on the key medical information being tested
   
   What to extract:
   - General definitions (e.g., "What is [concept]?" not "What types were discussed?")
   - Medical facts and principles (e.g., "What are common symptoms of [condition]?" not "What symptoms did the patient present with?")
   - Disease classifications (e.g., "What are the main types of [category]?" not "What types were discussed in the ${contentType}?")
   - Pathophysiology, mechanisms, and processes
   - Diagnostic criteria and findings
   - Treatment principles and approaches
   - General clinical knowledge`}
   
   What NOT to extract:
   - Questions about specific cases or case studies
   - Questions about what was "discussed" or "mentioned"
   - Questions about specific patients or clinical scenarios
   - Questions that require knowledge of the podcast/content structure
   
   Examples of GOOD questions (extract facts, present generally):
   - "What are the main types of [concept]?" (from content about types)
   - "What are significant indicators of [condition]?" (from examples showing indicators)
   - "What are common symptoms of [condition]?" (from examples describing symptoms)
   - "What are the diagnostic criteria for this condition?" (from diagnostic discussion)
   
   Examples of BAD questions (DO NOT CREATE THESE):
   - "What are the main types discussed in the ${contentType}?" ❌ (references source)
   - "What symptoms did the patient in case 1 present with?" ❌ (references specific case)
   - "What was noted in the case study?" ❌ (references case study)
   - "What is a significant indicator noted in the case study?" ❌ (references case)
   - "What types were mentioned?" ❌ (references discussion)
   
   Distribution:
   - Cover all major topics, concepts, definitions, facts, processes, and principles
   - Extract general knowledge from all content areas
   - Split complex topics into multiple focused questions
   - Ensure comprehensive coverage of the material

2. PIN-WORTHY COMMENT (1 welcoming comment):
   Create THE perfect comment to pin that:
   - Welcomes viewers warmly and sets positive tone
   - Highlights 1-2 most valuable takeaways or discussion points
   - Encourages engagement with a question or call-to-action
   - Feels authentic and community-focused (not salesy)
   - Is 2-4 sentences long
   
   Example tone: "Welcome everyone! 👋 The discussion about [key topic]${isDocument ? "" : " at [timestamp]"} really resonated with me. What's your biggest takeaway from this ${isDocument ? "content" : "episode"}? Drop your thoughts below - I read every comment!"

3. COMMUNITY POST IDEAS (3 follow-up posts):
   Generate 3 post ideas to maintain momentum${isDocument ? "" : " between episodes"}:
   - Behind-the-scenes insights mentioned but not fully explored
   - Poll questions about topics discussed (A vs B, preferences)
   - Teaser for related upcoming content${isDocument ? "" : " or episodes"}
   - Quick tips or resources related to main topics
   - Each should be 1-2 sentences describing the post idea
   
   Examples:
   - "Poll: Ask audience to vote on which topic to deep-dive next"
   - "Share a carousel of the 5 key frameworks${isDocument ? " from this content" : " discussed in this episode"}"
   - "Behind-the-scenes: How this ${isDocument ? "content" : "episode"} changed my perspective on [topic]"

4. ${isDocument ? "CONTENT" : "PODCAST"} DESCRIPTIONS (3 lengths):
   
   SHORT (150-200 chars):
   - One-sentence hook for social media previews
   - Captures essence and sparks curiosity
   - Includes biggest value proposition
   
   MEDIUM (300-500 chars):
   - Perfect for ${isDocument ? "content" : "podcast feed"} descriptions
   - Covers main topics${isDocument ? "" : " and guest (if applicable)"}
   - Includes 2-3 key takeaways
   - Ends with subtle CTA${isDocument ? "" : " (listen, subscribe, etc.)"}
   
   LONG (800-1000 words):
   - Comprehensive ${isDocument ? "content summary" : "show notes"} for blog or YouTube description
   - Detailed overview of all topics${transcript.chapters && transcript.chapters.length > 0 ? " and chapters" : ""}
   ${isDocument ? "" : "- Includes timestamps if relevant"}
   - Rich with keywords for SEO
   - Has sections for better readability
   - Ends with strong CTA and links (placeholders like [LINK] are fine)

For study flashcards: ${isDocument 
    ? `Extract ALL factual information DIRECTLY from the document content. Every question must be about what the document is talking about. Questions must relate to the specific topics, subjects, and information covered in the document. Convert any case-specific or example-specific information into general knowledge questions, but the underlying facts must come from what the document says. Questions must be about the information itself - never reference cases, discussions, or how information was presented. Each flashcard should stand alone as textbook-style knowledge, but must be based on what the document covers. Break down complex topics into multiple focused questions to ensure comprehensive coverage of all facts from the document.`
    : `Extract ALL factual information from the ${contentType}, but present it as standalone general knowledge. Convert any case-specific or example-specific information into universal facts. Questions must be about the information itself - never reference cases, discussions, or how information was presented. Each flashcard should stand alone as textbook-style knowledge. Break down complex topics into multiple focused questions to ensure comprehensive coverage of all facts from the content.`}

For engagement tools: Make everything authentic, valuable, and optimized for growth. Focus on sparking genuine conversations and building a loyal community.`;
}

/**
 * Generate fallback flashcard content (minimum 10 items)
 * Used when API fails to ensure schema validation passes
 */
function generateFallbackFlashcards(): Array<{ question: string; answer: string }> {
  const baseQuestions = [
    { q: "What are the key concepts discussed?", a: "The content covers fundamental principles and practical applications that are essential for understanding the topic." },
    { q: "What is the primary definition?", a: "The core definition provides the foundation for understanding all related concepts and applications." },
    { q: "What are the main principles?", a: "The main principles outline the fundamental rules and guidelines that govern the subject matter." },
    { q: "What are the key differences between concepts?", a: "Understanding these differences is crucial for proper application and avoiding common misconceptions." },
    { q: "What are the practical applications?", a: "These applications demonstrate how theoretical knowledge translates into real-world practice." },
    { q: "What are the important facts?", a: "These facts provide essential background information necessary for comprehensive understanding." },
    { q: "What processes are involved?", a: "The processes outline the step-by-step approaches used to achieve desired outcomes." },
    { q: "What are the critical considerations?", a: "These considerations highlight important factors that must be taken into account." },
    { q: "What are the common approaches?", a: "These approaches represent established methods used in practice." },
    { q: "What are the key terms?", a: "Understanding these terms is essential for clear communication and comprehension." },
  ];
  
  // Return minimum 10 items (schema requirement)
  return baseQuestions.map(({ q, a }) => ({
    question: q,
    answer: a,
  }));
}

/**
 * Generates engagement tools using OpenAI GPT with structured outputs
 *
 * Error Handling:
 * - Returns fallback content on API failure (graceful degradation)
 * - Logs errors for debugging
 * - Doesn't throw (allows other parallel jobs to continue)
 *
 * Inngest Integration:
 * - step.ai.wrap() tracks token usage and performance
 * - Provides automatic retry on transient failures
 * - Shows AI call details in Inngest dashboard
 */
export async function generateEngagement(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras,
  userApiKey?: string,
): Promise<Engagement> {
  console.log("Generating engagement & growth tools with GPT-4");

  try {
    // Create bound completion function for step.ai.wrap()
    const createCompletion = createBoundCompletion(userApiKey);

    // Call OpenAI with Structured Outputs for type-safe response
    const response = (await step.ai.wrap(
      "generate-engagement-with-gpt",
      createCompletion,
      {
        model: "gpt-4o", // Use GPT-4 for nuanced, authentic community content
        messages: [
          { role: "system", content: ENGAGEMENT_SYSTEM_PROMPT },
          { role: "user", content: buildEngagementPrompt(transcript) },
        ],
        // zodResponseFormat ensures response matches engagementSchema
        response_format: zodResponseFormat(engagementSchema, "engagement"),
      },
    )) as OpenAI.Chat.Completions.ChatCompletion;

    const content = response.choices[0]?.message?.content;
    
    // Check if this is from a document (no chapters) or audio (has chapters)
    const isDocument = !transcript.chapters || transcript.chapters.length === 0;
    
    // Parse and validate response against schema
    let engagement = content
      ? engagementSchema.parse(JSON.parse(content))
      : {
          // Fallback: basic content if parsing fails
          commentStarters: isDocument 
            ? generateFallbackFlashcards() // 10 for documents
            : Array.from({ length: 50 }, (_, i) => ({ // 50 for audio
                question: `Study question ${i + 1}`,
                answer: "Content generation failed. Please try regenerating.",
              })),
          pinComment:
            "Welcome to the discussion! 👋 What's your biggest takeaway from this episode? Drop your thoughts below!",
          communityPosts: [
            "Create a poll asking which topic to explore next",
            "Share key quotes from this episode as carousel",
            "Ask audience to share their own experiences with this topic",
          ],
          descriptions: {
            short: transcript.text.substring(0, 180),
            medium: transcript.text.substring(0, 450),
            long: transcript.text.substring(0, 900),
          },
        };

    // Determine expected flashcard count based on content type and length
    const contentLength = transcript.text.length;
    const isLongDocument = isDocument && contentLength > 15000;
    const expectedCount = isDocument 
      ? isLongDocument 
        ? 45 // Target 40-50, aim for middle
        : contentLength > 8000
          ? 35 // Target 30-40
          : 25 // Target 20-30
      : 50; // Audio files always 50
    
    // For audio files (MP3/podcasts), ensure exactly 50 flashcards
    if (!isDocument && engagement.commentStarters.length !== 50) {
      console.warn(
        `Audio file generated ${engagement.commentStarters.length} flashcards, expected 50. Padding to 50.`,
      );
      
      // If we got fewer than 50, pad with generic questions
      while (engagement.commentStarters.length < 50) {
        engagement.commentStarters.push({
          question: `Additional study question ${engagement.commentStarters.length + 1}`,
          answer: "Please regenerate engagement tools to get a complete set of 50 flashcards.",
        });
      }
      
      // If we got more than 50 (shouldn't happen due to schema max), trim to 50
      if (engagement.commentStarters.length > 50) {
        engagement.commentStarters = engagement.commentStarters.slice(0, 50);
      }
    }
    
    // For long documents, ensure we have enough flashcards (40-50)
    if (isLongDocument && engagement.commentStarters.length < 40) {
      console.warn(
        `Long document generated only ${engagement.commentStarters.length} flashcards, expected 40-50. The document may have tables/spreadsheets that need more questions.`,
      );
      // Note: We don't pad here because the AI should generate more based on the improved prompt
      // But we log a warning so the user knows to regenerate if needed
    }

    return engagement;
  } catch (error) {
    console.error("GPT engagement generation error:", error);

    // Graceful degradation: return generic content but allow workflow to continue
    const errorFlashcards = Array.from({ length: 50 }, (_, i) => ({
      question: `Study question ${i + 1}`,
      answer: "⚠️ Error generating answer. Please try regenerating this content.",
    }));
    
    return {
      commentStarters: errorFlashcards,
      pinComment:
        "⚠️ Welcome! Engagement tools generation encountered an error. Please check logs or try regenerating.",
      communityPosts: [
        "Error generating community post ideas - please try again",
        "Error generating community post ideas - please try again",
        "Error generating community post ideas - please try again",
      ],
      descriptions: {
        short:
          "⚠️ Error generating description. Please regenerate this content.",
        medium:
          "⚠️ Error generating description. Please check logs or try regenerating.",
        long: "⚠️ Error generating long description with GPT-4. Please check logs or try regenerating this content.",
      },
    };
  }
}
