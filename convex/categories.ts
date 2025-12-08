/**
 * Category Management - Convex Functions
 *
 * Handles queries and mutations for the hierarchical category system.
 * Categories organize projects by medical specialty (Victoria, BC).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MEDICAL_CATEGORIES } from "./categoryData";

/**
 * Get all top-level categories (main specialties)
 *
 * Used by: Category selector to show main categories
 *
 * @returns Array of top-level categories sorted alphabetically by name
 */
export const getMainCategories = query({
  args: {},
  handler: async (ctx) => {
    // Get all categories and filter for those without a parent (top-level)
    // We can't use index with undefined, so we query all and filter
    const allCategories = await ctx.db.query("categories").collect();

    // Filter for top-level categories (no parentId)
    const mainCategories = allCategories.filter(
      (cat) => !cat.parentId,
    );

    // Sort alphabetically by name (case-insensitive)
    // Compares character by character: A before Z, then second letter, etc.
    return mainCategories.sort((a, b) => {
      const nameA = a.name.toLowerCase().trim();
      const nameB = b.name.toLowerCase().trim();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  },
});

/**
 * Get all subcategories for a given parent category
 *
 * Used by: Category selector to show subcategories when main category is selected
 *
 * @param parentId - ID of the parent category
 * @returns Array of subcategories sorted alphabetically by name
 */
export const getSubcategories = query({
  args: {
    parentId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const subcategories = await ctx.db
      .query("categories")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    // Sort alphabetically by name (case-insensitive)
    // Compares character by character: A before Z, then second letter, etc.
    return subcategories.sort((a, b) => {
      const nameA = a.name.toLowerCase().trim();
      const nameB = b.name.toLowerCase().trim();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  },
});

/**
 * Get a single category by ID
 *
 * Used by: Displaying category name in project cards
 *
 * @param categoryId - Category ID
 * @returns Category document or null
 */
export const getCategory = query({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

/**
 * Get category with its parent (for displaying full hierarchy)
 *
 * Used by: Showing full category path (e.g., "Cardiology → Heart disease management")
 *
 * @param categoryId - Category ID (can be subcategory)
 * @returns Category with parent information
 */
export const getCategoryWithParent = query({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) return null;

    let parent = null;
    if (category.parentId) {
      parent = await ctx.db.get(category.parentId);
    }

    return {
      ...category,
      parent,
    };
  },
});

/**
 * Get all categories (for admin/seeding purposes)
 *
 * Used by: Category management or seeding
 *
 * @returns All categories in the database
 */
export const getAllCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

/**
 * Create a category (for seeding or Ultra plan users)
 *
 * Used by: Seed script to populate initial categories, or Ultra plan users to create custom categories
 *
 * @param name - Category name
 * @param slug - URL-friendly slug
 * @param parentId - Optional parent category ID
 * @param order - Display order
 * @param description - Optional description
 * @returns Created category ID
 */
export const createCategory = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("categories")),
    order: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const categoryId = await ctx.db.insert("categories", {
      name: args.name,
      slug: args.slug,
      parentId: args.parentId,
      order: args.order,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return categoryId;
  },
});

/**
 * Create a new category (Ultra plan users only)
 * 
 * Used by: Ultra plan users to create custom categories
 * 
 * @param userId - User ID (for plan verification)
 * @param name - Category name
 * @param parentId - Optional parent category ID (for subcategories)
 * @param description - Optional description
 * @returns Created category ID
 */
export const createUserCategory = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Note: Plan verification should be done client-side or via server action
    // This mutation assumes the caller has verified Ultra plan access
    
    // Generate slug from name
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    // Check if category with same slug already exists
    const existing = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("slug"), slug))
      .filter((q) => q.eq(q.field("parentId"), args.parentId || undefined))
      .first();

    if (existing) {
      throw new Error(`A category with the name "${args.name}" already exists`);
    }

    // Get max order for categories at this level
    const allCategories = await ctx.db.query("categories").collect();
    const sameLevelCategories = allCategories.filter(
      (cat) => (cat.parentId || null) === (args.parentId || null)
    );
    const maxOrder = sameLevelCategories.length > 0
      ? Math.max(...sameLevelCategories.map((cat) => cat.order))
      : 0;

    const now = Date.now();

    const categoryId = await ctx.db.insert("categories", {
      name: args.name,
      slug: slug,
      parentId: args.parentId,
      order: maxOrder + 1,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return categoryId;
  },
});

/**
 * Seed all categories and subcategories into the database
 *
 * This is a one-time operation. It's safe to run multiple times (idempotent).
 * Existing categories won't be duplicated.
 *
 * Used by: Admin page or CLI to populate initial medical specialty categories
 *
 * @returns Object with counts of created categories and subcategories
 */
export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    let mainCategoryCount = 0;
    let subcategoryCount = 0;

    // Process each main category
    for (let i = 0; i < MEDICAL_CATEGORIES.length; i++) {
      const categoryDef = MEDICAL_CATEGORIES[i];

      // Check if main category already exists by slug
      const existingMain = await ctx.db
        .query("categories")
        .filter((q) => q.eq(q.field("slug"), categoryDef.slug))
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .first();

      let mainCategoryId;

      if (existingMain) {
        // Category already exists, use it
        mainCategoryId = existingMain._id;
      } else {
        // Create main category
        mainCategoryId = await ctx.db.insert("categories", {
          name: categoryDef.name,
          slug: categoryDef.slug,
          parentId: undefined,
          order: i + 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        mainCategoryCount++;
      }

      // Create subcategories if they exist
      if (categoryDef.subcategories && categoryDef.subcategories.length > 0) {
        for (let j = 0; j < categoryDef.subcategories.length; j++) {
          const subcategoryName = categoryDef.subcategories[j];
          const subcategorySlug = `${categoryDef.slug}-${subcategoryName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim()}`;

          // Check if subcategory already exists
          const existingSub = await ctx.db
            .query("categories")
            .filter((q) => q.eq(q.field("slug"), subcategorySlug))
            .filter((q) => q.eq(q.field("parentId"), mainCategoryId))
            .first();

          if (!existingSub) {
            await ctx.db.insert("categories", {
              name: subcategoryName,
              slug: subcategorySlug,
              parentId: mainCategoryId,
              order: j + 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            subcategoryCount++;
          }
        }
      }
    }

    return {
      success: true,
      mainCategoriesCreated: mainCategoryCount,
      subcategoriesCreated: subcategoryCount,
      message: `Seeded ${mainCategoryCount} main categories and ${subcategoryCount} subcategories`,
    };
  },
});

/**
 * Get project count for each category for a user
 *
 * Used by: Categories grid to show count of projects per category
 *
 * @param userId - User ID to count projects for
 * @returns Map of category ID to project count
 */
export const getCategoryProjectCounts = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all projects for this user
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Count projects by category ID
    const counts: Record<string, number> = {};
    
    for (const project of projects) {
      if (project.categoryId) {
        const categoryId = project.categoryId;
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    }

    return counts;
  },
});

