/**
 * Zod Schemas for AI-Generated Content
 *
 * These schemas enforce structure for OpenAI Structured Outputs, ensuring:
 * - Type safety: Generated content matches our TypeScript types
 * - Validation: OpenAI's responses conform to our expected format
 * - Descriptions: Guide GPT on what to generate (used in prompt construction)
 *
 * OpenAI Structured Outputs Flow:
 * 1. Define Zod schema with .describe() hints for GPT
 * 2. Pass schema to zodResponseFormat() in OpenAI API call
 * 3. OpenAI returns JSON matching the schema (no parsing errors!)
 * 4. Parse with schema.parse() for TypeScript types
 *
 * Design Decision: Zod over TypeScript types alone
 * - Runtime validation (catches API changes or malformed responses)
 * - Self-documenting schemas (descriptions guide both GPT and developers)
 * - Automatic type inference (no duplicate type definitions)
 */
import { z } from "zod";

/**
 * Summary Schema - Multi-format podcast overview
 *
 * Provides different summary lengths for various use cases:
 * - full: Detailed overview for blog posts or show notes
 * - bullets: Scannable list for quick reference
 * - insights: Actionable takeaways for the audience
 * - tldr: Hook for social media or email subject lines
 */
export const summarySchema = z.object({
  full: z.string().describe("Comprehensive overview (200-300 words)"),
  bullets: z
    .array(z.string())
    .min(5)
    .max(7)
    .describe("5-7 key bullet points covering main topics"),
  insights: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("3-5 actionable insights or takeaways"),
  tldr: z.string().describe("One-sentence summary"),
});

export type Summary = z.infer<typeof summarySchema>;

/**
 * Titles Schema - Context-specific title suggestions
 *
 * Different title formats optimized for:
 * - youtubeShort: Clickable, emotional hooks (40-60 chars)
 * - youtubeLong: SEO-optimized with keywords (70-100 chars)
 * - podcastTitles: Episode titles for podcast feeds
 * - seoKeywords: Discoverability across search engines
 */
export const titlesSchema = z.object({
  youtubeShort: z
    .array(z.string())
    .length(3)
    .describe("3 YouTube short titles (40-60 chars, hook-focused)"),
  youtubeLong: z
    .array(z.string())
    .length(3)
    .describe("3 YouTube long titles (70-100 chars, SEO keywords)"),
  podcastTitles: z
    .array(z.string())
    .length(3)
    .describe("3 podcast episode titles (creative + descriptive)"),
  seoKeywords: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe("5-10 SEO keywords for discoverability"),
});

export type Titles = z.infer<typeof titlesSchema>;

/**
 * PowerPoint Schema - Slide deck outline for export
 *
 * Each slide includes a title, bullet points, optional notes, and a hint
 * about simple clip art/icons or layouts. The deck is designed to be
 * templated for export as PowerPoint or PDF.
 */
export const powerPointSchema = z.object({
  slides: z
    .array(
      z.object({
        title: z.string().describe("Clear, descriptive slide title"),
        bullets: z
          .array(z.string())
          .min(3)
          .max(8)
          .describe("3-8 complete, detailed bullet points with full information - ready to present. Each bullet should contain substantial content, not just a phrase. Make them comprehensive and presentation-ready."),
        notes: z
          .string()
          .nullable()
          .describe("Detailed speaker notes with additional context, talking points, and explanations for the presenter"),
        visualHint: z
          .string()
          .nullable()
          .describe(
            "Simple vector/clip-art suggestion (icon name, shape, or theme)",
          ),
        layout: z
          .string()
          .nullable()
          .describe("Suggested slide layout (title, bullets, quote, or two-column)"),
      }),
    )
    .min(15)
    .max(40)
    .describe("15-40 comprehensive slides covering ALL content from the podcast/document. Each slide must have complete, presentation-ready content."),
  theme: z.string().nullable().describe("Suggested template or visual theme"),
  summary: z
    .string()
    .describe("Brief narrative describing the flow of the deck"),
});

export type PowerPoint = z.infer<typeof powerPointSchema>;

