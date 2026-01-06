"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { inngest } from "@/inngest/client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type FlashcardScope = "project" | "category";

interface GenerateFlashcardsInput {
    projectId: Id<"projects">;
    scope: FlashcardScope;
}

/**
 * Server action to trigger flashcard generation via Inngest
 * This follows the same pattern as the existing podcast processing
 */
export async function generateFlashcardsAction(input: GenerateFlashcardsInput) {
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized: Please sign in to generate flashcards");
    }

    const { projectId, scope } = input;

    // 1. Get project to verify access and get categoryId
    const project = await convex.query(api.projects.getProject, {
        projectId,
        userId,
    });

    if (!project) {
        throw new Error("Project not found or access denied");
    }

    // 2. Update status to "generating" in Convex
    await convex.mutation(api.flashcards.setGeneratingStatus, {
        projectId,
    });

    // 3. Send event to Inngest (fire-and-forget pattern like podcast processing)
    // biome-ignore lint/suspicious/noExplicitAny: Inngest event typing
    (inngest.send as any)({
        name: "flashcards/generate-requested",
        data: {
            userId,
            projectId,
            categoryId: project.categoryId,
            scope,
        },
    })
        .then(() => {
            console.log(
                `[FLASHCARDS] ✅ Event sent successfully for project ${projectId}`
            );
        })
        .catch((error: unknown) => {
            console.error(
                `[FLASHCARDS] ❌ Failed to send event for project ${projectId}:`,
                error
            );
        });

    return { success: true };
}
