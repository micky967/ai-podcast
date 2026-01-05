/**
 * Convex Mutations and Queries for Project Management
 *
 * This module handles all database operations for podcast projects.
 * Convex provides real-time reactivity - when these mutations run, all subscribed
 * clients automatically receive updates without polling or manual cache invalidation.
 */
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

/**
 * Creates a new project record after file upload
 */
export const createProject = mutation({
  args: {
    userId: v.string(),
    inputUrl: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileDuration: v.optional(v.number()),
    fileFormat: v.string(),
    mimeType: v.string(),
    categoryId: v.optional(v.id("categories")),
    subcategoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      userId: args.userId,
      inputUrl: args.inputUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileDuration: args.fileDuration,
      fileFormat: args.fileFormat,
      mimeType: args.mimeType,
      categoryId: args.categoryId,
      subcategoryId: args.subcategoryId,
      status: "uploaded",
      jobStatus: {
        transcription: "pending",
        contentGeneration: "pending",
      },
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Appends new clinical scenarios to a project, preventing duplicates
 */
export const appendClinicalScenarios = mutation({
  args: {
    projectId: v.id("projects"),
    scenarios: v.array(
      v.union(
        v.object({
          vignette: v.string(),
          question: v.string(),
          options: v.array(v.string()),
          correctAnswer: v.string(),
          explanation: v.object({
            correct: v.string(),
            distractors: v.array(v.string()),
          }),
          sourceReference: v.string(),
          rationale: v.optional(v.string()),
          difficulty: v.optional(v.number()),
          verifiedAccuracy: v.optional(v.boolean()),
        }),
        v.object({
          title: v.string(),
          patient: v.string(),
          presentation: v.string(),
          difficulty: v.optional(v.number()),
          soap: v.object({
            subjective: v.string(),
            objective: v.string(),
            assessment: v.string(),
            plan: v.string(),
          }),
          rationale: v.string(),
          redFlags: v.array(v.string()),
          teachingPearls: v.array(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const existing = (project as any).clinicalScenarios?.scenarios ?? [];
    if (existing.length >= 20) throw new Error("Clinical scenarios complete (20/20)");

    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

    const keyFor = (sc: any) => {
      if (typeof sc?.vignette === "string") {
        return `${normalize(sc.vignette)}|${normalize(sc.question)}|${normalize(sc.correctAnswer)}`;
      }
      return `${normalize(sc.title)}|${normalize(sc.patient)}|${normalize(sc.presentation)}`;
    };

    const seen = new Set(existing.map((sc: any) => keyFor(sc)));
    const uniqueNew = args.scenarios.filter((sc: any) => {
      const k = keyFor(sc);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (uniqueNew.length === 0) {
      throw new Error("Generated scenarios were duplicates. Please try again.");
    }

    const combined = [...existing, ...uniqueNew].slice(0, 20);

    await ctx.db.patch(args.projectId, {
      clinicalScenarios: { scenarios: combined },
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates the overall project status
 */
export const updateProjectStatus = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"projects">> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "completed") updates.completedAt = Date.now();
    await ctx.db.patch(args.projectId, updates);
  },
});

/**
 * Saves the transcript from AssemblyAI
 */
export const saveTranscript = mutation({
  args: {
    projectId: v.id("projects"),
    transcript: v.object({
      text: v.string(),
      segments: v.array(v.any()),
      speakers: v.optional(v.array(v.any())),
      chapters: v.optional(v.array(v.any())),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      transcript: args.transcript,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates individual job status (transcription/content generation)
 */
export const updateJobStatus = mutation({
  args: {
    projectId: v.id("projects"),
    transcription: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"))),
    contentGeneration: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"))),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      jobStatus: {
        ...project.jobStatus,
        ...(args.transcription && { transcription: args.transcription }),
        ...(args.contentGeneration && { contentGeneration: args.contentGeneration }),
      },
      updatedAt: Date.now(),
    });
  },
});

/**
 * Saves all AI-generated content in one operation
 */
export const saveGeneratedContent = mutation({
  args: {
    projectId: v.id("projects"),
    keyMoments: v.optional(v.array(v.any())),
    summary: v.optional(v.any()),
    socialPosts: v.optional(v.any()),
    titles: v.optional(v.any()),
    youtubeTimestamps: v.optional(v.array(v.any())),
    clinicalScenarios: v.optional(v.any()),
    powerPoint: v.optional(v.any()),
    engagement: v.optional(v.any()),
    hashtags: v.optional(v.any()),
    quiz: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...content } = args;
    await ctx.db.patch(projectId, {
      ...content,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Records an error when processing fails
 */
export const recordError = mutation({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
    step: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: "failed",
      error: {
        message: args.message,
        step: args.step,
        timestamp: Date.now(),
        details: args.details,
      },
      updatedAt: Date.now(),
    });
  },
});

/**
 * Saves errors for individual generation jobs
 */
export const saveJobErrors = mutation({
  args: {
    projectId: v.id("projects"),
    jobErrors: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      jobErrors: args.jobErrors,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Retrieves a single project by ID with permission checks
 */
export const getProject = query({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const isAppOwner = userSettings?.role === "owner";

    if (isAppOwner) {
      const isOwnProject = project.userId === args.userId;
      return { ...project, isOwner: isOwnProject, isShared: !isOwnProject };
    }

    if (project.userId === args.userId) return { ...project, isOwner: true, isShared: false };

    const userMemberGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const member of userMemberGroups) {
      const group = await ctx.db.get(member.groupId);
      if (group && group.ownerId === project.userId) return { ...project, isOwner: false, isShared: true };
    }

    return null;
  },
});

/**
 * Lists user projects including shared files with pagination and filtering
 */
export const listUserProjectsWithShared = query({
  args: {
    userId: v.string(),
    filter: v.optional(v.union(v.literal("own"), v.literal("shared"), v.literal("all"))),
    paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    try {
      const numItems = args.paginationOpts?.numItems ?? 20;
      const filter = args.filter ?? "all";
      const cursor = args.paginationOpts?.cursor;
      const startIndex = cursor ? parseInt(cursor, 10) : 0;

      const userSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      const isOwner = userSettings?.role === "owner";

      // 1. Moderator View
      if (isOwner && filter === "all") {
        return await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .order("desc")
          .paginate({ numItems, cursor: cursor ?? null });
      }

      // 2. Fetch Own
      let ownProjects: Doc<"projects">[] = [];
      if (filter === "own" || filter === "all") {
        ownProjects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();
      }

      // 3. Fetch Shared
      let sharedProjects: Doc<"projects">[] = [];
      if (filter === "shared" || filter === "all") {
        const memberGroups = await ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        const groupOwners = new Set<string>();
        for (const m of memberGroups) {
          const group = await ctx.db.get(m.groupId);
          if (group) groupOwners.add(group.ownerId);
        }

        const sharedArrays = await Promise.all(
          Array.from(groupOwners).map((ownerId) =>
            ctx.db.query("projects").withIndex("by_user", (q) => q.eq("userId", ownerId)).filter((q) => q.eq(q.field("deletedAt"), undefined)).collect()
          )
        );
        sharedProjects = sharedArrays.flat();
      }

      // 4. Combine and Paginate
      let allCombined: Doc<"projects">[] = [];
      const seenIds = new Set();
      const combined = [...ownProjects, ...sharedProjects];

      for (const p of combined) {
        if (!seenIds.has(p._id)) {
          if (filter === "all" || (filter === "own" && p.userId === args.userId) || (filter === "shared" && p.userId !== args.userId)) {
            allCombined.push(p);
            seenIds.add(p._id);
          }
        }
      }

      allCombined.sort((a, b) => b.createdAt - a.createdAt);

      const endIndex = startIndex + numItems;
      const page = allCombined.slice(startIndex, endIndex);
      const hasMore = endIndex < allCombined.length;

      return {
        page,
        continueCursor: hasMore ? endIndex.toString() : null,
        isDone: !hasMore,
      };
    } catch (err) {
      console.error(err);
      return { page: [], continueCursor: null, isDone: true };
    }
  },
});

/**
 * Updates the verified accuracy status of a specific clinical scenario
 */
export const setClinicalScenarioVerifiedAccuracy = mutation({
  args: {
    projectId: v.id("projects"),
    scenarioIndex: v.number(),
    verifiedAccuracy: v.boolean(), // 1. Change "verified" to "verifiedAccuracy"
    sourceQuote: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.clinicalScenarios) throw new Error("Scenarios not found");

    const updatedScenarios = [...project.clinicalScenarios.scenarios];
    if (updatedScenarios[args.scenarioIndex]) {
      const scenario = updatedScenarios[args.scenarioIndex] as any;
      scenario.verifiedAccuracy = args.verifiedAccuracy; // 2. Update this to match the new arg name
      scenario.sourceReference = args.sourceQuote;

      await ctx.db.patch(args.projectId, {
        clinicalScenarios: {
          ...project.clinicalScenarios,
          scenarios: updatedScenarios,
        },
        updatedAt: Date.now(),
      });
    } else {
      throw new Error("Invalid scenario index");
    }
  },
});


/**
 * Deletes a project by marking it as deleted (Soft Delete)
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.optional(v.string()), // Add this line to accept the extra field
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Deletes a specific clinical scenario from a project
 * 
 * Security: Only allows deletion if:
 * - User is the project creator (project.userId === args.userId), OR
 * - User has 'owner' role in userSettings
 */
export const deleteClinicalScenario = mutation({
  args: {
    projectId: v.id("projects"),
    scenarioIndex: v.number(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch the project
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Fetch user settings to check role
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Permission check: allow deletion ONLY if user is creator OR owner
    const isCreator = project.userId === args.userId;
    const isOwner = userSettings?.role === "owner";

    if (!isCreator && !isOwner) {
      throw new Error("Unauthorized: You do not have permission to delete this scenario");
    }

    // Validate scenario index
    const scenarios = (project as any).clinicalScenarios?.scenarios ?? [];
    if (args.scenarioIndex < 0 || args.scenarioIndex >= scenarios.length) {
      throw new Error("Invalid scenario index");
    }

    // Remove the scenario at the specified index
    const updatedScenarios = scenarios.filter(
      (_: any, idx: number) => idx !== args.scenarioIndex
    );

    // Update the project with the new scenarios array
    await ctx.db.patch(args.projectId, {
      clinicalScenarios: {
        ...(project as any).clinicalScenarios,
        scenarios: updatedScenarios,
      },
      updatedAt: Date.now(),
    });

    return { success: true, remainingCount: updatedScenarios.length };
  },
});