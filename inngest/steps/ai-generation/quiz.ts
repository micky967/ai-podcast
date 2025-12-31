/**
 * Quiz Generation - Multiple Choice Questions
 *
 * Generates comprehensive multiple-choice quizzes based on podcast or document content.
 * - Podcasts: 40-50 questions
 * - Documents: 25-50 questions
 * - Each question has 4 options with 1 correct answer
 * - Includes explanations for learning
 */
import type { step as InngestStep } from "inngest";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { createBoundCompletion } from "../../lib/openai-client";
import { type Quiz, quizSchema, quizQuestionsOnlySchema } from "../../schemas/ai-outputs";
import type { TranscriptWithExtras } from "../../types/assemblyai";

const QUIZ_SYSTEM_PROMPT = `You are an expert medical educator who creates comprehensive multiple-choice questions for medical professionals. 
You generate high-quality questions that test understanding, not just recall. Questions should:
- Cover key concepts, clinical applications, and important details
- Include one clearly correct answer and three plausible distractors
- Provide brief explanations for the correct answer
- Vary in difficulty (easy, medium, hard)
- Focus on practical medical knowledge and clinical reasoning`;

function getQuestionCount(
  contentType: "podcast" | "document",
  transcript: TranscriptWithExtras | null,
  documentText: string | null,
): number {
  if (contentType === "podcast") {
    // Podcast: 40-50 questions
    // Base: 40, add more based on transcript length
    const baseCount = 40;
    const textLength = transcript?.text?.length || 0;
    // Estimate: 1 question per ~500 characters (roughly 100 words)
    const additionalQuestions = Math.min(
      Math.floor(textLength / 500),
      10, // Max 10 additional questions
    );
    return Math.min(baseCount + additionalQuestions, 50);
  } else {
    // Document: 25-50 questions
    // Base: 25, add more based on word count
    const baseCount = 25;
    const textLength = documentText?.length || 0;
    // Estimate: 1 question per ~500 characters (roughly 100 words)
    const additionalQuestions = Math.min(
      Math.floor(textLength / 500),
      25, // Max 25 additional questions
    );
    return Math.min(baseCount + additionalQuestions, 50);
  }
}

function buildQuizPrompt(
  transcript: TranscriptWithExtras | null,
  documentText: string | null,
  contentType: "podcast" | "document",
  questionCount: number,
  existingQuestionCount: number,
): string {
  const isPodcast = contentType === "podcast";
  const content = isPodcast
    ? transcript?.text || transcript?.chapters?.[0]?.summary || ""
    : documentText || "";

  const summary = isPodcast
    ? transcript?.chapters?.[0]?.summary || transcript?.text.substring(0, 1000)
    : documentText?.substring(0, 1000) || "";

  const keyTopics = isPodcast
    ? transcript?.chapters
      ?.slice(0, 10)
      .map((ch, idx) => `${idx + 1}. ${ch.headline}`)
      .join("\n") || "See full content"
    : "See full document";

  return `Generate a comprehensive multiple-choice quiz based on this ${contentType} content.

CONTENT SUMMARY:
${summary}

KEY TOPICS:
${keyTopics}

FULL CONTENT (for reference):
${content.substring(0, 4000)}${content.length > 4000 ? "..." : ""}

REQUIREMENTS:
- Generate exactly ${questionCount} multiple-choice questions
- Each question must have exactly 4 options (A, B, C, D)
- Only one option should be correct
- Questions should test understanding, not just recall
- Include brief explanations (1-2 sentences) for correct answers
- Vary difficulty: mix of easy, medium, and hard questions
- Ensure questions are NEW and do not repeat earlier questions in this quiz.

QUESTION FORMAT:
- Clear, specific question text
- 4 plausible options (one correct, three distractors)
- Brief explanation of why the correct answer is correct
- Difficulty level (easy/medium/hard)

This is chunk ${existingQuestionCount + 1} through ${existingQuestionCount + questionCount} in a longer quiz. Do not restart numbering, and do not repeat previous questions.

Make questions relevant to the medical content, ensure correct answers are accurate, and make distractors plausible but clearly incorrect.`;
}

