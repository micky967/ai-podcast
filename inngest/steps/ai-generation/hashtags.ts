/**
 * Platform-Specific Hashtags Generation
 *
 * Generates relevant hashtags for each social media platform based on the podcast content.
 * Each platform has different hashtag conventions and best practices.
 *
 * Platforms Covered:
 * - Twitter/X: Trending topics, concise hashtags
 * - LinkedIn: Professional, industry-focused
 * - Instagram: Mix of popular and niche hashtags
 * - TikTok: Trending hashtags, viral tags
 * - YouTube: SEO-focused, topic-based
 */
import type { step as InngestStep } from "inngest";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createBoundCompletion } from "../../lib/openai-client";
import { type Hashtags, hashtagsSchema } from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

const HASHTAGS_SYSTEM_PROMPT =
  "You are a social media hashtag expert who understands each platform's hashtag conventions, trending topics, and best practices. You generate relevant, engaging hashtags that maximize reach and engagement.";

function buildHashtagsPrompt(transcript: TranscriptWithExtras): string {
  return `Generate platform-specific hashtags for this podcast episode.

PODCAST SUMMARY:
${transcript.chapters?.[0]?.summary || transcript.text.substring(0, 500)}

KEY TOPICS:
${
  transcript.chapters
    ?.slice(0, 5)
    .map((ch, idx) => `${idx + 1}. ${ch.headline}`)
    .join("\n") || "See transcript"
}

Generate 5-10 relevant hashtags for each platform:

1. TWITTER/X:
   - Mix of trending and niche hashtags
   - Keep them concise and readable
   - Include topic-specific and general interest tags
   - 5-8 hashtags recommended

2. LINKEDIN:
   - Professional, industry-focused hashtags
   - Career and business-related tags
   - Professional development tags
   - 5-8 hashtags recommended

3. INSTAGRAM:
   - Mix of popular (1M+ posts) and niche hashtags
   - Include both broad and specific tags
   - Visual/content-related tags
   - 8-10 hashtags recommended

4. TIKTOK:
   - Trending and viral hashtags
   - Gen Z friendly tags
   - Challenge and trend tags when relevant
   - 5-8 hashtags recommended

5. YOUTUBE:
   - SEO-focused hashtags
   - Topic and keyword-based tags
   - Educational content tags
   - 5-8 hashtags recommended

Make hashtags relevant to the content, avoid generic tags, and ensure they're appropriate for each platform's audience.`;
}

export async function generateHashtags(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras,
  userApiKey?: string,
): Promise<Hashtags> {
  console.log("Generating hashtags with GPT-4");

  try {
    const createCompletion = createBoundCompletion(userApiKey);

    const response = (await step.ai.wrap(
      "generate-hashtags-with-gpt",
      createCompletion,
      {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: HASHTAGS_SYSTEM_PROMPT },
          { role: "user", content: buildHashtagsPrompt(transcript) },
        ],
        response_format: zodResponseFormat(hashtagsSchema, "hashtags"),
      },
    )) as OpenAI.Chat.Completions.ChatCompletion;

    const content = response.choices[0]?.message?.content;
    const hashtags = content
      ? hashtagsSchema.parse(JSON.parse(content))
      : {
          // Fallback hashtags if parsing fails
          twitter: ["#Podcast", "#Education"],
          linkedin: ["#ProfessionalDevelopment", "#Learning"],
          instagram: ["#Podcast", "#Education", "#Learn"],
          tiktok: ["#fyp", "#Learn"],
          youtube: ["#Podcast", "#Education"],
        };

    return hashtags;
  } catch (error) {
    console.error("GPT hashtags error:", error);

    // Graceful degradation
    return {
      twitter: ["#Podcast", "#Error"],
      linkedin: ["#Podcast", "#Error"],
      instagram: ["#Podcast", "#Error"],
      tiktok: ["#Podcast", "#Error"],
      youtube: ["#Podcast", "#Error"],
    };
  }
}
