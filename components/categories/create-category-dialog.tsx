/**
 * Create Category Dialog Component
 *
 * Allows Ultra plan users to create custom categories.
 * Can create main categories or subcategories (if parent is selected).
 */

"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { FolderPlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createCategoryAction } from "@/app/actions/categories";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentPlan } from "@/lib/client-tier-utils";

interface CreateCategoryDialogProps {
  parentCategoryId?: Id<"categories"> | null;
  onCategoryCreated?: (categoryId: Id<"categories">) => void;
  trigger?: React.ReactNode;
}

export function CreateCategoryDialog({
  parentCategoryId,
  onCategoryCreated,
  trigger,
}: CreateCategoryDialogProps) {
  const { has } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<Id<"categories"> | null>(
    parentCategoryId || null,
  );
  const [isCreating, setIsCreating] = useState(false);

  // Check if user has Ultra plan
  const userPlan = getCurrentPlan(has as any);
  const isUltra = userPlan === "ultra";

  // Fetch main categories for parent selection (only if not creating a subcategory)
  const mainCategories = useQuery(
    api.categories.getMainCategories,
    parentCategoryId ? "skip" : {},
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    if (name.length > 200) {
      toast.error("Category name is too long (max 200 characters)");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createCategoryAction({
        name: name.trim(),
        parentId: selectedParentId || undefined,
        description: description.trim() || undefined,
      });

      if (result.success && result.categoryId) {
        toast.success(
          parentCategoryId
            ? "Subcategory created successfully!"
            : "Category created successfully!",
        );
        setName("");
        setDescription("");
        setSelectedParentId(parentCategoryId || null);
        setOpen(false);
        onCategoryCreated?.(result.categoryId);
      } else {
        toast.error(result.error || "Failed to create category");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create category",
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Don't render if user doesn't have Ultra plan
  if (!isUltra) {
    return null;
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
    >
      <FolderPlus className="h-4 w-4" />
      {parentCategoryId ? "Add Subcategory" : "Create Category"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-emerald-600" />
            {parentCategoryId ? "Create New Subcategory" : "Create New Category"}
          </DialogTitle>
          <DialogDescription>
            {parentCategoryId
              ? "Add a new subcategory to organize your projects further."
              : "Create a custom category to organize your projects. This feature is available for Ultra plan users."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Parent Category Selector (only if not creating a subcategory) */}
          {!parentCategoryId && (
            <div className="space-y-2">
              <Label htmlFor="parent-category">
                Parent Category (Optional)
              </Label>
              <Select
                value={selectedParentId || "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") {
                    setSelectedParentId(null);
                  } else {
                    setSelectedParentId(value as Id<"categories">);
                  }
                }}
              >
                <SelectTrigger id="parent-category">
                  <SelectValue placeholder="Create as main category (no parent)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Create as main category</SelectItem>
                  {mainCategories?.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Leave empty to create a main category, or select a parent to create a subcategory
              </p>
            </div>
          )}

          {/* Category Name */}
          <div className="space-y-2">
            <Label htmlFor="category-name">
              Category Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                parentCategoryId
                  ? "e.g., Heart disease management"
                  : "e.g., Cardiology"
              }
              maxLength={200}
              disabled={isCreating}
            />
            <p className="text-xs text-gray-500">
              {name.length}/200 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="category-description">
              Description (Optional)
            </Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this category..."
              rows={3}
              maxLength={500}
              disabled={isCreating}
            />
            <p className="text-xs text-gray-500">
              {description.length}/500 characters
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="gradient-emerald text-white"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Category
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

