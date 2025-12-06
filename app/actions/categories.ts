/**
 * Category Server Actions
 *
 * Server actions for category management, including seeding categories.
 */
"use server";

import { api } from "@/convex/_generated/api";
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

