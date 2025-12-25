import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { ProjectDetailClient } from "@/components/project-detail/project-detail-client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { userId } = await auth();

  // Redirect if not authenticated
  if (!userId) {
    redirect("/");
  }

  const { id } = await params;
  const projectId = id as Id<"projects">;

  // Preload project data on the server for faster initial load
  const preloadedProject = await preloadQuery(api.projects.getProject, {
    projectId,
    userId,
  });

  // Preload owner check on the server
  const preloadedIsOwner = await preloadQuery(
    api.userSettings.isUserOwner,
    { userId }
  );

  return (
    <ProjectDetailClient
      projectId={projectId}
      userId={userId}
      preloadedProject={preloadedProject}
      preloadedIsOwner={preloadedIsOwner}
    />
  );
}
