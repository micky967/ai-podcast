import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { ProjectsList } from "@/components/projects/projects-list";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";

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
  const { category, project } = await searchParams;

  // Redirect if not authenticated (shouldn't happen with middleware, but for safety)
  if (!userId) {
    redirect("/");
  }

  // Initialize user settings if they don't exist (creates record in Convex immediately)
  // This ensures users appear in the database right after sign-up/sign-in
  await convex.mutation(api.userSettings.initializeUserSettings, {
    userId,
  });

  // Preload projects data - filtered by category if provided, otherwise all projects
  if (category) {
    const preloadedProjects = await preloadQuery(
      api.projects.listUserProjectsByCategory,
      {
        userId,
        categoryId: category as Id<"categories">,
      }
    );

    // Preload category data for header
    const preloadedCategory = await preloadQuery(api.categories.getCategory, {
      categoryId: category as Id<"categories">,
    });

    return (
      <ProjectsList
        preloadedProjects={preloadedProjects}
        categoryId={category as Id<"categories">}
        preloadedCategory={preloadedCategory}
      />
    );
  }

  // Show all projects if no category filter
  const preloadedProjects = await preloadQuery(
    api.projects.listUserProjectsWithShared,
    {
      userId,
      filter: "all",
    }
  );

  return <ProjectsList preloadedProjects={preloadedProjects} />;
}
