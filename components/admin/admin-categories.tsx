"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, FolderTree, Loader2 } from "lucide-react";
import { CreateCategoryDialog } from "@/components/categories/create-category-dialog";
import { deleteCategoryAction } from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function AdminCategories() {
  const [deletingCategoryId, setDeletingCategoryId] = useState<Id<"categories"> | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: Id<"categories">;
    name: string;
  } | null>(null);

  // Get all categories
  const mainCategories = useQuery(api.categories.getMainCategories);

  const handleDeleteClick = (categoryId: Id<"categories">, categoryName: string) => {
    setCategoryToDelete({ id: categoryId, name: categoryName });
    setConfirmDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    setDeletingCategoryId(categoryToDelete.id);
    try {
      const result = await deleteCategoryAction(categoryToDelete.id);
      if (result.success) {
        toast.success("Category deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category"
      );
    } finally {
      setDeletingCategoryId(null);
      setCategoryToDelete(null);
    }
  };

  // Get subcategories for a parent
  const getSubcategories = (parentId: Id<"categories">) => {
    // We'll need to query subcategories for each parent
    // For now, we'll show a placeholder
    return [];
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage categories. Deleting a category will also delete its subcategories and remove category assignments from projects.
          </p>
        </div>
        <CreateCategoryDialog />
      </div>

      {/* Categories List */}
      {mainCategories === undefined ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 mt-2">Loading categories...</p>
        </div>
      ) : mainCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No categories yet. Create your first category above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {mainCategories.map((category) => (
            <CategoryCard
              key={category._id}
              category={category}
              onDelete={handleDeleteClick}
              isDeleting={deletingCategoryId === category._id}
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Delete Category"
        description={
          categoryToDelete
            ? `Are you sure you want to delete "${categoryToDelete.name}"? This will also delete all subcategories and remove category assignments from projects. This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}

interface CategoryCardProps {
  category: {
    _id: Id<"categories">;
    name: string;
    description?: string;
    slug: string;
  };
  onDelete: (categoryId: Id<"categories">, categoryName: string) => void;
  isDeleting: boolean;
}

function CategoryCard({ category, onDelete, isDeleting }: CategoryCardProps) {
  const subcategories = useQuery(
    api.categories.getSubcategories,
    { parentId: category._id }
  );
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<Id<"categories"> | null>(null);

  const handleSubcategoryDelete = (subcategoryId: Id<"categories">, subcategoryName: string) => {
    onDelete(subcategoryId, subcategoryName);
  };

  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-emerald-600" />
              {category.name}
            </CardTitle>
            {category.description && (
              <p className="text-sm text-gray-600 mt-1">{category.description}</p>
            )}
            {subcategories && subcategories.length > 0 && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  {subcategories.length} subcategor{subcategories.length !== 1 ? "ies" : "y"}
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category._id, category.name)}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {subcategories && subcategories.length > 0 && (
        <CardContent className="pt-0">
          <div className="pl-7 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Subcategories:
            </p>
            <div className="space-y-1">
              {subcategories.map((sub) => (
                <div
                  key={sub._id}
                  className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 rounded"
                >
                  <span className="text-gray-700">{sub.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSubcategoryDelete(sub._id, sub.name)}
                    disabled={deletingSubcategoryId === sub._id || isDeleting}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingSubcategoryId === sub._id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

