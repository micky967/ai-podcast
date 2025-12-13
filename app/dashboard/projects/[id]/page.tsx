"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowLeft, Edit2, Loader2, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteProjectAction,
  updateDisplayNameAction,
} from "@/app/actions/projects";
import { ProcessingFlow } from "@/components/processing-flow";
import { TabContent } from "@/components/project-detail/tab-content";
import {
  DesktopTabTrigger,
  MobileTabItem,
} from "@/components/project-detail/tab-triggers";
import { ProjectStatusCard } from "@/components/project-status-card";
import { EngagementTab } from "@/components/project-tabs/engagement-tab";
import { HashtagsTab } from "@/components/project-tabs/hashtags-tab";
import { PowerPointTab } from "@/components/project-tabs/powerpoint-tab";
import { KeyMomentsTab } from "@/components/project-tabs/key-moments-tab";
import { SocialPostsTab } from "@/components/project-tabs/social-posts-tab";
import { SummaryTab } from "@/components/project-tabs/summary-tab";
import { TitlesTab } from "@/components/project-tabs/titles-tab";
import { TranscriptTab } from "@/components/project-tabs/transcript-tab";
import { YouTubeTimestampsTab } from "@/components/project-tabs/youtube-timestamps-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PROJECT_TABS } from "@/lib/tab-config";
import { FEATURES } from "@/lib/tier-config";
import type { PhaseStatus } from "@/lib/types";

