/**
 * Category Server Actions
 *
 * Server actions for category management, including seeding categories.
 */
"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";

/**
 * Seed all categories and subcategories into the database
 *
 * This is a one-time operation. Safe to run multiple times (idempotent).
 * Existing categories won't be duplicated.
 *
 * @returns Object with success status and counts
 */
export async function seedCategoriesAction(): Promise<{
  success: boolean;
  message: string;
  mainCategoriesCreated?: number;
  subcategoriesCreated?: number;
  error?: string;
}> {
  try {
    const result = await convex.mutation(api.categories.seedCategories, {});
    return {
      success: true,
      message: result.message,
      mainCategoriesCreated: result.mainCategoriesCreated,
      subcategoriesCreated: result.subcategoriesCreated,
    };
  } catch (error) {
    console.error("Error seeding categories:", error);
    return {
      success: false,
      message: "Failed to seed categories",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new category (Ultra plan users only)
 *
 * @param name - Category name
 * @param parentId - Optional parent category ID (for subcategories)
 * @param description - Optional description
 * @returns Created category ID or error
 */
export async function createCategoryAction(input: {
  name: string;
  parentId?: Id<"categories">;
  description?: string;
}): Promise<{
  success: boolean;
  categoryId?: Id<"categories">;
  error?: string;
}> {
  try {
    const authObj = await auth();
    const { userId, has } = authObj;

    if (!userId) {
      return { success: false, error: "You must be signed in to create categories" };
    }

    // Check if user has Ultra plan
    if (!has?.({ plan: "ultra" })) {
      return {
        success: false,
        error: "Creating custom categories is only available for Ultra plan users. Please upgrade to create categories.",
      };
    }

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: "Category name cannot be empty" };
    }

    if (input.name.length > 200) {
      return { success: false, error: "Category name is too long (max 200 characters)" };
    }

    // Create category
    const categoryId = await convex.mutation(api.categories.createUserCategory, {
      userId,
      name: input.name.trim(),
      parentId: input.parentId,
      description: input.description?.trim(),
    });

    if (!categoryId) {
      return {
        success: false,
        error: "Category was not created. Please try again.",
      };
    }

    return { success: true, categoryId };
  } catch (error) {
    console.error("Error creating category:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Category creation error details:", {
      name: input.name,
      parentId: input.parentId,
      error: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete a category (owner only)
 *
 * @param categoryId - Category ID to delete
 * @returns Success response
 */
export async function deleteCategoryAction(categoryId: Id<"categories">): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    if (!userId) {
      return { success: false, error: "You must be signed in to delete categories" };
    }

    // Check if user is owner
    const isOwner = await convex.query(api.userSettings.isUserOwner, { userId });
    if (!isOwner) {
      return {
        success: false,
        error: "Only owners can delete categories",
      };
    }

    // Delete category in Convex
    await convex.mutation(api.categories.deleteCategory, {
      categoryId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update project category (for drag-and-drop)
 *
 * @param projectId - Project ID
 * @param categoryId - New category ID (optional, null to remove)
 * @param subcategoryId - New subcategory ID (optional, null to remove)
 * @returns Success response
 */
export async function updateProjectCategoryAction(input: {
  projectId: Id<"projects">;
  categoryId?: Id<"categories"> | null;
  subcategoryId?: Id<"categories"> | null;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authObj = await auth();
    const { userId, has } = authObj;

    if (!userId) {
      return { success: false, error: "You must be signed in to update project categories" };
    }

    // Check if user has Ultra plan (required for drag-and-drop)
    if (!has?.({ plan: "ultra" })) {
      return {
        success: false,
        error: "Drag-and-drop to change categories is only available for Ultra plan users. Please upgrade to use this feature.",
      };
    }

    // Update category in Convex (validates ownership)
    await convex.mutation(api.projects.updateProjectCategory, {
      projectId: input.projectId,
      userId,
      categoryId: input.categoryId || undefined,
      subcategoryId: input.subcategoryId || undefined,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating project category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

