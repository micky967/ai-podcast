"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery, useQuery } from "convex/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CategoryDropZone } from "@/components/categories/category-drop-zone";
import { CategoryHeader } from "@/components/categories/category-header";
import { EmptyState } from "@/components/projects/empty-state";
import { PageHeader } from "@/components/projects/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";

interface ProjectsListProps {
  preloadedProjects:
    | Preloaded<typeof api.projects.listUserProjects>
    | Preloaded<typeof api.projects.listUserProjectsByCategory>
    | Preloaded<typeof api.projects.listUserProjectsWithShared>;
  categoryId?: Id<"categories">;
  preloadedCategory?: Preloaded<typeof api.categories.getCategory>;
}

export function ProjectsList({
  preloadedProjects,
  categoryId,
  preloadedCategory,
}: ProjectsListProps) {
  // Call all hooks unconditionally at the top level - never conditionally
  const searchParams = useSearchParams();
  const highlightProjectId = searchParams.get("project") || undefined;
  const highlightedElementRef = useRef<HTMLDivElement>(null);
  const { userId } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  // Filter state (only for non-category pages)
  const [filter, setFilter] = useState<"all" | "own" | "shared">("all");

  // Always call usePreloadedQuery unconditionally
  // This hook must be called on every render, even if we don't use the result
  const preloadedResult = usePreloadedQuery(preloadedProjects as any);

  // Always call useQuery hook unconditionally, but conditionally skip it
  // This ensures hooks are called in the same order every render
  // Use userId check to skip when user is logged out
  const dynamicQueryResult = useQuery(
    api.projects.listUserProjectsWithShared,
    !categoryId && filter !== "all" && userId
      ? {
          userId,
          filter,
        }
      : "skip",
  );

  // Always call useMemo unconditionally
  // Determine which result to use based on conditions
  // Use preloaded for category pages or when filter is "all"
  // Use dynamic query result when filter is not "all"
  const projectsResult = useMemo(() => {
    if (categoryId || filter === "all") {
      return preloadedResult;
    }
    return dynamicQueryResult || { page: [], continueCursor: null, isDone: true };
  }, [categoryId, filter, preloadedResult, dynamicQueryResult]);
  
  const allProjects = projectsResult.page || [];

  // Filter projects based on search query (case-insensitive)
  // ONLY searches project displayName and fileName - nothing else
  // Case-insensitive: converts both query and names to lowercase for comparison
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProjects;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return allProjects.filter((project: any) => {
      // Get the actual project name to search (use displayName if available, otherwise fileName)
      const projectName = (project.displayName || project.fileName || "").toLowerCase().trim();
      
      // Also search the original fileName separately
      const fileName = (project.fileName || "").toLowerCase().trim();
      
      // ONLY match if the search query appears in the project name or file name
      // Case-insensitive comparison (both converted to lowercase)
      // This does NOT search:
      // - Category names
      // - File extensions  
      // - File sizes
      // - Any other metadata
      return projectName.includes(query) || fileName.includes(query);
    });
  }, [allProjects, searchQuery]);

  const hasProjects = filteredProjects.length > 0;

  // Scroll to highlighted project when it loads
  useEffect(() => {
    if (highlightProjectId && highlightedElementRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        highlightedElementRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [highlightProjectId]);

  // Ensure component always renders consistently, even during logout
  // This prevents "fewer hooks than expected" errors
  if (!userId) {
    // During logout, userId becomes null - return empty state but keep hooks called
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden">
        <div className="text-center py-20">
          <p className="text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden">
      {categoryId ? (
        <CategoryHeader
          categoryId={categoryId}
          preloadedCategory={preloadedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : (
        <>
          <PageHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filter={filter}
            onFilterChange={(f) => setFilter(f as "all" | "own" | "shared")}
          />
          <CategoryDropZone />
        </>
      )}

      {!hasProjects && (
        <EmptyState
          message={
            searchQuery
              ? `No projects found matching "${searchQuery}". Try a different search term.`
              : categoryId
              ? "No projects found in this category yet. Upload your first project to get started!"
              : undefined
          }
        />
      )}

      {hasProjects && (
        <div className="grid gap-4 @container">
          {filteredProjects.map((project: any) => (
            <div
              key={project._id}
              ref={highlightProjectId === project._id ? highlightedElementRef : null}
            >
              <ProjectCard
                project={project}
                isOnAllProjectsPage={!categoryId}
                highlightProjectId={highlightProjectId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