export default function ProjectDetailPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const { id } = useParams();

  const projectId = id as Id<"projects">;

  // Convex is the single source of truth - real-time updates via subscription
  const project = useQuery(
    api.projects.getProject,
    userId ? { projectId, userId } : "skip"
  );

  // Check if user is owner - owners bypass plan restrictions
  const isOwner = useQuery(
    api.userSettings.isUserOwner,
    userId ? { userId } : "skip"
  );

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tab state for mobile dropdown
  const [activeTab, setActiveTab] = useState("summary");

  // Get status from Convex jobStatus (initialized on project creation)
  const transcriptionStatus: PhaseStatus =
    project?.jobStatus?.transcription || "pending";
  const generationStatus: PhaseStatus =
    project?.jobStatus?.contentGeneration || "pending";

  // Handle edit title
  const handleStartEdit = () => {
    setEditedName(project?.displayName || project?.fileName || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName("");
  };

  const handleSaveEdit = async () => {
    // Prevent editing if not owner
    if (isOwner !== true) {
      toast.error("You can only edit your own projects");
      setIsEditing(false);
      return;
    }

    if (!editedName.trim()) {
      toast.error("Project name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayNameAction(projectId, editedName);
      toast.success("Project name updated");
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update name"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    // Prevent deletion if not owner
    if (isOwner !== true) {
      toast.error("You can only delete your own projects");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this project? This action cannot be undone."
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteProjectAction(projectId);
      toast.success("Project deleted");
      router.push("/dashboard/projects");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project"
      );
      setIsDeleting(false);
    }
  };

  // Loading state
  if (project === undefined) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // No access state (project is null)
  if (project === null) {
    return (
      <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden">
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
  // Note: isOwner is already declared above from useQuery
  const isShared = project.isShared === true;

  const isProcessing = project.status === "processing";
  const isCompleted = project.status === "completed";
  const hasFailed = project.status === "failed";
  const showGenerating = isProcessing && generationStatus === "running";

  // Check if this is a document file (not audio)
  const isDocument =
    project.mimeType === "application/pdf" ||
    project.mimeType === "application/msword" ||
    project.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    project.mimeType === "text/plain";

  // Filter tabs based on file type
  // Documents don't show: Key Moments, YouTube timestamps, social posts, speakers
  const visibleTabs = PROJECT_TABS.filter((tab) => {
    if (isDocument) {
      return !["moments", "youtube-timestamps", "social", "speakers"].includes(
        tab.value
      );
    }
    return true;
  });

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-0 overflow-x-hidden">
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xl sm:text-2xl font-bold h-auto py-2 flex-1"
                placeholder="Project name"
                autoFocus
                disabled={isSaving}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="gradient-emerald text-white hover-glow px-4 sm:px-6 transition-all"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden sm:inline mr-2">Save</span>
                      <Save className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">
                {project.displayName || project.fileName}
              </h1>
            </div>
          )}
        </div>
        {/* Only show Edit/Delete buttons if user owns the project */}
        {isOwner === true && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isEditing && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleStartEdit}
                className="glass-card hover-lift border-2 border-emerald-200 hover:border-emerald-400 px-4 sm:px-6 bg-white"
              >
                <Edit2 className="h-4 w-4 sm:mr-2 text-emerald-600" />
                <span className="hidden sm:inline font-semibold text-emerald-700">
                  Edit
                </span>
              </Button>
            )}
            <Button
              size="lg"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gradient-emerald text-white hover-glow px-4 sm:px-6 transition-all"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        )}
        {/* Show read-only indicator for shared projects */}
        {isShared && isOwner !== true && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground italic">
              Read-only (Shared project)
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6">
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
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            {/* Mobile Dropdown */}
            <div className="glass-card rounded-2xl p-4 mb-6 lg:hidden">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full px-4 py-3 rounded-xl bg-linear-to-r from-emerald-500 to-teal-400 text-white font-semibold text-base border-none outline-none focus:ring-2 focus:ring-emerald-300 transition-all h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleTabs.map((tab) => (
                    <MobileTabItem
                      key={tab.value}
                      tab={tab}
                      project={project}
                      isShared={isShared}
                    />
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Tabs */}
            <div className="glass-card rounded-2xl p-2 mb-6 hidden lg:block w-full">
              <TabsList className="flex flex-wrap gap-2 bg-transparent">
                {visibleTabs.map((tab) => (
                  <DesktopTabTrigger
                    key={tab.value}
                    tab={tab}
                    project={project}
                    isShared={isShared}
                  />
                ))}
              </TabsList>
            </div>

            <TabsContent value="summary" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.summary}
                error={project.jobErrors?.summary}
                projectId={projectId}
                jobName="summary"
                emptyMessage="No summary available"
                isShared={isShared}
              >
                <SummaryTab summary={project.summary} />
              </TabContent>
            </TabsContent>

            {/* Key Moments - Only for audio files */}
            {!isDocument && (
              <TabsContent value="moments" className="space-y-4">
                <TabContent
                  isLoading={showGenerating}
                  data={project.keyMoments}
                  error={project.jobErrors?.keyMoments}
                  projectId={projectId}
                  feature={FEATURES.KEY_MOMENTS}
                  featureName="Key Moments"
                  jobName="keyMoments"
                  emptyMessage="No key moments detected"
                  isShared={isShared}
                >
                  <KeyMomentsTab keyMoments={project.keyMoments} />
                </TabContent>
              </TabsContent>
            )}

            <TabsContent value="youtube-timestamps" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.youtubeTimestamps}
                error={project.jobErrors?.youtubeTimestamps}
                projectId={projectId}
                feature={FEATURES.YOUTUBE_TIMESTAMPS}
                featureName="YouTube Timestamps"
                jobName="youtubeTimestamps"
                emptyMessage="No YouTube timestamps available"
                isShared={isShared}
              >
                <YouTubeTimestampsTab timestamps={project.youtubeTimestamps} />
              </TabContent>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.socialPosts}
                error={project.jobErrors?.socialPosts}
                projectId={projectId}
                feature={FEATURES.SOCIAL_POSTS}
                featureName="Social Posts"
                jobName="socialPosts"
                emptyMessage="No social posts available"
                isShared={isShared}
              >
                <SocialPostsTab socialPosts={project.socialPosts} />
              </TabContent>
            </TabsContent>

            <TabsContent value="hashtags" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.hashtags}
                error={project.jobErrors?.hashtags}
                projectId={projectId}
                feature={FEATURES.HASHTAGS}
                featureName="Hashtags"
                jobName="hashtags"
                emptyMessage="No hashtags available"
                isShared={isShared}
              >
                <HashtagsTab hashtags={project.hashtags} />
              </TabContent>
            </TabsContent>

            <TabsContent value="powerpoint" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.powerPoint}
                error={project.jobErrors?.powerPoint}
                projectId={projectId}
                feature={FEATURES.POWERPOINT}
                featureName="PowerPoint Outline"
                jobName="powerPoint"
                emptyMessage="No PowerPoint outline yet"
                isShared={isShared}
              >
                <PowerPointTab powerPoint={project.powerPoint} />
              </TabContent>
            </TabsContent>

            <TabsContent value="titles" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.titles}
                error={project.jobErrors?.titles}
                projectId={projectId}
                feature={FEATURES.TITLES}
                featureName="AI Title Suggestions"
                jobName="titles"
                emptyMessage="No titles available"
                isShared={isShared}
              >
                <TitlesTab titles={project.titles} />
              </TabContent>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-4">
              <TabContent
                isLoading={showGenerating}
                data={project.engagement}
                error={project.jobErrors?.engagement}
                projectId={projectId}
                feature={FEATURES.ENGAGEMENT}
                featureName="Q&A"
                jobName="engagement"
                emptyMessage="Please generate Q&A here"
                isShared={isShared}
              >
                <EngagementTab
                  engagement={project.engagement}
                  projectName={project.displayName || project.fileName}
                />
              </TabContent>
            </TabsContent>

            {/* Speaker Dialogue - Only for audio files */}
            {!isDocument && (
              <TabsContent value="speakers" className="space-y-4">
                <TabContent
                  isLoading={showGenerating}
                  data={project.transcript}
                  projectId={projectId}
                  feature={FEATURES.SPEAKER_DIARIZATION}
                  featureName="Speaker Dialogue"
                  jobName="transcript"
                  emptyMessage="No transcript available"
                  isShared={isShared}
                >
                  {project.transcript && (
                    <TranscriptTab
                      projectId={projectId}
                      transcript={project.transcript}
                    />
                  )}
                </TabContent>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
