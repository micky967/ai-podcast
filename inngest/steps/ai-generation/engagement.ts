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
import { createOpenAIClient } from "../../lib/openai-client";
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
  return `Analyze this educational content transcript and create comprehensive study materials and engagement tools.

TRANSCRIPT (first 3000 chars):
${transcript.text.substring(0, 3000)}...

${
  transcript.chapters.length > 0
    ? `\nAUTO-DETECTED CHAPTERS:\n${transcript.chapters
        .map((ch, idx) => `${idx + 1}. ${ch.headline} - ${ch.summary}`)
        .join("\n")}`
    : ""
}

Create study materials and engagement assets:

IMPORTANT: Extract factual medical information from the podcast content, but present it as standalone general medical knowledge. The medical facts come FROM the podcast, but questions must be about the facts themselves - not about cases, discussions, or presentations. Convert case-specific information into general medical knowledge. For example, if a case shows "10-year-old with fever and fatigue", extract the medical fact: "What are common symptoms of this condition?" NOT "What symptoms did the 10-year-old present with?". Generate exactly 40 flashcards covering all factual medical information from the content, presented as general knowledge.

1. STUDY FLASHCARDS (40 items):
   Generate 40 concise study flashcard questions with accurate answers based on the factual medical content.
   
   CRITICAL REQUIREMENTS:
   - Extract ALL factual medical information from the podcast content (definitions, facts, concepts, principles, symptoms, treatments, etc.)
   - Convert case-specific information into general medical knowledge
   - DO NOT create questions about specific cases, case studies, patient examples, or clinical scenarios
   - DO NOT use phrases like "discussed", "mentioned", "presented with", "noted in case", "in the case study", "the patient", "case 1/2/3", "shown in", etc.
   - Focus on WHAT the medical information is, not WHERE it came from or HOW it was presented
   - Questions must be about general medical facts that stand alone - as if from a textbook, not from a case presentation
   
   EXTRACTION PROCESS:
   - When you see case information (e.g., "10-year-old male with fever"), extract the MEDICAL FACT (e.g., "fever is a symptom")
   - When you see "case 1 showed X", extract the MEDICAL FACT "X" and ask about it generally
   - When you see "discussed types of leukemia", extract "types of leukemia" and ask about them generally
   - Always convert case-specific details into universal medical knowledge
   
   For each item, provide:
   - question: A concise, clear question about general medical knowledge (1-2 sentences max)
   - answer: An accurate, informative answer that is complete but concise (2-4 sentences)
   
   Questions should:
   - Be about general medical facts, concepts, definitions, and principles
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
   - General definitions (e.g., "What is acute lymphoblastic leukemia?" not "What types were discussed?")
   - Medical facts and principles (e.g., "What are common symptoms of anemia?" not "What symptoms did the patient present with?")
   - Disease classifications (e.g., "What are the main types of acute leukemia?" not "What types were discussed in the podcast?")
   - Pathophysiology, mechanisms, and processes
   - Diagnostic criteria and findings
   - Treatment principles and approaches
   - General clinical knowledge
   
   What NOT to extract:
   - Questions about specific cases or case studies
   - Questions about what was "discussed" or "mentioned"
   - Questions about specific patients or clinical scenarios
   - Questions that require knowledge of the podcast/content structure
   
   Examples of GOOD questions (extract facts, present generally):
   - "What are the main types of acute leukemia?" (from content about types)
   - "What are significant indicators of anemia?" (from case showing anemia indicators)
   - "What are common symptoms of acute lymphoblastic leukemia?" (from case describing symptoms)
   - "What are the diagnostic criteria for this condition?" (from diagnostic discussion)
   
   Examples of BAD questions (DO NOT CREATE THESE):
   - "What are the main types discussed in the podcast?" ❌ (references podcast)
   - "What symptoms did the patient in case 1 present with?" ❌ (references specific case)
   - "What was noted in the case study?" ❌ (references case study)
   - "What is a significant indicator of anemia noted in the case study?" ❌ (references case)
   - "What types of acute leukemia were mentioned?" ❌ (references discussion)
   
   Distribution:
   - Cover all major medical topics, concepts, definitions, facts, processes, and principles
   - Extract general medical knowledge from all content areas
   - Split complex topics into multiple focused questions
   - Ensure comprehensive coverage of the material

2. PIN-WORTHY COMMENT (1 welcoming comment):
   Create THE perfect comment to pin that:
   - Welcomes viewers warmly and sets positive tone
   - Highlights 1-2 most valuable takeaways or discussion points
   - Encourages engagement with a question or call-to-action
   - Feels authentic and community-focused (not salesy)
   - Is 2-4 sentences long
   
   Example tone: "Welcome everyone! 👋 The discussion about [key topic] at [timestamp] really resonated with me. What's your biggest takeaway from this episode? Drop your thoughts below - I read every comment!"

3. COMMUNITY POST IDEAS (3 follow-up posts):
   Generate 3 post ideas to maintain momentum between episodes:
   - Behind-the-scenes insights mentioned but not fully explored
   - Poll questions about topics discussed (A vs B, preferences)
   - Teaser for related upcoming content or episodes
   - Quick tips or resources related to main topics
   - Each should be 1-2 sentences describing the post idea
   
   Examples:
   - "Poll: Ask audience to vote on which topic to deep-dive next"
   - "Share a carousel of the 5 key frameworks discussed in this episode"
   - "Behind-the-scenes: How this episode changed my perspective on [topic]"

4. PODCAST DESCRIPTIONS (3 lengths):
   
   SHORT (150-200 chars):
   - One-sentence hook for social media previews
   - Captures essence and sparks curiosity
   - Includes biggest value proposition
   
   MEDIUM (300-500 chars):
   - Perfect for podcast feed descriptions
   - Covers main topics and guest (if applicable)
   - Includes 2-3 key takeaways
   - Ends with subtle CTA (listen, subscribe, etc.)
   
   LONG (800-1000 words):
   - Comprehensive show notes for blog or YouTube description
   - Detailed overview of all topics and chapters
   - Includes timestamps if relevant
   - Rich with keywords for SEO
   - Has sections for better readability
   - Ends with strong CTA and links (placeholders like [LINK] are fine)

For study flashcards: Extract ALL factual medical information from the podcast content, but present it as standalone general medical knowledge. Convert any case-specific or example-specific information into universal medical facts. Questions must be about the medical information itself - never reference cases, discussions, or how information was presented. Each flashcard should stand alone as textbook-style medical knowledge. Break down complex topics into multiple focused questions to ensure comprehensive coverage of all medical facts from the content.

For engagement tools: Make everything authentic, valuable, and optimized for growth. Focus on sparking genuine conversations and building a loyal community.`;
}

/**
 * Generate fallback flashcard content (40 items)
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
  
  // Generate 40 items by varying the base questions
  const flashcards: Array<{ question: string; answer: string }> = [];
  for (let i = 0; i < 40; i++) {
    const base = baseQuestions[i % baseQuestions.length];
    flashcards.push({
      question: base.q,
      answer: base.a,
    });
  }
  return flashcards;
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
    // Create OpenAI client with user key or environment key
    const openai = createOpenAIClient(userApiKey);

    // Bind OpenAI method to preserve `this` context (required for step.ai.wrap)
    const createCompletion = openai.chat.completions.create.bind(
      openai.chat.completions,
    );

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
    // Parse and validate response against schema
    const engagement = content
      ? engagementSchema.parse(JSON.parse(content))
      : {
          // Fallback: basic content if parsing fails (40 flashcards)
          commentStarters: generateFallbackFlashcards(),
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

    return engagement;
  } catch (error) {
    console.error("GPT engagement generation error:", error);

    // Graceful degradation: return generic content but allow workflow to continue
    const errorFlashcards = Array.from({ length: 40 }, (_, i) => ({
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
