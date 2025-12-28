/**
 * Convex Mutations and Queries for Project Management
 *
 * This module handles all database operations for podcast projects.
 * Convex provides real-time reactivity - when these mutations run, all subscribed
 * clients automatically receive updates without polling or manual cache invalidation.
 *
 * Architecture Pattern:
 * - Mutations: Write operations called from Next.js server actions or Inngest functions
 * - Queries: Read operations that React components subscribe to for real-time updates
 * - All functions are fully type-safe with automatic TypeScript generation
 *
 * Real-time Flow:
 * 1. Inngest calls mutation (e.g., updateJobStatus)
 * 2. Convex updates database
 * 3. All subscribed React components (useQuery) instantly re-render with new data
 * 4. No WebSocket setup, polling, or manual state management required
 */
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

/**
 * Creates a new project record after file upload
 *
 * Called by: Next.js server action after Vercel Blob upload succeeds
 *
 * Flow:
 * 1. User uploads file -> Vercel Blob
 * 2. Server action creates project in Convex
 * 3. Server action triggers Inngest workflow
 * 4. Inngest updates this project as processing proceeds
 *
 * Design Decision: Initialize with all jobStatus as "pending" to avoid null checks in UI
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

    // Insert new project with initial "uploaded" status
    // Initialize jobStatus to "pending" so UI can track progress from the start
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
 * Updates the overall project status
 *
 * Called by: Inngest workflow at key milestones
 * - "uploaded" -> "processing" when workflow starts
 * - "processing" -> "completed" when all jobs finish successfully
 * - Any status -> "failed" on error
 *
 * Real-time Impact: UI components subscribed to this project instantly reflect the new status
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

    // Track completion time for analytics and billing
    if (args.status === "completed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.projectId, updates);
  },
});

/**
 * Saves the transcript from AssemblyAI
 *
 * Called by: Inngest transcription step after AssemblyAI completes
 *
 * Data Structure:
 * - text: Full transcript as one string
 * - segments: Time-coded chunks with word-level timing
 * - speakers: Speaker diarization data (who said what)
 *
 * Design Decision: Store full transcript in Convex (not Blob) for:
 * - Fast querying and display
 * - Real-time updates as transcription completes
 * - No additional HTTP request to load transcript
 */
