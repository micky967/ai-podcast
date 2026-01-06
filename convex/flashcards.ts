import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * DEBUG QUERY: List projects with their transcript status
 * Use this to find projects that have completed transcription
 */
export const debugListProjectsWithTranscripts = query({
    args: {},
    handler: async (ctx) => {
        const projects = await ctx.db
            .query("projects")
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .order("desc")
            .take(10);

        return projects.map((p) => ({
            id: p._id,
            fileName: p.fileName,
            status: p.status,
            hasTranscript: !!p.transcript?.text,
            transcriptLength: p.transcript?.text?.length ?? 0,
            jobStatus: p.jobStatus,
        }));
    },
});

/**
 * PUBLIC QUERY: Fetch flashcard set for a project
 */
export const getFlashcardsForProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const project = await ctx.db.get(args.projectId);
        if (!project || !project.flashcardSetId) return null;
        return await ctx.db.get(project.flashcardSetId);
    },
});

/**
 * PUBLIC MUTATION: Set flashcard status to "generating"
 * Called by the server action before triggering Inngest
 */
export const setGeneratingStatus = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, { flashcardStatus: "generating" });
        return { success: true };
    },
});

/**
 * PUBLIC MUTATION: Reset flashcard status to "idle" (for retry/regenerate)
 */
export const resetFlashcardStatus = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, {
            flashcardStatus: "idle",
            flashcardSetId: undefined,
        });
        return { success: true };
    },
});

/**
 * PUBLIC MUTATION: Set flashcard status to "failed"
 * Called by Inngest when generation fails (e.g., no transcript)
 */
export const setFailedStatus = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, { flashcardStatus: "failed" });
        return { success: true };
    },
});

/**
 * PUBLIC QUERY: Get transcript data for Inngest function
 * Supports both single project and category-wide (last 5 projects)
 * Note: Must be public for ConvexHttpClient to call from Inngest
 */
export const getTranscriptData = query({
    args: {
        projectId: v.id("projects"),
        categoryId: v.optional(v.id("categories")),
        scope: v.union(v.literal("project"), v.literal("category")),
    },
    handler: async (ctx, args) => {
        if (args.scope === "project") {
            const project = await ctx.db.get(args.projectId);
            // Debug logging
            console.log("[FLASHCARDS] getTranscriptData called:", {
                projectId: args.projectId,
                scope: args.scope,
                hasProject: !!project,
                hasTranscript: !!project?.transcript,
                hasTranscriptText: !!project?.transcript?.text,
                transcriptLength: project?.transcript?.text?.length ?? 0,
                projectStatus: project?.status,
                jobStatus: project?.jobStatus,
            });
            // transcript is an object with a text property
            return project?.transcript?.text ?? "";
        }

        // Category scope: get transcripts from last 5 projects in category
        if (args.scope === "category" && args.categoryId) {
            const projectsInCategory = await ctx.db
                .query("projects")
                .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
                .filter((q) => q.eq(q.field("deletedAt"), undefined))
                .order("desc")
                .take(5);

            const transcripts = projectsInCategory
                .map((p) => p.transcript?.text)
                .filter(Boolean)
                .join("\n\n---\n\n");

            return transcripts || "";
        }

        return "";
    },
});

/**
 * PUBLIC MUTATION: Save flashcard set and update project status
 * Called by Inngest after AI generation completes
 * Note: Must be public for ConvexHttpClient to call from Inngest
 */
export const saveFlashcardSet = mutation({
    args: {
        userId: v.string(),
        projectId: v.id("projects"),
        title: v.string(),
        sourceType: v.string(),
        cards: v.array(
            v.object({
                front: v.string(),
                back: v.string(),
                rationale: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const setId = await ctx.db.insert("flashcardSets", {
            userId: args.userId,
            title: args.title,
            sourceType: args.sourceType as "project" | "category",
            sourceId: args.projectId,
            cards: args.cards,
            createdAt: Date.now(),
        });

        await ctx.db.patch(args.projectId, {
            flashcardStatus: "completed",
            flashcardSetId: setId,
        });

        return setId;
    },
});