/**
 * Category Badge Component
 *
 * Displays a category name as a styled badge.
 * Can show full hierarchy (Category → Subcategory) or just category name.
 */

"use client";

import { useQuery } from "convex/react";
import { FolderTree } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  categoryId?: Id<"categories"> | null;
  subcategoryId?: Id<"categories"> | null;
  variant?: "default" | "compact";
  className?: string;
}

export function CategoryBadge({
  categoryId,
  subcategoryId,
  variant = "default",
  className,
}: CategoryBadgeProps) {
  // Fetch category information
  const category = useQuery(
    api.categories.getCategory,
    categoryId ? { categoryId } : "skip",
  );

  const subcategory = useQuery(
    api.categories.getCategory,
    subcategoryId ? { categoryId: subcategoryId } : "skip",
  );

  // Don't render if no category
  if (!categoryId || !category) {
    return null;
  }

  if (variant === "compact") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
          className,
        )}
      >
        <FolderTree className="h-3 w-3 mr-1" />
        {category.name}
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      >
        <FolderTree className="h-3 w-3 mr-1" />
        {category.name}
      </Badge>
      {subcategory && (
        <>
          <span className="text-emerald-600">→</span>
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
          >
            {subcategory.name}
          </Badge>
        </>
      )}
    </div>
  );
}




