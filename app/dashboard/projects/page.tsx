import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { ProjectsList } from "@/components/projects/projects-list";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectsPageProps {
  searchParams: Promise<{
    category?: string;
    project?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { userId } = await auth();

  // Redirect if not authenticated (shouldn't happen with middleware, but for safety)
  if (!userId) {
    redirect("/");
  }

  const params = await searchParams;
  const categoryId = params.category as Id<"categories"> | undefined;

  // Preload projects data on the server
  // Use category-specific query if category is provided
  // For non-category pages, use listUserProjectsWithShared with filter "all" to include both own and shared projects
  const preloadedProjects = categoryId
    ? await preloadQuery(api.projects.listUserProjectsByCategory, {
        userId,
        categoryId,
      })
    : await preloadQuery(api.projects.listUserProjectsWithShared, {
        userId,
        filter: "all",
      });

  // Preload category data if category is provided
  const preloadedCategory = categoryId
    ? await preloadQuery(api.categories.getCategory, {
        categoryId,
      })
    : undefined;

  return (
    <ProjectsList
      preloadedProjects={preloadedProjects}
      categoryId={categoryId}
      preloadedCategory={preloadedCategory}
    />
  );
}
