"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery, useQuery } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProcessingFlow } from "@/components/processing-flow";
import { ProjectStatusCard } from "@/components/project-status-card";
import { ProjectHeader } from "@/components/project-detail/project-header";
import { ProjectTabsWrapper } from "@/components/project-detail/project-tabs-wrapper";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PhaseStatus } from "@/lib/types";

interface ProjectDetailClientProps {
  projectId: Id<"projects">;
  userId: string;
  preloadedProject: Preloaded<typeof api.projects.getProject>;
  preloadedIsOwner: Preloaded<typeof api.userSettings.isUserOwner>;
}

export function ProjectDetailClient({
  projectId,
  userId,
  preloadedProject,
  preloadedIsOwner,
}: ProjectDetailClientProps) {
  const router = useRouter();

  // Use preloaded data for initial render, then switch to reactive query for real-time updates
  const preloadedResult = usePreloadedQuery(preloadedProject);
  const reactiveProject = useQuery(
    api.projects.getProject,
    userId ? { projectId, userId } : "skip"
  );

  // Prefer reactive query if available (for real-time updates), otherwise use preloaded
  // reactiveProject can be undefined (loading), null (no access), or the project object
  const project = reactiveProject !== undefined ? reactiveProject : preloadedResult;

  // Loading state
  if (project === undefined) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // No access state (project is null)
  if (project === null) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have access to this project.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if user has read-only access via sharing
  const isShared = project.isShared === true;

  const isProcessing = project.status === "processing";
  const isCompleted = project.status === "completed";
  const hasFailed = project.status === "failed";

  // Get status from Convex jobStatus (initialized on project creation)
  const transcriptionStatus: PhaseStatus =
    project?.jobStatus?.transcription || "pending";
  const generationStatus: PhaseStatus =
    project?.jobStatus?.contentGeneration || "pending";
  const showGenerating = isProcessing && generationStatus === "running";

  // Check if this is a document file (not audio)
  const isDocument =
    project.mimeType === "application/pdf" ||
    project.mimeType === "application/msword" ||
    project.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    project.mimeType === "text/plain";

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/dashboard/projects"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/dashboard/projects")}
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>

      {/* Header with title and actions */}
      <ProjectHeader
        projectId={projectId}
        userId={userId}
        initialDisplayName={project.displayName}
        initialFileName={project.fileName}
        isShared={isShared}
      />

      <div className="grid grid-cols-1 gap-6 min-w-0">
        <ProjectStatusCard project={project} />

        {isProcessing && (
          <ProcessingFlow
            transcriptionStatus={transcriptionStatus}
            generationStatus={generationStatus}
            fileDuration={project.fileDuration}
            createdAt={project.createdAt}
            mimeType={project.mimeType}
          />
        )}

        {hasFailed && project.error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{project.error.message}</p>
              {project.error.step && (
                <p className="text-sm text-muted-foreground mt-2">
                  Failed at: {project.error.step}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {(showGenerating || isCompleted) && (
          <ProjectTabsWrapper
            projectId={projectId}
            userId={userId}
            project={project}
            isDocument={isDocument}
            isShared={isShared}
            showGenerating={showGenerating}
          />
        )}
      </div>
    </div>
  );
}

