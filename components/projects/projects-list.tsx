"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery, useQuery } from "convex/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CategoryDropZone } from "@/components/categories/category-drop-zone";
import { CategoryHeader } from "@/components/categories/category-header";
import { EmptyState } from "@/components/projects/empty-state";
import { PageHeader } from "@/components/projects/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
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
  // Pagination state
  const [paginationCursor, setPaginationCursor] = useState<string | null | undefined>(undefined);
  const [allLoadedProjects, setAllLoadedProjects] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Always call usePreloadedQuery unconditionally
  // This hook must be called on every render, even if we don't use the result
  const preloadedResult = usePreloadedQuery(preloadedProjects as any);

  // When searching, load ALL projects for client-side filtering
  const allProjectsForSearch = useQuery(
    api.projects.getAllUserProjects,
    searchQuery.trim() && userId && !categoryId
      ? { userId }
      : "skip"
  );

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
      : "skip"
  );

  // Paginated query for loading more projects (only when explicitly loading more)
  const paginatedQueryResult = useQuery(
    api.projects.listUserProjects,
    !searchQuery.trim() && !categoryId && userId && paginationCursor !== null && paginationCursor !== undefined
      ? {
          userId,
          paginationOpts: {
            numItems: 20,
            cursor: paginationCursor,
          },
        }
      : "skip"
  );

  // Always call useMemo unconditionally
  // Determine which result to use based on conditions
  // Use preloaded for category pages or when filter is "all"
  // Use dynamic query result when filter is not "all"
  const projectsResult = useMemo(() => {
    if (categoryId || filter === "all") {
      return preloadedResult;
    }
    return (
      dynamicQueryResult || { page: [], continueCursor: null, isDone: true }
    );
  }, [categoryId, filter, preloadedResult, dynamicQueryResult]);

  // Initialize allLoadedProjects with first page
  useEffect(() => {
    if (!searchQuery.trim() && !categoryId && projectsResult.page && allLoadedProjects.length === 0) {
      setAllLoadedProjects(projectsResult.page || []);
      setPaginationCursor(projectsResult.continueCursor || undefined);
    }
  }, [projectsResult.page, projectsResult.continueCursor, searchQuery, categoryId, allLoadedProjects.length]);

  // Load more projects when paginated query result changes
  useEffect(() => {
    if (paginatedQueryResult && paginatedQueryResult.page) {
      setAllLoadedProjects((prev) => [...prev, ...paginatedQueryResult.page]);
      setPaginationCursor(paginatedQueryResult.continueCursor || null);
      setIsLoadingMore(false);
    }
  }, [paginatedQueryResult]);

  // Reset pagination when search changes
  useEffect(() => {
    if (searchQuery.trim()) {
      setAllLoadedProjects([]);
      setPaginationCursor(null);
    } else if (projectsResult.page) {
      setAllLoadedProjects(projectsResult.page || []);
      setPaginationCursor(projectsResult.continueCursor || null);
    }
  }, [searchQuery]);

  // Deduplicate projects by _id to prevent duplicate key errors
  const allProjects = useMemo(() => {
    // If searching, use all projects from search query
    if (searchQuery.trim() && allProjectsForSearch) {
      return allProjectsForSearch;
    }
    
    // Otherwise use loaded projects (paginated)
    const projects = allLoadedProjects.length > 0 ? allLoadedProjects : (projectsResult.page || []);
    const seen = new Set<string>();
    return projects.filter((project: any) => {
      const id = String(project._id);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [allLoadedProjects, projectsResult.page, searchQuery, allProjectsForSearch]);

  // Filter projects based on search query (case-insensitive)
  // ONLY searches project displayName and fileName - nothing else
  // Case-insensitive: converts both query and names to lowercase for comparison
  const filteredProjects = useMemo(() => {
    let projects = allProjects;

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      projects = allProjects.filter((project: any) => {
        // Get the actual project name to search (use displayName if available, otherwise fileName)
        const projectName = (project.displayName || project.fileName || "")
          .toLowerCase()
          .trim();

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
    }

    // Return filtered projects (already deduplicated in allProjects)
    return projects;
  }, [allProjects, searchQuery]);

  const hasProjects = filteredProjects.length > 0;
  // Check if there are more projects to load
  const currentContinueCursor = allLoadedProjects.length > 0 
    ? paginationCursor 
    : projectsResult.continueCursor;
  const hasMore = !searchQuery.trim() && !categoryId && currentContinueCursor !== null && currentContinueCursor !== undefined;

  // Load more projects
  const handleLoadMore = () => {
    const currentCursor = allLoadedProjects.length > 0 
      ? (projectsResult.continueCursor || paginationCursor)
      : projectsResult.continueCursor;
    
    if (currentCursor && !isLoadingMore) {
      setIsLoadingMore(true);
      setPaginationCursor(currentCursor);
      // The query will automatically trigger via paginationCursor state
    }
  };

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
        <>
          <div className="grid gap-4 @container">
            {filteredProjects.map((project: any) => (
              <div
                key={project._id}
                ref={
                  highlightProjectId === project._id
                    ? highlightedElementRef
                    : null
                }
              >
                <ProjectCard
                  project={project}
                  isOnAllProjectsPage={!categoryId}
                  highlightProjectId={highlightProjectId}
                />
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {!searchQuery.trim() && !categoryId && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Load More Button */}
              {hasMore && (
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="min-w-[140px]"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              )}

              {/* Page Info */}
              {allLoadedProjects.length > 0 && (
                <div className="text-sm text-gray-600">
                  Showing {allLoadedProjects.length} project{allLoadedProjects.length !== 1 ? "s" : ""}
                  {hasMore && " (more available)"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
