"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { EmptyState } from "@/components/projects/empty-state";
import { CategoryHeader } from "@/components/categories/category-header";
import { ProjectCard } from "@/components/projects/project-card";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface FilteredProjectsListProps {
  preloadedProjects: Preloaded<
    typeof api.projects.listUserProjectsByCategory
  >;
  categoryId: Id<"categories">;
  preloadedCategory: Preloaded<typeof api.categories.getCategory>;
  subcategoryId?: Id<"categories">;
}

export function FilteredProjectsList({
  preloadedProjects,
  categoryId,
  preloadedCategory,
  subcategoryId,
}: FilteredProjectsListProps) {
  // Use preloaded data and subscribe to real-time updates
  const projectsResult = usePreloadedQuery(preloadedProjects);
  const projects = projectsResult.page || [];
  const hasProjects = projects.length > 0;

  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      <CategoryHeader
        categoryId={categoryId}
        subcategoryId={subcategoryId}
        preloadedCategory={preloadedCategory}
      />

      {!hasProjects && (
        <EmptyState
          message="No projects found in this category yet. Upload your first project to get started!"
        />
      )}

      {hasProjects && (
        <div className="grid gap-4 @container">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

