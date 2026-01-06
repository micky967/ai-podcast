import { inngest } from "./client";
import { OpenAI } from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const flashcardGenerator = inngest.createFunction(
    { id: "generate-medical-flashcards", retries: 2 },
    { event: "flashcards/generate-requested" },
    async ({ event, step }) => {
        const { projectId, categoryId, scope, userId } = event.data;

        // 1. Fetch Transcripts from Convex
        const transcripts = await step.run("fetch-transcripts", async () => {
            const result = await convex.query(api.flashcards.getTranscriptData, {
                projectId: projectId as Id<"projects">,
                categoryId: categoryId as Id<"categories"> | undefined,
                scope,
            });
            // Ensure we return a string
            if (typeof result === "string") {
                return result;
            }
            return "";
        });

        if (!transcripts || transcripts.length === 0) {
            // Update status to failed if no transcript - use a mutation to set failed status
            await convex.mutation(api.flashcards.setFailedStatus, {
                projectId: projectId as Id<"projects">,
            });
            throw new Error("No transcript found for this project. Please ensure the file has finished processing.");
        }

        // 2. AI Generation with OpenAI - USMLE-style questions
        const cardCount = scope === "category" ? 40 : 15;

        const cards = await step.run("generate-cards-with-ai", async () => {
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });

            const systemPrompt = `You are a USMLE Step 2 CK/Step 3 question writer creating high-yield flashcards in the UWorld style.

Create exactly ${cardCount} USMLE-style flashcard questions from the provided clinical transcript.

Each flashcard MUST follow this USMLE vignette format:

**FRONT (Question side):**
A concise clinical vignette with:
1. Patient demographics (age, gender)
2. Chief complaint and brief history
3. Key physical exam finding OR lab value
4. The question stem: "What is the most likely diagnosis?" OR "What is the most appropriate next step in management?" OR "What is the mechanism of action?"

Keep vignettes SHORT (2-4 sentences max) - these are flashcards for rapid review.

**BACK (Answer side):**
- The correct answer (1-2 words or short phrase)
- Brief explanation of why this is correct

**RATIONALE:**
- A memorable clinical pearl or test-taking tip
- "High-yield" fact that distinguishes this from similar conditions

Return a JSON object with this exact structure:
{
  "cards": [
    {
      "front": "A 45-year-old woman presents with fatigue, weight gain, and cold intolerance. Labs show TSH 12 mIU/L. What is the most likely diagnosis?",
      "back": "Hypothyroidism (Hashimoto's thyroiditis)",
      "rationale": "High TSH + symptoms of slowed metabolism = primary hypothyroidism. Most common cause in US is Hashimoto's (autoimmune)."
    }
  ]
}

Focus on:
- "Most likely diagnosis" questions
- "Next best step" in management
- Key lab values and their interpretations
- Classic presentations and buzzwords
- Treatment of choice for common conditions`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Create ${cardCount} USMLE-style flashcard questions from this clinical transcript:\n\n${transcripts.slice(0, 25000)}` }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
            });

            const content = JSON.parse(response.choices[0].message.content || '{"cards": []}');
            return content.cards || [];
        });

        // 3. Save to Convex DB
        await step.run("save-cards-to-db", async () => {
            await convex.mutation(api.flashcards.saveFlashcardSet, {
                userId,
                projectId: projectId as Id<"projects">,
                cards,
                title: scope === "category" ? "Category Mastery Set" : "Project Quick-Study",
                sourceType: scope,
            });
        });

        return { success: true, count: cards.length };
    }
);