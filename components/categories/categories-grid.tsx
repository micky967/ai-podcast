"use client";

import { useAuth } from "@clerk/nextjs";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery, useQuery } from "convex/react";
import { FolderTree, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";

interface CategoriesGridProps {
  preloadedCategories?: Preloaded<typeof api.categories.getMainCategories>;
}

export function CategoriesGrid({ preloadedCategories }: CategoriesGridProps) {
  const { userId } = useAuth();
  const router = useRouter();
  const mainCategories = preloadedCategories
    ? usePreloadedQuery(preloadedCategories)
    : useQuery(api.categories.getMainCategories);

  // Get project counts per category
  const categoryCounts = useQuery(
    api.categories.getCategoryProjectCounts,
    userId ? { userId } : "skip",
  );

  if (mainCategories === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (mainCategories.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4 glass-card p-12 rounded-2xl max-w-md">
          <FolderTree className="h-16 w-16 text-gray-400 mx-auto" />
          <h3 className="text-xl font-semibold text-gray-800">
            No Categories Available
          </h3>
          <p className="text-gray-600">
            Categories need to be seeded first. Please check with your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {/* "All Categories" option */}
      <Link 
        href="/dashboard/projects" 
        className="group"
        prefetch={true}
        onMouseEnter={() => {
          router.prefetch("/dashboard/projects");
        }}
      >
        <Card className="glass-card border-blue-200/50 hover:border-blue-400 transition-all hover:shadow-lg hover:shadow-blue-200/50 h-full flex flex-col cursor-pointer bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <FolderTree className="h-8 w-8 text-blue-600 flex-shrink-0" />
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
              All Categories
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              View all projects across all categories
            </p>
          </div>
        </Card>
      </Link>

      {/* Category cards */}
      {mainCategories.map((category) => (
        <Link
          key={category._id}
          href={`/dashboard/projects?category=${category._id}`}
          className="group"
          prefetch={true}
          onMouseEnter={() => {
            router.prefetch(`/dashboard/projects?category=${category._id}`);
          }}
        >
          <Card className="glass-card border-emerald-200/50 hover:border-emerald-400 transition-all hover:shadow-lg hover:shadow-emerald-200/50 h-full flex flex-col cursor-pointer relative">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <FolderTree className="h-8 w-8 text-emerald-600 flex-shrink-0" />
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
            {/* Project count badge in bottom right */}
            {categoryCounts && categoryCounts[category._id] > 0 && (
              <div className="absolute bottom-3 right-3 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                {categoryCounts[category._id]}
              </div>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}

