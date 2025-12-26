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
  const [paginationCursor, setPaginationCursor] = useState<
    string | null | undefined
  >(undefined);
  const [allLoadedProjects, setAllLoadedProjects] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Always call usePreloadedQuery unconditionally
  // This hook must be called on every render, even if we don't use the result
  const preloadedResult = usePreloadedQuery(preloadedProjects as any);

  // Reactive query for the same data - this will update when projects change
  // Use this to ensure UI updates when projects are modified (e.g., category changes)
  // For "all" filter, use listUserProjectsWithShared to include both own and shared projects
  const reactiveQueryResult = useQuery(
    api.projects.listUserProjectsWithShared,
    !searchQuery.trim() && !categoryId && userId && filter === "all"
      ? {
          userId,
          filter: "all",
        }
      : "skip"
  );

  // Reactive query for category pages to ensure updates when projects change
  const reactiveCategoryQuery = useQuery(
    api.projects.listUserProjectsByCategory,
    categoryId && userId && !searchQuery.trim()
      ? {
          userId,
          categoryId,
        }
      : "skip"
  );

  // When searching, load ALL projects for client-side filtering (respects current filter)
  const allProjectsForSearch = useQuery(
    api.projects.getAllUserProjectsWithShared,
    searchQuery.trim() && userId && !categoryId
      ? {
          userId,
          filter, // Respect the current filter (all, own, or shared)
        }
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
  // Always use listUserProjectsWithShared (it handles all filters including "all")
  const paginatedQueryResult = useQuery(
    api.projects.listUserProjectsWithShared,
    !searchQuery.trim() &&
      !categoryId &&
      userId &&
      paginationCursor !== null &&
      paginationCursor !== undefined
      ? {
          userId,
          filter,
          paginationOpts: {
            numItems: 20,
            cursor: paginationCursor,
          },
        }
      : "skip"
  );

  // Always call useMemo unconditionally
  // Determine which result to use based on conditions
  // Use reactive query for "all" filter to ensure updates when projects change
  // Use reactive query for category pages to ensure updates when projects change
  // Use dynamic query result when filter is not "all"
  const projectsResult = useMemo(() => {
    if (categoryId) {
      // Use reactive category query if available (for real-time updates), otherwise fall back to preloaded
      return reactiveCategoryQuery || preloadedResult;
    }
    if (filter === "all") {
      // Use reactive query if available (for real-time updates), otherwise fall back to preloaded
      return reactiveQueryResult || preloadedResult;
    }
    return (
      dynamicQueryResult || { page: [], continueCursor: null, isDone: true }
    );
  }, [
    categoryId,
    filter,
    preloadedResult,
    reactiveQueryResult,
    reactiveCategoryQuery,
    dynamicQueryResult,
  ]);

  // Initialize and update allLoadedProjects with first page (only for non-category pages)
  // Update when reactive query changes to ensure real-time updates
  useEffect(() => {
    if (!searchQuery.trim() && !categoryId) {
      // Only update from reactive query if filter is "all"
      if (filter === "all" && reactiveQueryResult) {
        // ALWAYS sync first page with reactive query for real-time updates
        // This ensures UI updates immediately when projects change (e.g., category updates)
        const firstPage = reactiveQueryResult.page || [];
        
        setAllLoadedProjects((prev) => {
          // Create sets of IDs for comparison
          const firstPageIds = new Set(firstPage.map((p: any) => p._id));
          const prevIds = new Set(prev.map((p: any) => p._id));
          
          // Check if first page has changed (new projects added or removed)
          const hasNewProjects = firstPage.some((p: any) => !prevIds.has(p._id));
          const hasRemovedProjects = prev.some((p: any) => !firstPageIds.has(p._id) && !p.deletedAt);
          
          // If there are changes, update the list
          if (hasNewProjects || hasRemovedProjects || firstPage.length !== prev.length) {
            // If we have paginated results, merge them (deduplicate)
            if (prev.length > firstPage.length) {
              const additionalPages = prev.filter(
                (p: any) => !firstPageIds.has(p._id) && !p.deletedAt
              );
              // Combine first page (newest) with additional pages, ensuring no duplicates
              const combined = [...firstPage, ...additionalPages];
              const seen = new Set<string>();
              return combined.filter((p: any) => {
                const id = String(p._id);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              });
            }
            // Otherwise just use the reactive query result
            return firstPage;
          }
          return prev;
        });
        setPaginationCursor(reactiveQueryResult.continueCursor || undefined);
      } else if (filter !== "all" && dynamicQueryResult) {
        // For filtered views, always sync with dynamicQueryResult for real-time updates
        const filteredPage = dynamicQueryResult.page || [];
        setAllLoadedProjects((prev) => {
          // Get IDs from the reactive query result (first page) - these are the current valid projects
          const reactivePageIds = new Set(filteredPage.map((p: any) => p._id));

          // If we have paginated results, merge them
          // The reactive query result is the source of truth for the first page
          if (prev.length > filteredPage.length) {
            // Get projects from prev that are:
            // 1. NOT in the reactive page (these are additional pages)
            // 2. NOT deleted (deletedAt is undefined/null)
            const additionalPages = prev.filter(
              (p: any) => !reactivePageIds.has(p._id) && !p.deletedAt
            );
            // Use reactive page as first page (source of truth) + additional pages
            // This ensures deleted projects are removed from both first page and paginated pages
            return [...filteredPage, ...additionalPages];
          }
          // No paginated results yet, just use the reactive query result
          // This will automatically remove deleted projects
          return filteredPage;
        });
        setPaginationCursor(dynamicQueryResult.continueCursor || undefined);
      } else if (allLoadedProjects.length === 0 && projectsResult.page) {
        // Initial load from preloaded result
        setAllLoadedProjects(projectsResult.page || []);
        setPaginationCursor(projectsResult.continueCursor || undefined);
      }
    }
    // Reset when category changes
    if (categoryId) {
      setAllLoadedProjects([]);
      setPaginationCursor(undefined);
    }
  }, [
    projectsResult.page,
    projectsResult.continueCursor,
    searchQuery,
    categoryId,
    filter,
    reactiveQueryResult?.page, // Use .page to ensure we detect changes
    reactiveQueryResult?.continueCursor,
    dynamicQueryResult?.page, // Use .page to ensure we detect changes
    dynamicQueryResult?.continueCursor,
  ]);

  // Load more projects when paginated query result changes
  // Accumulate results for both "all" and filtered views
  useEffect(() => {
    if (paginatedQueryResult) {
      if (paginatedQueryResult.page && paginatedQueryResult.page.length > 0) {
        // Add new projects (deduplicate by _id)
        setAllLoadedProjects((prev) => {
          const existingIds = new Set(prev.map((p: any) => p._id));
          const newProjects = paginatedQueryResult.page.filter(
            (p: any) => !existingIds.has(p._id)
          );
          return [...prev, ...newProjects];
        });
        // Set cursor to null if no more results, otherwise use the continueCursor
        const nextCursor = paginatedQueryResult.continueCursor || null;
        setPaginationCursor(nextCursor);
        setIsLoadingMore(false);
      } else {
        // No more results (empty page or no page)
        setPaginationCursor(null);
        setIsLoadingMore(false);
      }
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

  // Reset pagination when filter changes
  useEffect(() => {
    if (!categoryId && !searchQuery.trim()) {
      setAllLoadedProjects([]);
      setPaginationCursor(undefined);
    }
  }, [filter, categoryId, searchQuery]);

  // Deduplicate projects by _id to prevent duplicate key errors
  // IMPORTANT: Always prefer reactive query results for real-time updates
  const allProjects = useMemo(() => {
    // If searching, use all projects from search query
    if (searchQuery.trim() && allProjectsForSearch) {
      return allProjectsForSearch;
    }

    // For category pages, ALWAYS use reactive query if available (for real-time updates)
    if (categoryId) {
      // Prefer reactive query - it will update immediately when projects change
      if (reactiveCategoryQuery?.page) {
        return reactiveCategoryQuery.page;
      }
      // Fallback to preloaded result
      return projectsResult.page || [];
    }

    // For filtered views (my files, shared), use reactive query directly
    if (filter !== "all") {
      // Always prefer reactive query result for real-time updates
      if (dynamicQueryResult?.page) {
        // Get IDs from reactive query (these are the current valid projects in first page)
        const reactiveIds = new Set(
          dynamicQueryResult.page.map((p: any) => p._id)
        );

        // Check if we have additional pages (projects in allLoadedProjects not in reactive page)
        const hasAdditionalPages = allLoadedProjects.some(
          (p: any) => !reactiveIds.has(p._id) && !p.deletedAt
        );

        if (hasAdditionalPages) {
          // Only keep projects from allLoadedProjects that are:
          // 1. NOT in the reactive page (these are additional pages)
          // 2. NOT deleted (deletedAt is undefined/null)
          // The reactive page is the source of truth for the first page (removes deleted projects)
          const additionalPages = allLoadedProjects.filter(
            (p: any) => !reactiveIds.has(p._id) && !p.deletedAt
          );
          return [...dynamicQueryResult.page, ...additionalPages];
        }
        // No paginated results, just return the reactive query result
        // This will automatically exclude deleted projects
        return dynamicQueryResult.page;
      }
      // Still loading - return empty array (don't show stale data)
      return [];
    }

    // For "all" filter, ALWAYS use reactive query result for first page (real-time updates)
    // This ensures UI updates immediately when projects change (e.g., category updates)
    const firstPage = reactiveQueryResult?.page || projectsResult.page || [];
    const hasPaginatedResults = allLoadedProjects.length > firstPage.length;

    // If we have paginated results, merge them (reactive first page + paginated pages)
    // Otherwise just use the reactive query result directly
    const projects = hasPaginatedResults
      ? (() => {
          const firstPageIds = new Set(firstPage.map((p: any) => p._id));
          const additionalPages = allLoadedProjects.filter(
            (p: any) => !firstPageIds.has(p._id)
          );
          return [...firstPage, ...additionalPages];
        })()
      : firstPage;

    const seen = new Set<string>();
    return projects.filter((project: any) => {
      // Filter out deleted projects
      if (project.deletedAt) {
        return false;
      }
      // Deduplicate by _id
      const id = String(project._id);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [
    allLoadedProjects,
    projectsResult.page,
    searchQuery,
    allProjectsForSearch,
    categoryId,
    filter,
    dynamicQueryResult?.page,
    reactiveCategoryQuery?.page,
    reactiveQueryResult?.page,
  ]);

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
  // Use the most recent query result's continueCursor or isDone flag
  const isDone =
    paginatedQueryResult?.isDone !== undefined
      ? paginatedQueryResult.isDone
      : projectsResult.isDone !== undefined
      ? projectsResult.isDone
      : false;

  const currentContinueCursor =
    paginatedQueryResult?.continueCursor !== undefined
      ? paginatedQueryResult.continueCursor
      : allLoadedProjects.length > 0
      ? paginationCursor
      : projectsResult.continueCursor;

  // Only show "Load More" if not done and cursor exists
  const hasMore =
    !searchQuery.trim() &&
    !categoryId &&
    !isDone &&
    currentContinueCursor !== null &&
    currentContinueCursor !== undefined;

  // Load more projects
  const handleLoadMore = () => {
    // Get the current cursor from the most recent query result
    const currentCursor =
      paginatedQueryResult?.continueCursor !== undefined
        ? paginatedQueryResult.continueCursor
        : allLoadedProjects.length > 0
        ? paginationCursor
        : projectsResult.continueCursor;

    if (currentCursor && !isLoadingMore && currentCursor !== null) {
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
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden project-card-container" style={{ paddingBottom: typeof window !== 'undefined' && window.innerWidth < 768 ? '100px' : '40px' }}>
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
          <div className="grid gap-4 @container project-card-container">
            {filteredProjects.map((project: any) => (
              <div
                key={`${project._id}-${project.categoryId || "none"}-${
                  project.updatedAt
                }`}
                ref={
                  highlightProjectId === project._id
                    ? highlightedElementRef
                    : null
                }
                className="project-card-container"
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
                  Showing {allLoadedProjects.length} project
                  {allLoadedProjects.length !== 1 ? "s" : ""}
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