export async function generateQuiz(
  step: typeof InngestStep,
  transcript: TranscriptWithExtras | null,
  documentText: string | null,
  contentType: "podcast" | "document",
  userApiKey?: string,
): Promise<Quiz> {
  console.log(`Generating quiz for ${contentType} with GPT-4`);

  // Validate that we have content to generate questions from
  const isPodcast = contentType === "podcast";
  const contentText = isPodcast
    ? transcript?.text || transcript?.chapters?.[0]?.summary || ""
    : documentText || "";

  if (!contentText || contentText.trim().length === 0) {
    const errorMsg = isPodcast
      ? "Cannot generate quiz: Transcript is empty or missing"
      : "Cannot generate quiz: Document text is empty or missing";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Validate minimum content length
  if (contentText.length < 100) {
    const errorMsg = `Cannot generate quiz: Content is too short (${contentText.length} characters). Need at least 100 characters.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const createCompletion = createBoundCompletion(userApiKey);

    const targetQuestionCount = getQuestionCount(contentType, transcript, documentText);
    // Keep each OpenAI call small to avoid Vercel/Inngest webhook timeouts.
    const chunkSize = 4;
    const chunkCount = Math.ceil(targetQuestionCount / chunkSize);

    console.log(
      `Quiz generation: ${contentType}, target questions: ${targetQuestionCount}, chunks: ${chunkCount}, content length: ${contentText.length}`,
    );

    const allQuestions: Quiz["questions"] = [];

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const remaining = targetQuestionCount - allQuestions.length;
      const currentChunkCount = Math.min(chunkSize, remaining);

      const prompt = buildQuizPrompt(
        transcript,
        documentText,
        contentType,
        currentChunkCount,
        allQuestions.length,
      );

      const response = await step.run(
        `generate-quiz-${contentType}-chunk-${chunkIndex + 1}-of-${chunkCount}`,
        async () =>
          (await step.ai.wrap(
            `openai-${contentType}-quiz-chunk-${chunkIndex + 1}`,
            createCompletion,
            {
              // Use a faster model to reduce timeouts; quality is still good for MCQs.
              model: "gpt-4o-mini",
              // Bound response size; 4 questions with explanations should fit comfortably.
              max_tokens: 1200,
              messages: [
                { role: "system", content: QUIZ_SYSTEM_PROMPT },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              response_format: zodResponseFormat(quizQuestionsOnlySchema, "quiz"),
            },
          )) as OpenAI.Chat.Completions.ChatCompletion,
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error("GPT quiz error: No content in response");
        throw new Error("No content returned from OpenAI API");
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error("GPT quiz JSON parse error:", parseError);
        console.error("Raw content (first 500 chars):", content.substring(0, 500));
        throw new Error(
          `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      let aiResponse;
      try {
        aiResponse = quizQuestionsOnlySchema.parse(parsed);
      } catch (validationError) {
        console.error("GPT quiz schema validation error:", validationError);
        console.error(
          "Parsed content:",
          JSON.stringify(parsed, null, 2).substring(0, 1000),
        );
        throw new Error(
          `Quiz response validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
        );
      }

      if (!aiResponse.questions || aiResponse.questions.length === 0) {
        console.error("GPT quiz error: No questions in validated response");
        throw new Error("OpenAI returned a valid response but with no questions");
      }

      // Normalize fields and add stable IDs
      const normalized = aiResponse.questions.map((q, idx) => {
        const idNumber = allQuestions.length + idx + 1;
        return {
          ...q,
          id: q.id || `q${idNumber}`,
          explanation: q.explanation ?? undefined,
          difficulty: q.difficulty ?? undefined,
        };
      });

      allQuestions.push(...normalized);
    }

    // Construct full quiz object with programmatically added fields
    const quiz: Quiz = {
      contentType,
      questionCount: allQuestions.length,
      questions: allQuestions,
    };

    console.log(`Quiz generation successful: ${quiz.questions.length} questions generated`);
    return quiz;
  } catch (error) {
    console.error("GPT quiz generation error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contentType,
      contentLength: contentText.length,
    });

    // Throw error instead of returning empty quiz
    // This allows Inngest to properly track the error and set jobErrors.quiz
    throw error;
  }
}

