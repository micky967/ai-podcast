"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateMissingFeatures } from "@/app/actions/generate-missing-features";
import { type RetryableJob, retryJob } from "@/app/actions/retry-job";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";

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
        toast.success(`Generating ${jobName}...`);
      } else {
        // Otherwise, generate all missing features
        const result = await generateMissingFeatures(projectId);
        toast.success(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate features"
      );
    } finally {
      setIsGenerating(false);
    }
  };

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
        className="gradient-emerald text-white hover-glow shadow-lg px-6 py-3 gap-2"
      >
        <Sparkles className="h-5 w-5" />
        {isGenerating
          ? "Generating..."
          : jobName
          ? `Generate ${jobName}`
          : "Generate All Missing Features"}
      </Button>
      <p className="text-xs text-gray-500">
        {jobName
          ? `This will generate ${jobName} for this project`
          : "This will generate all features available in your current plan"}
      </p>
    </div>
  );
}