export const saveTranscript = mutation({
  args: {
    projectId: v.id("projects"),
    transcript: v.object({
      text: v.string(),
      segments: v.array(
        v.object({
          id: v.number(),
          start: v.number(),
          end: v.number(),
          text: v.string(),
          words: v.optional(
            v.array(
              v.object({
                word: v.string(),
                start: v.number(),
                end: v.number(),
              }),
            ),
          ),
        }),
      ),
      speakers: v.optional(
        v.array(
          v.object({
            speaker: v.string(),
            start: v.number(),
            end: v.number(),
            text: v.string(),
            confidence: v.number(),
          }),
        ),
      ),
      chapters: v.optional(
        v.array(
          v.object({
            start: v.number(),
            end: v.number(),
            headline: v.string(),
            summary: v.string(),
            gist: v.string(),
          }),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    // Store transcript directly in Convex for instant access
    await ctx.db.patch(args.projectId, {
      transcript: args.transcript,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates the job status for transcription or content generation phases
 *
 * Called by: Inngest workflow to track progress of individual phases
 * - transcription: "pending" -> "running" -> "completed"/"failed"
 * - contentGeneration: "pending" -> "running" -> "completed"/"failed"
 *
 * Real-time Impact: UI components instantly reflect phase progress
 */
export const updateJobStatus = mutation({
  args: {
    projectId: v.id("projects"),
    transcription: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    contentGeneration: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const updates: Partial<Doc<"projects">> = {
      jobStatus: {
        ...project.jobStatus,
        ...(args.transcription && { transcription: args.transcription }),
        ...(args.contentGeneration && {
          contentGeneration: args.contentGeneration,
        }),
      },
      updatedAt: Date.now(),
    };

    await ctx.db.patch(args.projectId, updates);
  },
});

/**
 * Saves all AI-generated content in a single atomic operation
 *
 * Called by: Inngest save-to-convex step after all parallel AI jobs complete
 *
 * Atomic Batch Update Pattern:
 * - Receives results from 6 parallel AI generation steps
 * - Writes all fields in one mutation for data consistency
 * - UI subscribers receive one update with all new data at once
 *
 * Design Decision: Single mutation vs. multiple mutations
 * - Pro: Atomic - all content appears together, no partial states
 * - Pro: One database transaction = faster and more consistent
 * - Con: Slightly delays UI updates until all jobs finish
 * - Trade-off: Consistency over incremental updates (better UX for this use case)
 */
export const saveGeneratedContent = mutation({
  args: {
    projectId: v.id("projects"),
    keyMoments: v.optional(
      v.array(
        v.object({
          time: v.string(),
          timestamp: v.number(),
          text: v.string(),
          description: v.string(),
        }),
      ),
    ),
    summary: v.optional(
      v.object({
        full: v.string(),
        bullets: v.array(v.string()),
        insights: v.array(v.string()),
        tldr: v.string(),
      }),
    ),
    socialPosts: v.optional(
      v.object({
        twitter: v.string(),
        linkedin: v.string(),
        instagram: v.string(),
        tiktok: v.string(),
        youtube: v.string(),
        facebook: v.string(),
      }),
    ),
    titles: v.optional(
      v.object({
        youtubeShort: v.array(v.string()),
        youtubeLong: v.array(v.string()),
        podcastTitles: v.array(v.string()),
        seoKeywords: v.array(v.string()),
      }),
    ),
    youtubeTimestamps: v.optional(
      v.array(
        v.object({
          timestamp: v.string(),
          description: v.string(),
        }),
      ),
    ),
    powerPoint: v.optional(
      v.object({
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("completed"),
          v.literal("failed"),
        ),
        template: v.optional(v.string()),
        summary: v.optional(v.string()),
        slides: v.optional(
          v.array(
            v.object({
              title: v.string(),
              bullets: v.array(v.string()),
              notes: v.optional(v.string()),
              visualHint: v.optional(v.string()),
              layout: v.optional(
                v.union(
                  v.literal("title"),
                  v.literal("bullets"),
                  v.literal("quote"),
                  v.literal("two-column"),
                ),
              ),
            }),
          ),
        ),
        downloadUrl: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
    engagement: v.optional(
      v.object({
        commentStarters: v.array(
          v.object({
            question: v.string(),
            answer: v.string(),
          }),
        ),
        pinComment: v.string(),
        communityPosts: v.array(v.string()),
        descriptions: v.object({
          short: v.string(),
          medium: v.string(),
          long: v.string(),
        }),
      }),
    ),
    // Legacy field - kept for backward compatibility, will be ignored
    hashtags: v.optional(
      v.object({
        instagram: v.array(v.string()),
        linkedin: v.array(v.string()),
        tiktok: v.array(v.string()),
        twitter: v.array(v.string()),
        youtube: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { projectId, ...content } = args;

    // Spread all optional content fields (summary, keyMoments, socialPosts, powerPoint, hashtags, etc.)
    // Only provided fields are updated, others remain unchanged
    await ctx.db.patch(projectId, {
      ...content,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Records an error when processing fails
 *
 * Called by: Inngest step functions on exception
 *
 * Error Handling Strategy:
 * - Set project status to "failed" to stop further processing
 * - Store error details for debugging and user support
 * - Preserve all successfully completed data (partial results still viewable)
 *
 * Design Decision: Don't delete project on failure - allow user to retry or view partial results
 */
export const recordError = mutation({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
    step: v.string(),
    details: v.optional(
      v.object({
        statusCode: v.optional(v.number()),
        stack: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Mark project as failed and store error details
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
 *
 * Called by: Inngest workflow when generation steps fail
 * Allows UI to show which specific jobs failed and enable retry
 */
export const saveJobErrors = mutation({
  args: {
    projectId: v.id("projects"),
      jobErrors: v.object({
        keyMoments: v.optional(v.string()),
        summary: v.optional(v.string()),
        socialPosts: v.optional(v.string()),
        titles: v.optional(v.string()),
        powerPoint: v.optional(v.string()),
        youtubeTimestamps: v.optional(v.string()),
        engagement: v.optional(v.string()),
      }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      jobErrors: args.jobErrors,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Retrieves a single project by ID
 *
 * Used by: Project detail page (real-time subscription)
 *
 * Real-time Pattern:
 * - React component: const project = useQuery(api.projects.getProject, { projectId })
 * - Convex automatically re-runs this query when the project updates
 * - Component re-renders with fresh data
 * - No manual refetching or cache invalidation needed
 */
export const getProject = query({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      return null;
    }

    // Check if user is app owner - owners have access to ALL projects for moderation
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const isAppOwner = userSettings?.role === "owner";
    
    if (isAppOwner) {
      // Owner has access to all projects for moderation
      // Mark as shared if not their own project
      const isOwnProject = project.userId === args.userId;
      return { ...project, isOwner: isOwnProject, isShared: !isOwnProject };
    }

    // Check if user owns the project
    if (project.userId === args.userId) {
      return { ...project, isOwner: true, isShared: false };
    }

    // Check if user has access via sharing groups
    // User can see project if they're a member of a group where the project owner is the group owner
    const userMemberGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get the groups the user is a member of
    const groupIds = userMemberGroups.map((m) => m.groupId);
    
    // Check if any of these groups are owned by the project owner
    for (const groupId of groupIds) {
      const group = await ctx.db.get(groupId);
      if (group && group.ownerId === project.userId) {
        // User has access via sharing group
        return { ...project, isOwner: false, isShared: true };
      }
    }

    // User doesn't have access
    return null;
  },
});

/**
 * Lists all projects for a user with pagination
 *
 * Used by: Projects dashboard page
 *
 * Pagination Pattern:
 * - Returns { page: [...], continueCursor: "..." } for infinite scroll
 * - Uses index "by_user" for efficient filtering
 * - Sorted by newest first (order("desc"))
 *
 * Real-time Behavior:
 * - As new projects are created, they automatically appear in the list
 * - As projects complete, their status updates instantly
 * - No polling required - Convex handles reactivity
 */
export const listUserProjects = query({
  args: {
    userId: v.string(),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 20;

    // Use index for fast filtering by userId
    // order("desc") sorts by _creationTime descending (newest first)
    // Filter out soft-deleted projects
    const query = ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc");

    // Built-in pagination with cursor support
    return await query.paginate({
      numItems,
      cursor: args.paginationOpts?.cursor ?? null,
    });
  },
});

/**
 * Lists all projects for a user including shared files from groups
 *
 * Used by: Projects dashboard page with "All Files" filter
 *
 * Includes:
 * - User's own projects
 * - Projects from groups where user is an active member (owner's files)
 *
 * @param userId - User ID
 * @param filter - Filter type: "own" | "shared" | "all"
 * @param paginationOpts - Pagination options
 */
export const listUserProjectsWithShared = query({
  args: {
    userId: v.string(),
    filter: v.optional(v.union(v.literal("own"), v.literal("shared"), v.literal("all"))),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`[listUserProjectsWithShared] QUERY STARTED - userId=${args.userId}, filter=${args.filter}, paginationOpts=`, args.paginationOpts);
      const numItems = args.paginationOpts?.numItems ?? 20;
      const filter = args.filter ?? "all";
      const cursor = args.paginationOpts?.cursor;
      const startIndex = cursor ? parseInt(cursor, 10) : 0;
      
      // Debug logging
      console.log(`[listUserProjectsWithShared] Called with: filter=${filter}, numItems=${numItems}, cursor=${cursor}, startIndex=${startIndex}`);

      // Check if user is owner - owners can see ALL projects from ALL users for moderation (but only in "all" filter)
      const userSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      const isOwner = userSettings?.role === "owner";
      
      console.log(`[listUserProjectsWithShared] User ${args.userId}: userSettings exists=${!!userSettings}, role=${userSettings?.role}, isOwner=${isOwner}, filter=${filter}`);

      // For "own" filter, always return only user's own projects (even for owner)
      if (filter === "own") {
        const ownProjects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        // Sort by newest first
        ownProjects.sort((a, b) => b.createdAt - a.createdAt);

        // Manual pagination
        const endIndex = startIndex + numItems;
        const paginatedProjects = ownProjects.slice(startIndex, endIndex);
        const hasMore = endIndex < ownProjects.length;

        return {
          page: paginatedProjects,
          continueCursor: hasMore ? endIndex.toString() : null,
          isDone: !hasMore,
        };
      }

      // For owner with "all" filter, return ALL projects from ALL users for moderation
      if (isOwner && filter === "all") {
        console.log(`[listUserProjectsWithShared] User ${args.userId} is OWNER - returning ALL projects from ALL users for moderation`);
        
        // Owner sees ALL projects from ALL users (for moderation)
        // Use pagination to avoid byte limits when there are many projects
        // If no cursor, start from beginning; otherwise use cursor as index
        const paginationCursor = cursor ? parseInt(cursor, 10) : 0;
        const paginationStart = paginationCursor;
        const paginationEnd = paginationStart + numItems;
        
        // Use Convex's built-in pagination to avoid loading all projects at once
        const paginatedResult = await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .order("desc")
          .paginate({
            numItems: numItems,
            cursor: paginationStart > 0 ? paginationStart.toString() : null,
          });
        
        // Sort by createdAt (newest first) as secondary sort
        paginatedResult.page.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log(`[listUserProjectsWithShared] Owner view: Returning ${paginatedResult.page.length} projects (hasMore=${!paginatedResult.isDone})`);
        if (paginatedResult.page.length > 0) {
          const userIds = [...new Set(paginatedResult.page.map(p => p.userId))];
          console.log(`[listUserProjectsWithShared] Owner view: Projects from ${userIds.length} different users in this page`);
        }

        return {
          page: paginatedResult.page,
          continueCursor: paginatedResult.continueCursor,
          isDone: paginatedResult.isDone,
        };
      }
      
      // Log if owner but wrong filter
      if (isOwner && filter !== "all") {
        console.log(`[listUserProjectsWithShared] User ${args.userId} is OWNER but filter is "${filter}" (not "all"), using normal logic`);
      }

      // For "shared" or "all" filters, we need to fetch shared projects
      // Get user's own projects (only if filter is "all")
      let ownProjects: Doc<"projects">[] = [];
      if (filter === "all") {
        const allOwnProjects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        // Sort by newest first - include ALL own projects for proper reactivity
        ownProjects = allOwnProjects.sort((a, b) => b.createdAt - a.createdAt);
      }

      // Get groups where user is an active member
      // CRITICAL: Query groupMembers with order() to ensure Convex tracks this query for reactivity
      // When groupMembers are deleted (group deletion), this query will return empty array
      let memberGroups: Doc<"groupMembers">[] = [];
      try {
        memberGroups = await ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .order("desc") // CRITICAL: Ensures Convex tracks this query for reactivity
          .collect();
      } catch (err) {
        console.error("[listUserProjectsWithShared] Error querying groupMembers:", err);
        memberGroups = [];
      }

      // CRITICAL: Verify each group still exists - use ctx.db.get() for each group
      // This ensures Convex tracks each group individually for reactivity
      // When a group is deleted, ctx.db.get() returns null
      const groupIds = memberGroups.map((m) => m.groupId);
      const validGroups: Doc<"sharingGroups">[] = [];
      
      // Query each group individually - Convex tracks each ctx.db.get() call
      for (const groupId of groupIds) {
        const group = await ctx.db.get(groupId);
        if (group) {
          validGroups.push(group);
        } else {
          console.log(`[listUserProjectsWithShared] Group ${groupId} was deleted`);
        }
      }

      // Get owner IDs from valid groups
      const ownerIds = validGroups.map((g) => g.ownerId);

      // Remove duplicate owner IDs
      const uniqueOwnerIds = [...new Set(ownerIds)];
      
      console.log(`[listUserProjectsWithShared] User ${args.userId}: ${memberGroups.length} memberGroups, ${validGroups.length} valid groups, ${uniqueOwnerIds.length} unique owners`);

      // Get shared projects - query each owner's projects using indexed queries
      // CRITICAL: Each indexed query with order() is tracked by Convex for reactivity
      // When user1 creates a new project, Convex will detect it via the by_user index
      // IMPORTANT: Only projects where project.userId === group.ownerId are shared.
      // This means users (including app owners) can only share their own files,
      // not files belonging to other users. App owners can view all files for
      // moderation, but can only share files they own.
      let sharedProjects: Doc<"projects">[] = [];
      if (uniqueOwnerIds.length > 0) {
        // Use Promise.all - Convex tracks each individual indexed query
        // Each query with withIndex("by_user") is tracked separately
        // Query each owner's projects using indexed queries
        // NOTE: We use .collect() here instead of .paginate() because Convex only allows
        // a single paginated query per function. .collect() should return all results,
        // but if there's a limit, we'll need to handle it differently.
        const sharedProjectArrays = await Promise.all(
          uniqueOwnerIds.map(async (ownerId) => {
            try {
              // CRITICAL: Indexed query with order() - Convex tracks this for reactivity
              // When ownerId creates a new project, Convex will detect it via the by_user index
              // This query only returns projects owned by ownerId (project.userId === ownerId)
              // App owners cannot share other people's files - only their own files are shared
              const projects = await ctx.db
                .query("projects")
                .withIndex("by_user", (q) => q.eq("userId", ownerId))
                .filter((q) => q.eq(q.field("deletedAt"), undefined))
                .order("desc") // CRITICAL: Ensures Convex tracks this query
                .collect();
              
              // Log the count for debugging
              console.log(`[listUserProjectsWithShared] Found ${projects.length} projects for owner ${ownerId}`);
              
              // Sort by createdAt (newest first) as secondary sort
              return projects.sort((a, b) => b.createdAt - a.createdAt);
            } catch (err) {
              console.error(`[listUserProjectsWithShared] Error querying projects for owner ${ownerId}:`, err);
              return [];
            }
          })
        );
        
        sharedProjects = sharedProjectArrays.flat();
        // Sort all shared projects by createdAt (newest first)
        sharedProjects.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log(`[listUserProjectsWithShared] Total shared projects: ${sharedProjects.length} from ${uniqueOwnerIds.length} owners`);
        console.log(`[listUserProjectsWithShared] Shared projects breakdown: ${sharedProjectArrays.map((arr, idx) => `${uniqueOwnerIds[idx]}: ${arr.length}`).join(', ')}`);
        if (sharedProjects.length > 0) {
          console.log(`[listUserProjectsWithShared] Newest shared project: ${new Date(sharedProjects[0].createdAt).toISOString()}`);
          console.log(`[listUserProjectsWithShared] Oldest shared project: ${new Date(sharedProjects[sharedProjects.length - 1].createdAt).toISOString()}`);
        }
      }

      // Combine and filter based on filter type
      let allProjects: Doc<"projects">[] = [];
      if (filter === "shared") {
        allProjects = sharedProjects;
      } else {
        // "all" - combine own and shared, remove duplicates
        const projectIds = new Set<string>();
        allProjects = [...ownProjects, ...sharedProjects].filter((p) => {
          if (projectIds.has(p._id)) {
            return false;
          }
          projectIds.add(p._id);
          return true;
        });
      }

      // Sort by newest first (createdAt is the source of truth for ordering)
      allProjects.sort((a, b) => b.createdAt - a.createdAt);

      // Log the first few projects for debugging
      if (allProjects.length > 0) {
        const newest = allProjects[0];
        const oldest = allProjects[allProjects.length - 1];
        console.log(`[listUserProjectsWithShared] Total projects BEFORE pagination: ${allProjects.length}, newest: ${new Date(newest.createdAt).toISOString()}, oldest: ${new Date(oldest.createdAt).toISOString()}`);
      }

      // Manual pagination - but if cursor is undefined/null/empty and numItems is large, return all projects
      // This ensures we show all shared projects without pagination limits
      let paginatedProjects: Doc<"projects">[];
      let hasMore: boolean;
      
      // Check if we should return all projects (no cursor and large page size)
      const shouldReturnAll = (!cursor || cursor === null || cursor === undefined || cursor === "") && numItems >= 200;
      
      if (shouldReturnAll) {
        // Return ALL projects if no cursor and requesting large page size
        paginatedProjects = allProjects;
        hasMore = false;
        console.log(`[listUserProjectsWithShared] Returning ALL ${allProjects.length} projects (no pagination limit) - cursor=${cursor}, numItems=${numItems}`);
      } else {
        // Normal pagination
        const endIndex = startIndex + numItems;
        paginatedProjects = allProjects.slice(startIndex, endIndex);
        hasMore = endIndex < allProjects.length;
        console.log(`[listUserProjectsWithShared] Pagination: startIndex=${startIndex}, endIndex=${endIndex}, returning ${paginatedProjects.length} projects, hasMore=${hasMore}, total=${allProjects.length}`);
      }

      return {
        page: paginatedProjects,
        continueCursor: hasMore ? (startIndex + numItems).toString() : null,
        isDone: !hasMore,
      };
    } catch (error) {
      console.error("[listUserProjectsWithShared] FATAL ERROR:", error);
      console.error("[listUserProjectsWithShared] Error stack:", error instanceof Error ? error.stack : "No stack trace");
      // Return empty result on error instead of throwing
      return {
        page: [],
        continueCursor: null,
        isDone: true,
      };
    }
  },
});

/**
 * Diagnostic query to check user role and project access
 * 
 * Used for debugging owner access issues
 * Uses a single paginated query to sample data
 */
export const diagnoseUserAccess = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    // Get own projects count (should be small)
    const ownProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    
    // Sample first 500 projects to get user IDs (single paginated query)
    const sampleResult = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .paginate({ numItems: 500, cursor: null });
    
    const uniqueUserIds = new Set<string>();
    sampleResult.page.forEach(p => uniqueUserIds.add(p.userId));
    
    return {
      userSettingsExists: !!userSettings,
      role: userSettings?.role || "not set",
      isOwner: userSettings?.role === "owner",
      totalProjectsSampled: sampleResult.page.length,
      hasMoreProjects: !sampleResult.isDone,
      ownProjectsCount: ownProjects.length,
      uniqueUserIdsInSample: uniqueUserIds.size,
      userIds: Array.from(uniqueUserIds).slice(0, 20), // Limit to first 20 for display
      note: !sampleResult.isDone ? "Total count is estimated from first 500 projects. More projects exist." : "All projects sampled.",
    };
  },
});

/**
 * Gets project count for a user (for quota enforcement)
 *
 * Called by: Upload validation before allowing new project creation
 *
 * Counting Logic:
 * - includeDeleted = true: Count ALL projects ever created (for FREE tier)
 * - includeDeleted = false: Count only active projects (for PRO tier)
 *
 * This allows FREE users to be limited to 3 total projects ever (can't game the system),
 * while PRO users can delete to free up slots.
 */
export const getUserProjectCount = query({
  args: {
    userId: v.string(),
    includeDeleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Query all projects by this user
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter based on includeDeleted flag
    if (args.includeDeleted) {
      // Count all projects (including soft-deleted ones)
      return projects.length;
    } else {
      // Count only active projects (exclude soft-deleted)
      return projects.filter((p) => !p.deletedAt).length;
    }
  },
});

/**
 * Soft-deletes a project after validating user ownership
 *
 * Called by: Server action after user confirms deletion
 *
 * Soft Delete Pattern:
 * - Sets deletedAt timestamp instead of hard delete
 * - Allows FREE tier counting to include deleted projects
 * - PRO users don't see deleted projects in their count
 * - Returns inputUrl so server action can clean up Vercel Blob
 *
 * Security:
 * - Validates that the requesting user owns the project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[CONVEX DELETE] Starting deletion for project ${args.projectId} by user ${args.userId}`);
    
    // Fetch project to validate ownership and get inputUrl
    const project = await ctx.db.get(args.projectId);

    if (!project) {
      console.error(`[CONVEX DELETE] Project ${args.projectId} not found`);
      throw new Error("Project not found");
    }

    // Security check: ensure user owns this project OR is an admin/owner
    // IMPORTANT: App owners can delete any project for moderation/compliance purposes
    // However, owners can only EDIT their own projects (see updateProjectDisplayName and updateProjectCategory)
    if (project.userId !== args.userId) {
      // Check if user is admin or owner
      const userSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (userSettings?.role !== "admin" && userSettings?.role !== "owner") {
        console.error(`[CONVEX DELETE] Unauthorized: User ${args.userId} does not own project ${args.projectId} (owned by ${project.userId}) and is not an admin/owner`);
        throw new Error("Unauthorized: You don't own this project");
      }
      const roleLabel = userSettings?.role === "owner" ? "Owner" : "Admin";
      console.log(`[CONVEX DELETE] ${roleLabel} ${args.userId} deleting project ${args.projectId} owned by ${project.userId} (moderation/compliance)`);
    }

    // Soft delete: set deletedAt timestamp instead of hard delete
    // This preserves the record for FREE tier counting
    const deletedAt = Date.now();
    await ctx.db.patch(args.projectId, {
      deletedAt,
      updatedAt: deletedAt,
    });

    console.log(`[CONVEX DELETE] Successfully soft-deleted project ${args.projectId} at ${deletedAt}`);

    // Return inputUrl so server action can delete from Blob storage
    return { inputUrl: project.inputUrl };
  },
});

/**
 * Updates the display name of a project
 *
 * Called by: Server action when user edits project title
 *
 * Security:
 * - Validates that the requesting user owns the project
 *
 * Real-time Impact:
 * - All UI components displaying this project instantly update
 */
export const updateProjectDisplayName = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch project to validate ownership
    const project = await ctx.db.get(args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    // Security check: ensure user owns this project
    if (project.userId !== args.userId) {
      throw new Error("Unauthorized: You don't own this project");
    }

    // Update display name
    await ctx.db.patch(args.projectId, {
      displayName: args.displayName.trim(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates the category of a project (for drag-and-drop)
 *
 * Called by: Server action when user drags project to different category
 *
 * Security:
 * - Validates that the requesting user owns the project
 *
 * Real-time Impact:
 * - All UI components displaying this project instantly update
 * - Project moves to new category in real-time
 */
export const updateProjectCategory = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    categoryId: v.optional(v.id("categories")),
    subcategoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    // Fetch project to validate ownership
    const project = await ctx.db.get(args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    // Security check: ensure user owns this project
    // IMPORTANT: Even app owners can only edit their own projects, not other users' projects
    // App owners can view all files for moderation, but cannot edit or delete files belonging to others
    if (project.userId !== args.userId) {
      // Check if user is app owner to show specific error message
      const userSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      
      if (userSettings?.role === "owner") {
        throw new Error("Cannot edit another user's project");
      }
      
      throw new Error("Unauthorized: You don't own this project");
    }

    // Validate category exists if provided
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category) {
        throw new Error("Category not found");
      }
    }

    // Validate subcategory exists if provided
    if (args.subcategoryId) {
      const subcategory = await ctx.db.get(args.subcategoryId);
      if (!subcategory) {
        throw new Error("Subcategory not found");
      }
      // Ensure subcategory belongs to the main category if both are provided
      if (args.categoryId && subcategory.parentId !== args.categoryId) {
        throw new Error("Subcategory does not belong to the selected category");
      }
    }

    // Update category
    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.categoryId !== undefined) {
      updateData.categoryId = args.categoryId;
    } else {
      // Explicitly set to undefined to clear the category
      updateData.categoryId = undefined;
    }

    if (args.subcategoryId !== undefined) {
      updateData.subcategoryId = args.subcategoryId;
    } else {
      // Explicitly set to undefined to clear the subcategory
      updateData.subcategoryId = undefined;
    }

    await ctx.db.patch(args.projectId, updateData);

    // Verify the update worked
    const updatedProject = await ctx.db.get(args.projectId);
    if (!updatedProject) {
      throw new Error("Failed to verify project update");
    }

    return {
      success: true,
      categoryId: updatedProject.categoryId,
      subcategoryId: updatedProject.subcategoryId,
    };
  },
});

/**
 * Lists projects for a user filtered by category/subcategory
 *
 * Used by: Category filtered projects page
 *
 * @param userId - User ID to filter projects
 * @param categoryId - Main category ID (optional - if provided, filters by main category)
 * @param subcategoryId - Subcategory ID (optional - if provided, filters by subcategory)
 * @param paginationOpts - Pagination options
 * @returns Paginated list of projects matching the category filter
 */
export const listUserProjectsByCategory = query({
  args: {
    userId: v.string(),
    categoryId: v.optional(v.id("categories")),
    subcategoryId: v.optional(v.id("categories")),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 20;

    // Check if user is owner - owners can see ALL projects from ALL users for moderation
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const isOwner = userSettings?.role === "owner";
    
    let projects;
    
    if (isOwner) {
      // Owner sees ALL projects in this category from ALL users (for moderation)
      if (args.categoryId) {
        projects = await ctx.db
          .query("projects")
          .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .order("desc")
          .collect();
        
        // Filter by subcategory if provided
        if (args.subcategoryId) {
          projects = projects.filter((p) => p.subcategoryId === args.subcategoryId);
        }
      } else {
        // No category filter - get all projects
        projects = await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .order("desc")
          .collect();
        
        // Filter by subcategory if provided
        if (args.subcategoryId) {
          projects = projects.filter((p) => p.subcategoryId === args.subcategoryId);
        }
      }
      
      // Sort by newest first
      projects.sort((a, b) => b.createdAt - a.createdAt);
      
      // Manual pagination
      const cursor = args.paginationOpts?.cursor;
      const startIndex = cursor ? parseInt(cursor, 10) : 0;
      const endIndex = startIndex + numItems;
      const paginatedProjects = projects.slice(startIndex, endIndex);
      const hasMore = endIndex < projects.length;
      
      console.log(`[listUserProjectsByCategory] Owner view: Total ${projects.length} projects, returning ${paginatedProjects.length}`);
      
      return {
        page: paginatedProjects,
        continueCursor: hasMore ? endIndex.toString() : null,
        isDone: !hasMore,
      };
    }

    // Use the by_user_and_category index if categoryId is provided for better reactivity
    if (args.categoryId) {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_user_and_category", (q) =>
          q.eq("userId", args.userId).eq("categoryId", args.categoryId)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      // Filter by subcategory if provided (most specific)
      if (args.subcategoryId) {
        projects = projects.filter((p) => p.subcategoryId === args.subcategoryId);
      }
    } else {
      // No category filter - use by_user index
      projects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      // Filter by subcategory if provided
      if (args.subcategoryId) {
        projects = projects.filter((p) => p.subcategoryId === args.subcategoryId);
      }
    }

    // Sort by newest first
    projects.sort((a, b) => b.createdAt - a.createdAt);

    // Manual pagination (since we might be filtering subcategories in memory)
    const cursor = args.paginationOpts?.cursor;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + numItems;
    const paginatedProjects = projects.slice(startIndex, endIndex);
    const hasMore = endIndex < projects.length;

    return {
      page: paginatedProjects,
      continueCursor: hasMore ? endIndex.toString() : null,
      isDone: !hasMore,
    };
  },
});

/**
 * Gets ALL projects for a user (for search functionality)
 *
 * Used by: Projects list page when searching across all projects
 * Returns all projects without pagination for client-side filtering
 *
 * NOTE: This only returns user's own projects. For shared projects, use getAllUserProjectsWithShared
 */
export const getAllUserProjects = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is owner - owners can see ALL projects from ALL users for moderation
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const isOwner = userSettings?.role === "owner";
    
    if (isOwner) {
      // Owner sees ALL projects from ALL users (for moderation)
      const allProjects = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .order("desc")
        .collect();
      
      console.log(`[getAllUserProjects] Owner view: Returning ALL ${allProjects.length} projects from ALL users`);
      return allProjects;
    }
    
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();
  },
});

/**
 * Gets ALL projects for a user including shared projects (for search functionality)
 *
 * Used by: Projects list page when searching across all projects with filter support
 * Returns all projects without pagination for client-side filtering
 *
 * @param userId - User ID
 * @param filter - Filter type: "own" | "shared" | "all" (default: "all")
 */
export const getAllUserProjectsWithShared = query({
  args: {
    userId: v.string(),
    filter: v.optional(v.union(v.literal("own"), v.literal("shared"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    try {
      const filter = args.filter ?? "all";

      // Check if user is owner - owners can see ALL projects from ALL users for moderation (only in "all" filter)
      const userSettings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      const isOwner = userSettings?.role === "owner";
      
      // For owner with "all" filter, return ALL projects from ALL users for moderation
      if (isOwner && filter === "all") {
        // Owner sees ALL projects from ALL users (for moderation)
        const allProjects = await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .order("desc")
          .collect();
        
        // Sort by newest first
        allProjects.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log(`[getAllUserProjectsWithShared] Owner view: Returning ALL ${allProjects.length} projects from ALL users`);
        return allProjects;
      }

      // Get user's own projects
      const ownProjects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      // Get groups where user is an active member
      // CRITICAL: Query groupMembers with order() to ensure Convex tracks this query for reactivity
      let memberGroups: Doc<"groupMembers">[] = [];
      try {
        memberGroups = await ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .order("desc") // CRITICAL: Ensures Convex tracks this query for reactivity
          .collect();
      } catch (err) {
        console.error("[getAllUserProjectsWithShared] Error querying groupMembers:", err);
        memberGroups = [];
      }

      // Get group owner IDs - CRITICAL: Always check if groups still exist
      const groupIds = memberGroups.map((m) => m.groupId);
      const groups = await Promise.all(
        groupIds.map(async (id) => {
          try {
            const group = await ctx.db.get(id);
            if (!group) {
              console.log(`[getAllUserProjectsWithShared] Group ${id} was deleted, skipping`);
              return null;
            }
            return group;
          } catch (err) {
            console.error(`[getAllUserProjectsWithShared] Error getting group ${id}:`, err);
            return null;
          }
        }),
      );

      const ownerIds = groups
        .filter((g): g is Doc<"sharingGroups"> => g !== null)
        .map((g) => g.ownerId);

      // Remove duplicate owner IDs
      const uniqueOwnerIds = [...new Set(ownerIds)];

      // Get shared projects - query each owner's projects individually with indexed queries
      // CRITICAL: Each indexed query with order() is properly tracked by Convex
      let flattenedShared: Doc<"projects">[] = [];
      if (uniqueOwnerIds.length > 0) {
        try {
          // Query each owner's projects individually using the by_user index
          const sharedProjectArrays = await Promise.all(
            uniqueOwnerIds.map(async (ownerId) => {
              try {
                // Use indexed query with order() - this is CRITICAL for reactivity
                const projects = await ctx.db
                  .query("projects")
                  .withIndex("by_user", (q) => q.eq("userId", ownerId))
                  .filter((q) => q.eq(q.field("deletedAt"), undefined))
                  .order("desc") // CRITICAL: Ensures Convex tracks this indexed query for reactivity
                  .collect();
                
                // Sort by createdAt (newest first) as secondary sort
                return projects.sort((a, b) => b.createdAt - a.createdAt);
              } catch (err) {
                console.error(`[getAllUserProjectsWithShared] Error querying projects for owner ${ownerId}:`, err);
                return [];
              }
            })
          );
          
          flattenedShared = sharedProjectArrays.flat();
        } catch (err) {
          console.error("[getAllUserProjectsWithShared] Error getting shared projects:", err);
          flattenedShared = [];
        }
      }

      // Combine and filter based on filter type
      let allProjects: typeof ownProjects = [];
      if (filter === "own") {
        allProjects = ownProjects;
      } else if (filter === "shared") {
        allProjects = flattenedShared;
      } else {
        // "all" - combine own and shared, remove duplicates
        const projectIds = new Set<string>();
        allProjects = [...ownProjects, ...flattenedShared].filter((p) => {
          if (projectIds.has(p._id)) {
            return false;
          }
          projectIds.add(p._id);
          return true;
        });
      }

      // Sort by newest first
      allProjects.sort((a, b) => b.createdAt - a.createdAt);

      return allProjects;
    } catch (error) {
      console.error("[getAllUserProjectsWithShared] Error:", error);
      return [];
    }
  },
});

/**
 * Admin query: Get ALL projects (for migration purposes)
 * 
 * WARNING: This returns all projects without user filtering.
 * Only use for admin/migration tasks.
 */
export const getAllProjectsForMigration = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

/**
 * Bulk insert projects with duplicate fileName checking
 * 
 * Used for: Migrating projects from dev to prod
 * 
 * Checks for existing projects by fileName before inserting.
 * Only inserts projects that don't already exist.
 */
export const bulkInsertProjects = mutation({
  args: {
    projects: v.array(
      v.object({
        userId: v.string(),
        inputUrl: v.string(),
        fileName: v.string(),
        displayName: v.optional(v.string()),
        fileSize: v.number(),
        fileDuration: v.optional(v.number()),
        fileFormat: v.string(),
        mimeType: v.string(),
        categoryId: v.optional(v.id("categories")),
        subcategoryId: v.optional(v.id("categories")),
        status: v.union(
          v.literal("uploaded"),
          v.literal("processing"),
          v.literal("completed"),
          v.literal("failed"),
        ),
        jobStatus: v.optional(
          v.object({
            transcription: v.optional(
              v.union(
                v.literal("pending"),
                v.literal("running"),
                v.literal("completed"),
                v.literal("failed"),
              ),
            ),
            contentGeneration: v.optional(
              v.union(
                v.literal("pending"),
                v.literal("running"),
                v.literal("completed"),
                v.literal("failed"),
              ),
            ),
          }),
        ),
        error: v.optional(
          v.object({
            message: v.string(),
            step: v.string(),
            timestamp: v.number(),
            details: v.optional(
              v.object({
                statusCode: v.optional(v.number()),
                stack: v.optional(v.string()),
              }),
            ),
          }),
        ),
        jobErrors: v.optional(
          v.object({
            keyMoments: v.optional(v.string()),
            summary: v.optional(v.string()),
            socialPosts: v.optional(v.string()),
            titles: v.optional(v.string()),
            powerPoint: v.optional(v.string()),
            youtubeTimestamps: v.optional(v.string()),
            engagement: v.optional(v.string()),
            hashtags: v.optional(v.string()),
          }),
        ),
        transcript: v.optional(v.any()),
        summary: v.optional(v.any()),
        socialPosts: v.optional(v.any()),
        titles: v.optional(v.any()),
        powerPoint: v.optional(v.any()),
        keyMoments: v.optional(v.any()),
        youtubeTimestamps: v.optional(v.any()),
        engagement: v.optional(v.any()),
        hashtags: v.optional(v.any()),
        createdAt: v.number(),
        updatedAt: v.number(),
        completedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Get all existing projects to check for duplicates by fileName
    const existingProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    
    const existingFileNames = new Set(
      existingProjects.map((p) => p.fileName.toLowerCase()),
    );
    
    let inserted = 0;
    let skipped = 0;
    const skippedFileNames: string[] = [];
    
    for (const project of args.projects) {
      // Check if fileName already exists (case-insensitive)
      if (existingFileNames.has(project.fileName.toLowerCase())) {
        skipped++;
        skippedFileNames.push(project.fileName);
        continue;
      }
      
      // Insert the project
      await ctx.db.insert("projects", {
        ...project,
        deletedAt: undefined, // Ensure not deleted
      });
      
      inserted++;
      existingFileNames.add(project.fileName.toLowerCase());
    }
    
    return {
      inserted,
      skipped,
      skippedFileNames,
      total: args.projects.length,
    };
  },
});

/**
 * Diagnostic query to count all projects for a user (including deleted)
 * This helps debug why only 50 projects are showing when there should be 100+
 */
export const countAllProjectsForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Count all projects (including deleted)
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    // Count non-deleted projects
    const nonDeletedProjects = allProjects.filter((p) => !p.deletedAt);
    
    return {
      total: allProjects.length,
      nonDeleted: nonDeletedProjects.length,
      deleted: allProjects.length - nonDeletedProjects.length,
    };
  },
});