/**
 * Social Posts Schema - Platform-optimized content
 *
 * Each platform has unique characteristics:
 * - twitter: 280 char limit, punchy and quotable
 * - linkedin: Professional tone, longer-form acceptable
 * - instagram: Visual-first, emoji-rich, storytelling
 * - tiktok: Gen Z voice, casual, trend-aware
 * - youtube: Detailed descriptions with timestamps and CTAs
 * - facebook: Community-focused, conversation starters
 */
export const socialPostsSchema = z.object({
  twitter: z.string().max(280).describe("Twitter/X post (280 chars max)"),
  linkedin: z
    .string()
    .describe("LinkedIn post (professional tone, 1-2 paragraphs)"),
  instagram: z.string().describe("Instagram caption (engaging, emoji-rich)"),
  tiktok: z.string().describe("TikTok caption (Gen Z tone, short)"),
  youtube: z.string().describe("YouTube description (detailed, timestamps)"),
  facebook: z.string().describe("Facebook post (conversational, shareable)"),
});

export type SocialPosts = z.infer<typeof socialPostsSchema>;

/**
 * Hashtags Schema - Platform-specific hashtag arrays
 *
 * Each platform has different hashtag conventions:
 * - twitter: Trending topics, concise tags
 * - linkedin: Professional, industry-focused
 * - instagram: Mix of popular and niche (8-10 tags)
 * - tiktok: Trending and viral hashtags
 * - youtube: SEO-focused, topic-based
 */
export const hashtagsSchema = z.object({
  twitter: z
    .array(z.string())
    .min(5)
    .max(8)
    .describe("5-8 Twitter/X hashtags (trending and niche mix)"),
  linkedin: z
    .array(z.string())
    .min(5)
    .max(8)
    .describe("5-8 LinkedIn hashtags (professional, industry-focused)"),
  instagram: z
    .array(z.string())
    .min(8)
    .max(10)
    .describe("8-10 Instagram hashtags (mix of popular and niche)"),
  tiktok: z
    .array(z.string())
    .min(5)
    .max(8)
    .describe("5-8 TikTok hashtags (trending and viral tags)"),
  youtube: z
    .array(z.string())
    .min(5)
    .max(8)
    .describe("5-8 YouTube hashtags (SEO-focused, topic-based)"),
});

export type Hashtags = z.infer<typeof hashtagsSchema>;

/**
 * Quiz Schema - Multiple choice questions for testing understanding
 *
 * Generates comprehensive quizzes based on content:
 * - Podcasts: 40-50 questions
 * - Documents: 25-50 questions
 * - Each question has 4 options with 1 correct answer
 * - Includes explanations for learning
 *
 * Note: contentType and questionCount are added programmatically, not by AI
 */
