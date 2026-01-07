"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateMissingFeatures } from "@/app/actions/generate-missing-features";
import { type RetryableJob, retryJob } from "@/app/actions/retry-job";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { GeneratingSpinner } from "./generating-spinner";

// Friendly display names for job types
const JOB_DISPLAY_NAMES: Record<string, string> = {
  clinicalScenarios: "Clinical Scenarios",
  engagement: "Q&A Content",
  summary: "Summary",
  keyMoments: "Key Moments",
  socialPosts: "Social Posts",
  titles: "Titles",
  powerPoint: "PowerPoint Outline",
  youtubeTimestamps: "YouTube Timestamps",
  hashtags: "Hashtags",
  quiz: "Quiz",
};

// Descriptions for each job type
const JOB_DESCRIPTIONS: Record<string, string> = {
  clinicalScenarios: "Creating USMLE-style clinical vignettes and QBank questions from your content. This usually takes 30-60 seconds.",
  engagement: "Generating Q&A content, pin-worthy comments, and community post ideas. This usually takes 20-40 seconds.",
  summary: "Creating a comprehensive summary of your content. This usually takes 15-30 seconds.",
  keyMoments: "Identifying key moments and highlights. This usually takes 15-30 seconds.",
  socialPosts: "Crafting engaging social media posts. This usually takes 15-30 seconds.",
  titles: "Generating creative title suggestions. This usually takes 10-20 seconds.",
  powerPoint: "Creating a PowerPoint outline. This usually takes 20-40 seconds.",
  youtubeTimestamps: "Generating YouTube-friendly timestamps. This usually takes 15-30 seconds.",
  hashtags: "Creating relevant hashtags. This usually takes 10-20 seconds.",
  quiz: "Building quiz questions. This usually takes 20-40 seconds.",
};

interface GenerateMissingCardProps {
  projectId: Id<"projects">;
  message?: string;
  className?: string;
  // If jobName is provided, generate only that specific job instead of all missing
  jobName?: RetryableJob;
}

export function GenerateMissingCard({
  projectId,
  message,
  className = "",
  jobName,
}: GenerateMissingCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // If jobName is provided, generate only that specific job
      if (jobName) {
        await retryJob(projectId, jobName);
        toast.success(`Generating ${JOB_DISPLAY_NAMES[jobName] || jobName}...`);
      } else {
        // Otherwise, generate all missing features
        const result = await generateMissingFeatures(projectId);
        toast.success(result.message);
      }
      // Keep isGenerating true - the spinner will show until data appears
      // The parent component will re-render with data and this component won't be shown anymore
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate features"
      );
      setIsGenerating(false);
    }
  };

  // Show beautiful spinner while generating
  if (isGenerating) {
    const displayName = jobName ? JOB_DISPLAY_NAMES[jobName] || jobName : "Content";
    const description = jobName 
      ? JOB_DESCRIPTIONS[jobName] || "Our AI is generating content from your transcript. This usually takes 30-60 seconds."
      : "Our AI is generating all missing features from your transcript. This may take a minute or two.";
    
    return (
      <GeneratingSpinner 
        title={`Generating ${displayName}...`}
        description={description}
      />
    );
  }

  return (
    <div
      className={`glass-card rounded-2xl p-12 text-center space-y-6 ${className}`}
    >
      <p className="text-gray-600 text-lg">
        {message || "No content available"}
      </p>
      <p className="text-sm text-gray-500">
        It looks like this project was processed before you upgraded.
      </p>
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="gradient-emerald text-white hover-glow shadow-lg px-6 py-3 gap-2 cursor-pointer"
      >
        <Sparkles className="h-5 w-5" />
        {jobName
          ? `Generate ${JOB_DISPLAY_NAMES[jobName] || jobName}`
          : "Generate All Missing Features"}
      </Button>
      <p className="text-xs text-gray-500">
        {jobName
          ? `This will generate ${JOB_DISPLAY_NAMES[jobName] || jobName} for this project`
          : "This will generate all features available in your current plan"}
      </p>
    </div>
  );
}
