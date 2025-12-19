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
import { useEffect, useState, useRef } from "react";
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
  // Always call hooks unconditionally - never conditionally
  const { has } = useAuth();
  const [draggedOverCategoryId, setDraggedOverCategoryId] = useState<Id<"categories"> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Always call useQuery unconditionally
  const mainCategories = useQuery(api.categories.getMainCategories);

  // Check if user has Ultra plan (after hooks are called)
  const userPlan = getCurrentPlan(has as any);
  const isUltra = userPlan === "ultra";

  // Don't render if user doesn't have Ultra plan
  // But hooks are already called above, so this is safe
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
      // Try to get data from event, fallback to ref if event data is lost
      let dragData = null;
      try {
        const data = e.dataTransfer.getData("application/json");
        if (data) {
          dragData = JSON.parse(data);
        }
      } catch {
        // If event data is lost (e.g., during scroll), use ref
        dragData = dragDataRef.current;
      }

      if (!dragData) {
        console.error("No drag data available");
        return;
      }

      const { projectId, currentCategoryId } = dragData as {
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
      
      // Clear ref after successful drop
      dragDataRef.current = null;
    } catch (error) {
      console.error("Error handling drop:", error);
      toast.error("Failed to move project to category");
      dragDataRef.current = null;
    }
  };

  // Global drop handler as fallback (in case drop doesn't fire on drop zone when scrolled)
  useEffect(() => {
    const handleGlobalDrop = async (e: DragEvent) => {
      // Only handle if we're dragging and the drop didn't happen on a drop zone
      if (!isDragging || !draggedOverCategoryId) return;
      
      // Try to get data from event or ref
      let dragData = null;
      try {
        const data = e.dataTransfer?.getData("application/json");
        if (data) {
          dragData = JSON.parse(data);
        } else {
          dragData = dragDataRef.current;
        }
      } catch {
        dragData = dragDataRef.current;
      }

      if (!dragData) return;

      try {
        const { projectId, currentCategoryId } = dragData as {
          projectId: Id<"projects">;
          currentCategoryId?: Id<"categories">;
        };

        // Only handle if dropping on a different category
        if (draggedOverCategoryId !== currentCategoryId) {
          e.preventDefault();
          e.stopPropagation();
          
          const result = await updateProjectCategoryAction({
            projectId,
            categoryId: draggedOverCategoryId,
            subcategoryId: null,
          });

          if (result.success) {
            toast.success("Project moved to category successfully");
            onDropComplete?.();
          } else {
            toast.error(result.error || "Failed to move project");
          }
          
          setIsDragging(false);
          setDraggedOverCategoryId(null);
          dragDataRef.current = null;
        }
      } catch (error) {
        console.error("Error in global drop handler:", error);
        setIsDragging(false);
        setDraggedOverCategoryId(null);
        dragDataRef.current = null;
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("drop", handleGlobalDrop, true); // Use capture phase
      return () => {
        window.removeEventListener("drop", handleGlobalDrop, true);
      };
    }
  }, [isDragging, draggedOverCategoryId, onDropComplete]);

  // Store drag data in ref to persist across scroll events
  const dragDataRef = useRef<{
    projectId: Id<"projects">;
    currentCategoryId?: Id<"categories">;
    currentSubcategoryId?: Id<"categories">;
  } | null>(null);

  // Listen for drag events globally - only show drop zones when dragging projects
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      // Only show drop zones if dragging a project (check for our data type)
      if (e.dataTransfer?.types.includes("application/json")) {
        setIsDragging(true);
        // Store drag data immediately
        try {
          const data = e.dataTransfer.getData("application/json");
          if (data) {
            dragDataRef.current = JSON.parse(data);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    const handleGlobalDragEnd = () => {
      setIsDragging(false);
      setDraggedOverCategoryId(null);
      dragDataRef.current = null;
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      // Keep drop zones visible while dragging
      // Prevent default to allow drop
      if (e.dataTransfer?.types.includes("application/json")) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("dragenter", handleGlobalDragEnter, true);
      window.addEventListener("dragover", handleGlobalDragOver, true);
      window.addEventListener("dragend", handleGlobalDragEnd, true);
      window.addEventListener("drop", handleGlobalDragEnd, true);
      return () => {
        window.removeEventListener("dragenter", handleGlobalDragEnter, true);
        window.removeEventListener("dragover", handleGlobalDragOver, true);
        window.removeEventListener("dragend", handleGlobalDragEnd, true);
        window.removeEventListener("drop", handleGlobalDragEnd, true);
      };
    }
  }, []);

  if (!mainCategories || mainCategories.length === 0) {
    return null;
  }

  return (
    <>
      {/* Fixed overlay drop zone that appears when dragging - always accessible */}
      {isDragging && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-6xl px-4 pointer-events-none">
          <Card className="glass-card p-4 shadow-2xl border-2 border-emerald-400 pointer-events-auto">
            <div className="flex items-center gap-2 mb-4">
              <Move className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-lg">Drop project into a category</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {mainCategories.map((category) => (
                <div
                  key={category._id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDragOver(e, category._id);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDragOver(e, category._id);
                  }}
                  onDragLeave={(e) => {
                    // Only clear if we're actually leaving the element (not entering a child)
                    if (e.currentTarget === e.target) {
                      handleDragLeave();
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDrop(e, category._id);
                  }}
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
          </Card>
        </div>
      )}
      
      {/* Static drop zone at top (only visible when not dragging) */}
      {!isDragging && (
        <Card className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Move className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-lg">Drag projects to categories</h3>
          </div>
          <p className="text-sm text-gray-500">
            Start dragging a project to see category drop zones
          </p>
        </Card>
      )}
    </>
  );
}

