"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery, useQuery } from "convex/react";
import { ArrowLeft, FolderTree, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CategoryHeaderProps {
  categoryId: Id<"categories">;
  subcategoryId?: Id<"categories">;
  preloadedCategory?: Preloaded<typeof api.categories.getCategory>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function CategoryHeader({
  categoryId,
  subcategoryId,
  preloadedCategory,
  searchQuery = "",
  onSearchChange,
}: CategoryHeaderProps) {
  const router = useRouter();
  const category = preloadedCategory
    ? usePreloadedQuery(preloadedCategory)
    : useQuery(api.categories.getCategory, { categoryId });
  const subcategory = subcategoryId
    ? useQuery(api.categories.getCategory, { categoryId: subcategoryId })
    : null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/dashboard/categories"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/dashboard/categories")}
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Button>
        </Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <FolderTree className="h-6 w-6 text-emerald-600" />
            <h1 className="text-4xl md:text-5xl font-extrabold">
              <span className="gradient-emerald-text">
                {category?.name || "Loading..."}
              </span>
              {subcategory && (
                <>
                  {" "}
                  <span className="text-gray-400">/</span>{" "}
                  <span className="text-gray-700">{subcategory.name}</span>
                </>
              )}
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            {subcategory
              ? `View all projects in ${subcategory.name}`
              : `View all projects in ${category?.name || "this category"}`}
          </p>
        </div>
        <Link 
          href="/dashboard/upload"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/dashboard/upload")}
        >
          <Button className="gradient-emerald text-white hover-glow shadow-lg px-6 py-6 text-base">
            <FolderTree className="mr-2 h-5 w-5" />
            New Upload
          </Button>
        </Link>
      </div>
      
      {/* Search Bar */}
      {onSearchChange && (
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search projects in this category..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10 h-12 text-base border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

