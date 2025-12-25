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

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { userId } = await auth();

  // Redirect if not authenticated (shouldn't happen with middleware, but for safety)
  if (!userId) {
    redirect("/");
  }

  const params = await searchParams;
  const categoryId = params.category as Id<"categories"> | undefined;

  // Preload projects data on the server
  // Always use listUserProjectsWithShared with filter "all" to include both own and shared projects
  // This ensures the sharing fix works: new uploads by group owners are visible to group members
  const preloadedProjects = await preloadQuery(
    api.projects.listUserProjectsWithShared,
    {
      userId,
      filter: "all",
    }
  );

  // Category feature is optional - only load if categories API is available
  // Using type assertion to handle optional feature gracefully
  let preloadedCategory = undefined;
  if (categoryId) {
    try {
      const categoriesApi = (api as any).categories;
      if (categoriesApi?.getCategory) {
        preloadedCategory = await preloadQuery(categoriesApi.getCategory, {
          categoryId,
        });
      }
    } catch (error) {
      // Categories feature not available, continue without it
      console.warn("Categories API not available");
    }
  }

  return (
    <ProjectsList
      preloadedProjects={preloadedProjects}
      categoryId={categoryId}
      preloadedCategory={preloadedCategory}
    />
  );
}
