/**
 * Category Selector Component
 *
 * Two-level hierarchical category selector for medical specialties.
 * Allows users to select a main category and optional subcategory.
 */

"use client";

import { useQuery } from "convex/react";
import { FolderTree } from "lucide-react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategorySelectorProps {
  selectedCategoryId?: Id<"categories"> | null;
  selectedSubcategoryId?: Id<"categories"> | null;
  onCategoryChange: (categoryId: Id<"categories"> | null) => void;
  onSubcategoryChange: (subcategoryId: Id<"categories"> | null) => void;
  required?: boolean;
}

export function CategorySelector({
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  required = true,
}: CategorySelectorProps) {
  // Fetch main categories
  const mainCategories = useQuery(api.categories.getMainCategories);

  // Fetch subcategories when a main category is selected
  const subcategories = useQuery(
    api.categories.getSubcategories,
    selectedCategoryId ? { parentId: selectedCategoryId } : "skip",
  );

  // Reset subcategory when main category changes
  useEffect(() => {
    if (selectedCategoryId) {
      // Don't reset if the current subcategory is still valid
      if (
        selectedSubcategoryId &&
        subcategories?.some((sub) => sub._id === selectedSubcategoryId)
      ) {
        return;
      }
    }
    // Reset subcategory when category changes or subcategory is invalid
    if (selectedSubcategoryId && selectedCategoryId) {
      const isValid = subcategories?.some(
        (sub) => sub._id === selectedSubcategoryId,
      );
      if (!isValid) {
        onSubcategoryChange(null);
      }
    } else if (!selectedCategoryId) {
      onSubcategoryChange(null);
    }
  }, [
    selectedCategoryId,
    selectedSubcategoryId,
    subcategories,
    onSubcategoryChange,
  ]);

  const selectedCategory = mainCategories?.find(
    (cat) => cat._id === selectedCategoryId,
  );

  const hasSubcategories =
    subcategories && subcategories.length > 0;

  return (
    <Card className="glass-card border-emerald-200/50">
      <CardContent className="pt-6 space-y-4">
        {/* Main Category Selector */}
        <div className="space-y-2">
          <Label htmlFor="category" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-emerald-600" />
            Category
            {required && <span className="text-red-600">*</span>}
          </Label>
          <Select
            value={selectedCategoryId || undefined}
            onValueChange={(value) => {
              onCategoryChange(value ? (value as Id<"categories">) : null);
            }}
            disabled={!mainCategories || mainCategories.length === 0}
          >
            <SelectTrigger
              id="category"
              className="w-full bg-white/50 border-emerald-200 focus:ring-emerald-400"
            >
              <SelectValue placeholder={
                mainCategories === undefined 
                  ? "Loading categories..." 
                  : mainCategories && mainCategories.length === 0
                  ? "No categories available"
                  : "Select a medical specialty category"
              } />
            </SelectTrigger>
            {mainCategories && mainCategories.length > 0 && (
              <SelectContent className="max-h-[300px] z-[100]">
                {mainCategories.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            )}
          </Select>
          {mainCategories === undefined && (
            <p className="text-xs text-gray-500">
              Loading categories...
            </p>
          )}
          {mainCategories && mainCategories.length === 0 && (
            <p className="text-xs text-amber-600">
              No categories available. Categories need to be seeded first.
            </p>
          )}
          {!selectedCategoryId && required && mainCategories && mainCategories.length > 0 && (
            <p className="text-xs text-red-600">
              Please select a category to continue
            </p>
          )}
        </div>

        {/* Subcategory Selector (only show if subcategories exist) */}
        {selectedCategoryId && hasSubcategories && (
          <div className="space-y-2">
            <Label htmlFor="subcategory" className="text-sm text-gray-700">
              Subcategory <span className="text-gray-500">(Optional)</span>
            </Label>
            <Select
              value={selectedSubcategoryId ? selectedSubcategoryId : "__none__"}
              onValueChange={(value) => {
                if (value === "__none__") {
                  onSubcategoryChange(null);
                } else {
                  onSubcategoryChange(value as Id<"categories">);
                }
              }}
            >
              <SelectTrigger
                id="subcategory"
                className="w-full bg-white/50 border-emerald-200 focus:ring-emerald-400"
              >
                <SelectValue placeholder="Select a subcategory (optional)" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="__none__">None (Use main category only)</SelectItem>
                {subcategories && subcategories.length > 0 ? (
                  subcategories.map((subcategory) => (
                    <SelectItem key={subcategory._id} value={subcategory._id}>
                      {subcategory.name}
                    </SelectItem>
                  ))
                ) : null}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Show selected category info */}
        {selectedCategory && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs font-semibold text-emerald-900 mb-1">
              Selected Category:
            </p>
            <p className="text-sm text-emerald-800">
              {selectedCategory.name}
              {selectedSubcategoryId &&
                subcategories?.find((sub) => sub._id === selectedSubcategoryId) &&
                ` → ${
                  subcategories.find((sub) => sub._id === selectedSubcategoryId)
                    ?.name
                }`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

