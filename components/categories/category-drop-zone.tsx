/**
 * Category Drop Zone Component
 *
 * Shows categories as drop targets for drag-and-drop functionality.
 * Allows users to drag projects onto categories to change their category.
 */

"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { FolderTree, Move } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProjectCategoryAction } from "@/app/actions/categories";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { cn } from "@/lib/utils";

interface CategoryDropZoneProps {
  onDropComplete?: () => void;
}

export function CategoryDropZone({ onDropComplete }: CategoryDropZoneProps) {
  const { has } = useAuth();
  const [draggedOverCategoryId, setDraggedOverCategoryId] = useState<Id<"categories"> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Check if user has Ultra plan
  const userPlan = getCurrentPlan(has);
  const isUltra = userPlan === "ultra";

  const mainCategories = useQuery(api.categories.getMainCategories);

  // Don't render if user doesn't have Ultra plan
  if (!isUltra) {
    return null;
  }

  const handleDragOver = (e: React.DragEvent, categoryId: Id<"categories">) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverCategoryId(categoryId);
  };

  const handleDragLeave = () => {
    setDraggedOverCategoryId(null);
  };

  const handleDrop = async (e: React.DragEvent, categoryId: Id<"categories">) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverCategoryId(null);
    setIsDragging(false);

    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      const { projectId, currentCategoryId } = JSON.parse(data) as {
        projectId: Id<"projects">;
        currentCategoryId?: Id<"categories">;
        currentSubcategoryId?: Id<"categories">;
      };

      // Don't update if already in this category
      if (currentCategoryId === categoryId) {
        toast.info("Project is already in this category");
        return;
      }

      // Update project category
      const result = await updateProjectCategoryAction({
        projectId,
        categoryId,
        subcategoryId: null, // Clear subcategory when moving to main category
      });

      if (result.success) {
        toast.success("Project moved to category successfully");
        onDropComplete?.();
      } else {
        toast.error(result.error || "Failed to move project");
      }
    } catch (error) {
      console.error("Error handling drop:", error);
      toast.error("Failed to move project to category");
    }
  };

  // Listen for drag events globally - only show drop zones when dragging projects
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      // Only show drop zones if dragging a project (check for our data type)
      if (e.dataTransfer?.types.includes("application/json")) {
        setIsDragging(true);
      }
    };

    const handleGlobalDragEnd = () => {
      setIsDragging(false);
      setDraggedOverCategoryId(null);
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      // Keep drop zones visible while dragging
      if (e.dataTransfer?.types.includes("application/json")) {
        setIsDragging(true);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("dragenter", handleGlobalDragEnter);
      window.addEventListener("dragover", handleGlobalDragOver);
      window.addEventListener("dragend", handleGlobalDragEnd);
      window.addEventListener("drop", handleGlobalDragEnd);
      return () => {
        window.removeEventListener("dragenter", handleGlobalDragEnter);
        window.removeEventListener("dragover", handleGlobalDragOver);
        window.removeEventListener("dragend", handleGlobalDragEnd);
        window.removeEventListener("drop", handleGlobalDragEnd);
      };
    }
  }, []);

  if (!mainCategories || mainCategories.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Move className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-lg">Drag projects to categories</h3>
      </div>
      {isDragging && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {mainCategories.map((category) => (
            <div
              key={category._id}
              onDragOver={(e) => handleDragOver(e, category._id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, category._id)}
              className={cn(
                "p-3 rounded-lg border-2 border-dashed transition-all cursor-pointer",
                draggedOverCategoryId === category._id
                  ? "border-emerald-500 bg-emerald-50 scale-105"
                  : "border-gray-300 hover:border-emerald-300 hover:bg-emerald-50/50",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderTree className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-700 truncate min-w-0">
                  {category.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isDragging && (
        <p className="text-sm text-gray-500">
          Start dragging a project to see category drop zones
        </p>
      )}
    </Card>
  );
}

