"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { TabContent } from "@/components/project-detail/tab-content";
import {
  DesktopTabTrigger,
  MobileTabItem,
} from "@/components/project-detail/tab-triggers";
import { EngagementTab } from "@/components/project-tabs/engagement-tab";
import { HashtagsTab } from "@/components/project-tabs/hashtags-tab";
import { QuizTab } from "@/components/project-tabs/quiz-tab";
import { PowerPointTab } from "@/components/project-tabs/powerpoint-tab";
import { KeyMomentsTab } from "@/components/project-tabs/key-moments-tab";
import { SocialPostsTab } from "@/components/project-tabs/social-posts-tab";
import { SummaryTab } from "@/components/project-tabs/summary-tab";
import { TitlesTab } from "@/components/project-tabs/titles-tab";
import { TranscriptTab } from "@/components/project-tabs/transcript-tab";
import { YouTubeTimestampsTab } from "@/components/project-tabs/youtube-timestamps-tab";
import { ClinicalScenariosTab } from "@/components/project-tabs/clinical-scenarios-tab";
import { GenerateMissingCard } from "@/components/project-detail/generate-missing-card";
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
import type { Doc } from "@/convex/_generated/dataModel";

interface ProjectTabsWrapperProps {
  projectId: Id<"projects">;
  userId: string;
  project: Doc<"projects">;
  isDocument: boolean;
  isShared: boolean;
  showGenerating: boolean;
}

export function ProjectTabsWrapper({
  projectId,
  userId,
  project,
  isDocument,
  isShared,
  showGenerating,
}: ProjectTabsWrapperProps) {
  const [activeTab, setActiveTab] = useState("summary");

  // Determine which tabs to show based on project data and file type
  const hasHashtags = project.hashtags !== undefined;
  const hasQuiz = project.quiz !== undefined;
  const isOldProject = hasHashtags && !hasQuiz; // Old project with hashtags but no quiz
  const hasClinicalScenarios = project.clinicalScenarios !== undefined;
  const hasLegacyYouTubeTimestamps = project.youtubeTimestamps !== undefined;

  // Filter tabs based on file type and project state
  const visibleTabs = PROJECT_TABS.filter((tab) => {
    // File type filtering
    if (isDocument) {
      if (["moments", "youtube-timestamps", "social", "speakers"].includes(tab.value)) {
        return false;
      }
    }

    // Hide legacy YouTube tab once scenarios exist. For new uploads (no youtubeTimestamps), hide it too.
    if (tab.value === "youtube-timestamps") {
      return hasLegacyYouTubeTimestamps && !hasClinicalScenarios;
    }

    // Clinical scenarios tab is shown for new uploads and for migrated legacy projects.
    if (tab.value === "clinical-scenarios") {
      return !hasLegacyYouTubeTimestamps || hasClinicalScenarios;
    }

    // Conditional tab visibility for hashtags vs quiz
    if (tab.value === "hashtags") {
      // Show hashtags tab only for old projects (has hashtags, no quiz)
      return isOldProject;
    }

    if (tab.value === "quiz") {
      // Show quiz tab if project has quiz OR is a new project (no hashtags)
      return hasQuiz || !hasHashtags;
    }

    return true;
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

        {!hasClinicalScenarios && (
          <GenerateMissingCard
            projectId={projectId}
            message="Generate Clinical Scenarios for this legacy project"
            jobName="clinicalScenarios"
          />
        )}
      </TabsContent>

      <TabsContent value="clinical-scenarios" className="space-y-4">
        <TabContent
          isLoading={showGenerating}
          data={project.clinicalScenarios}
          error={project.jobErrors?.clinicalScenarios}
          projectId={projectId}
          feature={FEATURES.CLINICAL_SCENARIOS}
          featureName="Clinical Scenarios"
          jobName="clinicalScenarios"
          emptyMessage="No clinical scenarios available"
          isShared={isShared}
        >
          <ClinicalScenariosTab
            projectId={projectId}
            clinicalScenarios={project.clinicalScenarios}
            isLoading={showGenerating}
            userId={userId}
            projectCreatorId={project.userId}
          />
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

      {/* Hashtags Tab - Only shown for old projects with hashtags but no quiz */}
      {isOldProject && (
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
            <HashtagsTab
              hashtags={project.hashtags}
              projectId={projectId}
              hasQuiz={hasQuiz}
            />
          </TabContent>
        </TabsContent>
      )}

      {/* Quiz Tab - Shown if project has quiz OR is a new project */}
      {(hasQuiz || !hasHashtags) && (
        <TabsContent value="quiz" className="space-y-4 w-full max-w-full">
          <TabContent
            isLoading={showGenerating}
            data={project.quiz}
            error={project.jobErrors?.quiz}
            projectId={projectId}
            featureName="Quiz"
            jobName="quiz"
            emptyMessage="No quiz available yet"
            isShared={isShared}
          >
            <QuizTab quiz={project.quiz} projectId={projectId} isShared={isShared} />
          </TabContent>
        </TabsContent>
      )}

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
  );
}