// Question object schema for OpenAI structured outputs (must use .nullable() not .optional())
const quizQuestionSchemaForAI = z.object({
  id: z.string().describe("Unique identifier for the question"),
  question: z
    .string()
    .describe("The question text (clear and specific)"),
  options: z
    .array(z.string())
    .length(4)
    .describe("Exactly 4 answer options"),
  correctAnswer: z
    .number()
    .min(0)
    .max(3)
    .describe("Index of the correct answer (0-3)"),
  explanation: z
    .string()
    .nullable()
    .describe("Brief explanation of why the correct answer is correct"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .nullable()
    .describe("Question difficulty level"),
});

// Question object schema for internal use (can use .optional())
const quizQuestionSchema = z.object({
  id: z.string().describe("Unique identifier for the question"),
  question: z
    .string()
    .describe("The question text (clear and specific)"),
  options: z
    .array(z.string())
    .length(4)
    .describe("Exactly 4 answer options"),
  correctAnswer: z
    .number()
    .min(0)
    .max(3)
    .describe("Index of the correct answer (0-3)"),
  explanation: z
    .string()
    .optional()
    .describe("Brief explanation of why the correct answer is correct"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .describe("Question difficulty level"),
});

// Schema for what the AI generates (questions only) - sent to OpenAI
// Must use quizQuestionSchemaForAI which uses .nullable() for optional fields
export const quizQuestionsOnlySchema = z.object({
  questions: z
    .array(quizQuestionSchemaForAI)
    .min(25)
    .max(50)
    .describe(
      "25-50 multiple choice questions (40-50 for podcasts, 25-50 for documents)",
    ),
});

// Full quiz schema with programmatically added fields
export const quizSchema = z.object({
  contentType: z
    .enum(["podcast", "document"])
    .describe("Type of content (podcast or document)"),
  questionCount: z
    .number()
    .min(25)
    .max(50)
    .describe("Total number of questions generated"),
  questions: z
    .array(quizQuestionSchema)
    .min(25)
    .max(50)
    .describe(
      "25-50 multiple choice questions (40-50 for podcasts, 25-50 for documents)",
    ),
});

export type Quiz = z.infer<typeof quizSchema>;

export const engagementSchema = z.object({
  commentStarters: z
    .array(
      z.object({
        question: z.string().describe("Concise study question for flashcards"),
        answer: z
          .string()
          .describe("Accurate, concise answer suitable for study flashcards"),
      }),
    )
    .min(10)
    .max(50)
    .describe(
      "10-50 study flashcard questions with answers for memorization (generate 20-30 for short documents, 30-40 for medium documents, 40-50 for long documents with tables/spreadsheets, 50 for audio/MP3 files)",
    ),
  pinComment: z
    .string()
    .describe(
      "Best comment to pin on YouTube (welcoming, conversation starter)",
    ),
  communityPosts: z
    .array(z.string())
    .length(3)
    .describe("3 follow-up community post ideas to keep audience engaged"),
  descriptions: z
    .object({
      short: z
        .string()
        .max(200)
        .describe("Short description (150-200 chars for previews)"),
      medium: z
        .string()
        .max(500)
        .describe("Medium description (300-500 chars for podcast feeds)"),
      long: z
        .string()
        .describe(
          "Long description (800-1000 words for blog/show notes with full context)",
        ),
    })
    .describe("Podcast description variants for different use cases"),
});

export type Engagement = z.infer<typeof engagementSchema>;

export const clinicalScenarioSchema = z.object({
  vignette: z
    .string()
    .describe(
      "Dense, professional clinical vignette paragraph including: age, sex, chief complaint, HPI, PMH, meds, vitals, and physical exam.",
    ),
  question: z
    .string()
    .describe(
      "Board-style question stem (e.g., next best step, diagnosis, mechanism, contraindication, management).",
    ),
  options: z
    .array(z.string())
    .length(5)
    .describe("Exactly 5 answer options (A-E), each a complete choice."),
  correctAnswer: z
    .string()
    .describe("Must match exactly one of the provided options."),
  explanation: z
    .object({
      correct: z
        .string()
        .describe("Why the correct answer is correct, grounded in the source."),
      distractors: z
        .array(z.string())
        .length(4)
        .describe(
          "Why each other option is wrong (4 entries). Each entry should reference the option letter and reasoning.",
        ),
    })
    .describe(
      "Explanations must include both 'why this is right' and 'why others are wrong'.",
    ),
  sourceReference: z
    .string()
    .describe(
      "A verbatim quote/snippet from the provided transcript/document excerpt that supports the correct answer.",
    ),
  rationale: z
    .string()
    .describe(
      "REQUIRED: Comprehensive clinical rationale explaining: (1) Why the correct answer is the gold standard or best choice, (2) Why each distractor is incorrect, specifically addressing any red herrings or nuances in the vignette. Should be educational and reference guidelines when applicable. This field is mandatory and must always be provided.",
    ),
});

export const clinicalScenariosSchema = z.object({
  scenarios: z
    .array(clinicalScenarioSchema)
    .min(1)
    .max(20)
    .describe("1-20 board-style, source-grounded QBank questions"),
});

export type ClinicalScenario = z.infer<typeof clinicalScenarioSchema>;
export type ClinicalScenarios = z.infer<typeof clinicalScenariosSchema>;
