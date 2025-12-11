/**
 * Convex Database Schema
 *
 * Defines the structure of all data stored in Convex for the AI Podcast Assistant.
 * Convex provides real-time reactivity, automatic TypeScript types, and ACID transactions.
 *
 * Key Design Decisions:
 * - Single "projects" table stores all podcast processing data
 * - Denormalized structure (all data in one document) for real-time updates and atomic writes
 * - Optional fields allow progressive data population as Inngest jobs complete
 * - jobStatus tracks each generation step independently for granular UI feedback
 * - Indexes optimize common queries (user's projects, filtering by status, sorting by date)
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    // User ownership - links to Clerk user ID
    userId: v.string(),

    // Soft delete timestamp - allows FREE tier to count all projects ever created
    deletedAt: v.optional(v.number()),

    // Input file metadata - stored in Vercel Blob
    inputUrl: v.string(), // Vercel Blob URL (public access)
    fileName: v.string(), // Original filename for display
    displayName: v.optional(v.string()), // User-editable display name (defaults to fileName in UI)
    fileSize: v.number(), // Bytes - used for billing/limits
    fileDuration: v.optional(v.number()), // Seconds - extracted or estimated
    fileFormat: v.string(), // Extension (mp3, mp4, wav, etc.)
    mimeType: v.string(), // MIME type for validation

    // Overall project status - drives UI state machine
    // uploaded -> processing -> completed (or failed)
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),

    // Granular job status tracking - shows progress of individual processing steps
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

    // Error tracking - stores failure details for debugging
    error: v.optional(
      v.object({
        message: v.string(), // User-friendly error message
        step: v.string(), // Which job failed (transcription, summary, etc.)
        timestamp: v.number(), // When the error occurred
        details: v.optional(
          v.object({
            statusCode: v.optional(v.number()), // HTTP status if applicable
            stack: v.optional(v.string()), // Stack trace for debugging
          }),
        ),
      }),
    ),

    // Per-job error tracking - stores errors for individual generation steps
    jobErrors: v.optional(
      v.object({
        keyMoments: v.optional(v.string()),
        summary: v.optional(v.string()),
        socialPosts: v.optional(v.string()),
        titles: v.optional(v.string()),
        hashtags: v.optional(v.string()),
        youtubeTimestamps: v.optional(v.string()),
        engagement: v.optional(v.string()),
      }),
    ),

    // Transcript from AssemblyAI - includes word-level timing and speaker detection
    transcript: v.optional(
      v.object({
        text: v.string(), // Full transcript as plain text
        segments: v.array(
          v.object({
            id: v.number(),
            start: v.number(), // Start time in seconds
            end: v.number(), // End time in seconds
            text: v.string(), // Segment text
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
        // Speaker diarization - who said what and when
        speakers: v.optional(
          v.array(
            v.object({
              speaker: v.string(), // Speaker label (A, B, C, etc.)
              start: v.number(),
              end: v.number(),
              text: v.string(),
              confidence: v.number(), // Detection confidence (0-1)
            }),
          ),
        ),
        // Auto-generated chapters from AssemblyAI
        chapters: v.optional(
          v.array(
            v.object({
              start: v.number(), // Start time in milliseconds
              end: v.number(), // End time in milliseconds
              headline: v.string(), // Chapter title
              summary: v.string(), // Chapter summary
              gist: v.string(), // Short gist
            }),
          ),
        ),
      }),
    ),

    // AI-generated key moments - interesting points for social media clips
    keyMoments: v.optional(
      v.array(
        v.object({
          time: v.string(), // Human-readable time (e.g., "12:34")
          timestamp: v.number(), // Seconds for programmatic use
          text: v.string(), // What was said at this moment
          description: v.string(), // Why this moment is interesting
        }),
      ),
    ),

    // Podcast summary - multi-format for different use cases
    summary: v.optional(
      v.object({
        full: v.string(), // 200-300 word overview
        bullets: v.array(v.string()), // 5-7 key points
        insights: v.array(v.string()), // 3-5 actionable takeaways
        tldr: v.string(), // One sentence hook
      }),
    ),

    // Platform-optimized social media posts
    // Each post is tailored to the platform's best practices and character limits
    socialPosts: v.optional(
      v.object({
        twitter: v.string(), // 280 chars, punchy and engaging
        linkedin: v.string(), // Professional tone, longer form
        instagram: v.string(), // Visual description + engagement hooks
        tiktok: v.string(), // Casual, trend-aware
        youtube: v.string(), // Description with timestamps and CTAs
        facebook: v.string(), // Community-focused, conversation starters
      }),
    ),

    // Title suggestions for various contexts
    titles: v.optional(
      v.object({
        youtubeShort: v.array(v.string()), // Catchy, clickable (60 chars)
        youtubeLong: v.array(v.string()), // Descriptive, SEO-friendly
        podcastTitles: v.array(v.string()), // Episode titles
        seoKeywords: v.array(v.string()), // Keywords for discoverability
      }),
    ),

    // Platform-specific hashtag recommendations
    hashtags: v.optional(
      v.object({
        youtube: v.array(v.string()),
        instagram: v.array(v.string()),
        tiktok: v.array(v.string()),
        linkedin: v.array(v.string()),
        twitter: v.array(v.string()),
      }),
    ),

    // YouTube chapter timestamps - enhances navigation and watch time
    youtubeTimestamps: v.optional(
      v.array(
        v.object({
          timestamp: v.string(), // Format: "12:34"
          description: v.string(), // Chapter title/description
        }),
      ),
    ),

    // Engagement & Growth Tools - helps build community and drive engagement
    engagement: v.optional(
      v.object({
        commentStarters: v.array(
          v.object({
            question: v.string(), // The question/comment to prime engagement
            answer: v.string(), // Thoughtful answer based on podcast content
          }),
        ), // 5-7 anticipated questions with answers to prime engagement
        pinComment: v.string(), // Best comment to pin on YouTube for community building
        communityPosts: v.array(v.string()), // 3 follow-up post ideas to keep audience engaged
        descriptions: v.object({
          short: v.string(), // 150-200 chars for social media previews
          medium: v.string(), // 300-500 chars for podcast feed descriptions
          long: v.string(), // 800-1000 words for blog/show notes
        }),
      }),
    ),

    // Category classification - for organizing projects by medical specialty
    categoryId: v.optional(v.id("categories")), // Main category (e.g., "Cardiology")
    subcategoryId: v.optional(v.id("categories")), // Subcategory (e.g., "Heart disease management")

    // Timestamp metadata
    createdAt: v.number(), // Project creation time
    updatedAt: v.number(), // Last modification time
    completedAt: v.optional(v.number()), // When processing finished
  })
    // Indexes for efficient queries
    .index("by_user", ["userId"]) // List all projects for a user
    .index("by_status", ["status"]) // Filter by processing status
    .index("by_user_and_status", ["userId", "status"]) // User's active/completed projects
    .index("by_created_at", ["createdAt"]) // Sort by newest first
    .index("by_category", ["categoryId"]) // Filter by category
    .index("by_user_and_category", ["userId", "categoryId"]), // User's projects by category

  // User settings - stores user-provided API keys (BYOK - Bring Your Own Key)
  userSettings: defineTable({
    // User ownership - links to Clerk user ID
    userId: v.string(),

    // User-provided API keys (optional - if not provided, uses environment keys)
    // Keys are stored as-is (Convex provides encryption at rest)
    openaiApiKey: v.optional(v.string()), // User's OpenAI API key
    assemblyaiApiKey: v.optional(v.string()), // User's AssemblyAI API key

    // User role - defaults to "user", can be set to "admin" or "owner"
    // Owner role can only be set directly in database, cannot be changed by admins
    role: v.optional(v.union(v.literal("user"), v.literal("admin"), v.literal("owner"))), // User role (defaults to "user")

    // Metadata
    updatedAt: v.number(), // Last modification time
    createdAt: v.number(), // Settings creation time
  })
    .index("by_user", ["userId"]) // Lookup settings by user ID
    .index("by_role", ["role"]), // Find all admins or users by role

  // Categories - hierarchical structure for organizing projects by medical specialty
  categories: defineTable({
    name: v.string(), // Category name (e.g., "Cardiology / Heart / Vascular Medicine")
    slug: v.string(), // URL-friendly identifier (e.g., "cardiology-heart-vascular")
    parentId: v.optional(v.id("categories")), // Parent category ID for subcategories (null for top-level)
    order: v.number(), // Display order for sorting
    description: v.optional(v.string()), // Optional description
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_parent", ["parentId"]) // Find all subcategories of a parent
    .index("by_order", ["order"]) // Sort categories by display order
    .index("by_parent_and_order", ["parentId", "order"]), // Get ordered subcategories for a parent

  // Sharing Groups - allows users to share their files with others
  sharingGroups: defineTable({
    name: v.optional(v.string()), // Optional group name
    ownerId: v.string(), // User who created the group (Clerk userId) - wants to share their files
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"]), // Find all groups owned by a user

  // Group Members - tracks who can see the group owner's files
  groupMembers: defineTable({
    groupId: v.id("sharingGroups"), // Reference to sharing group
    userId: v.string(), // Member's Clerk userId
    status: v.union(v.literal("active"), v.literal("left")), // Member status
    addedAt: v.number(), // When member was added
    addedBy: v.union(v.literal("owner"), v.literal("admin")), // Who added this member
  })
    .index("by_group", ["groupId"]) // Find all members of a group
    .index("by_user", ["userId"]) // Find all groups a user is member of
    .index("by_group_and_user", ["groupId", "userId"]) // Check if user is in group
    .index("by_group_and_status", ["groupId", "status"]), // Find active/left members

  // Group Join Requests - tracks requests to join/rejoin groups
  groupJoinRequests: defineTable({
    groupId: v.id("sharingGroups"), // Group being requested
    requesterId: v.string(), // User requesting to join/rejoin (Clerk userId)
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    requestedAt: v.number(), // When request was made
    respondedAt: v.optional(v.number()), // When owner responded
    initiatedBy: v.optional(v.union(v.literal("user"), v.literal("owner"))), // Who initiated: user (user clicked Request) or owner (owner invited)
  })
    .index("by_group", ["groupId"]) // Find all requests for a group
    .index("by_requester", ["requesterId"]) // Find all requests by a user
    .index("by_group_and_status", ["groupId", "status"]) // Find pending requests
    .index("by_group_and_requester", ["groupId", "requesterId"]), // Check if request exists

  // User Shares - direct user-to-user file sharing (for future use)
  userShares: defineTable({
    requesterId: v.string(), // User requesting share (Clerk userId)
    recipientId: v.string(), // User being asked (Clerk userId)
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    initiatedBy: v.union(v.literal("user"), v.literal("admin")), // Who initiated the share
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_requester", ["requesterId"]) // Find shares requested by user
    .index("by_recipient", ["recipientId"]) // Find shares received by user
    .index("by_status", ["status"]) // Find pending/accepted shares
    .index("by_requester_and_recipient", ["requesterId", "recipientId"]), // Check if share exists
});
