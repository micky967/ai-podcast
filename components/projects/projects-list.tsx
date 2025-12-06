"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/projects/empty-state";
import { PageHeader } from "@/components/projects/page-header";
import { CategoryHeader } from "@/components/categories/category-header";
import { ProjectCard } from "@/components/projects/project-card";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectsListProps {
  preloadedProjects:
    | Preloaded<typeof api.projects.listUserProjects>
    | Preloaded<typeof api.projects.listUserProjectsByCategory>;
  categoryId?: Id<"categories">;
  preloadedCategory?: Preloaded<typeof api.categories.getCategory>;
}

export function ProjectsList({
  preloadedProjects,
  categoryId,
  preloadedCategory,
}: ProjectsListProps) {
  const searchParams = useSearchParams();
  const highlightProjectId = searchParams.get("project") || undefined;
  const highlightedElementRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Use preloaded data and subscribe to real-time updates
  // Handle both query types which return compatible result structures
  const projectsResult = categoryId
    ? usePreloadedQuery(
        preloadedProjects as Preloaded<typeof api.projects.listUserProjectsByCategory>
      )
    : usePreloadedQuery(
        preloadedProjects as Preloaded<typeof api.projects.listUserProjects>
      );
  const allProjects = projectsResult.page || [];

  // Filter projects based on search query (case-insensitive)
  // ONLY searches project displayName and fileName - nothing else
  // Case-insensitive: converts both query and names to lowercase for comparison
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProjects;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return allProjects.filter((project) => {
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

  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      {categoryId ? (
        <CategoryHeader
          categoryId={categoryId}
          preloadedCategory={preloadedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : (
        <PageHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
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
          {filteredProjects.map((project) => (
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
