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
 * - Comment Starters: 5-7 questions/comments to prime engagement
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
import { openai } from "../../lib/openai-client";
import { type Engagement, engagementSchema } from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

// System prompt defines GPT's role and expertise
const ENGAGEMENT_SYSTEM_PROMPT =
  "You are an expert YouTube and podcast growth strategist specializing in audience engagement and community building. You understand what sparks conversations, builds loyal communities, and keeps audiences coming back for more.";

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
  return `Analyze this podcast transcript and create comprehensive engagement and growth tools.

TRANSCRIPT (first 3000 chars):
${transcript.text.substring(0, 3000)}...

${
  transcript.chapters.length > 0
    ? `\nAUTO-DETECTED CHAPTERS:\n${transcript.chapters
        .map((ch, idx) => `${idx + 1}. ${ch.headline} - ${ch.summary}`)
        .join("\n")}`
    : ""
}

Create engagement assets to help this content go viral and build community:

1. COMMENT STARTERS (5-7 items):
   Generate anticipated questions or thoughtful comments WITH ANSWERS.
   For each item, provide:
   - question: A natural, engaging question or comment that sparks discussion
   - answer: A thoughtful 2-3 sentence answer based on the podcast content
   
   Questions should:
   - Spark meaningful discussion about key topics
   - Ask for audience perspectives or experiences
   - Request follow-up content on specific points
   - Challenge or build on ideas presented
   - Be natural and genuine (not obviously planted)
   
   Answers should:
   - Reference specific points from the podcast
   - Be conversational and helpful (2-3 sentences)
   - Encourage further discussion
   - Provide value to the asker and other viewers
   
   Example:
   {
     "question": "At 12:45 when you mentioned X, did you also consider Y?",
     "answer": "Great question! Yes, we briefly touched on Y around the 15-minute mark. The key difference is that X focuses on immediate results while Y takes a longer-term approach. Would love to do a deep dive on this in a future episode!"
   }

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

Make everything authentic, valuable, and optimized for growth. Focus on sparking genuine conversations and building a loyal community.`;
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
): Promise<Engagement> {
  console.log("Generating engagement & growth tools with GPT-4");

  try {
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
          // Fallback: basic content if parsing fails
          commentStarters: [
            {
              question: "What was your biggest takeaway from this episode?",
              answer:
                "Thanks for engaging! The main themes we covered were around practical strategies for improvement. I'd love to hear which specific point resonated most with you!",
            },
            {
              question: "Which topic resonated most with you?",
              answer:
                "Great question! We covered several topics in depth. The audience feedback helps us understand what to explore further in future episodes.",
            },
            {
              question: "Has anyone else experienced something similar?",
              answer:
                "This is a common experience! Many in our community have shared similar stories. Feel free to share your perspective - we read all comments!",
            },
            {
              question: "Would love to hear your perspective on this!",
              answer:
                "Thanks for your interest! Your perspective adds value to the conversation. The diverse viewpoints in our community make these discussions richer.",
            },
            {
              question: "What should we cover in the next episode?",
              answer:
                "We're always looking for topic suggestions! Based on this episode's themes, we're planning to dive deeper into related areas. Drop your ideas below!",
            },
          ],
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
    return {
      commentStarters: [
        {
          question: "What was your biggest takeaway from this episode?",
          answer:
            "⚠️ Error generating answer. Please try regenerating this content.",
        },
        {
          question: "Which topic resonated most with you?",
          answer:
            "⚠️ Error generating answer. Please try regenerating this content.",
        },
        {
          question: "Has anyone else experienced something similar?",
          answer:
            "⚠️ Error generating answer. Please try regenerating this content.",
        },
        {
          question: "Would love to hear your perspective on this!",
          answer:
            "⚠️ Error generating answer. Please try regenerating this content.",
        },
        {
          question: "What should we cover in the next episode?",
          answer:
            "⚠️ Error generating answer. Please try regenerating this content.",
        },
      ],
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
