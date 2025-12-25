"use client";

import { Protect, useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import type { RetryableJob } from "@/app/actions/retry-job";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FeatureName } from "@/lib/tier-config";
import { FEATURES } from "@/lib/tier-config";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { ErrorRetryCard } from "./error-retry-card";
import { GenerateMissingCard } from "./generate-missing-card";
import { TabSkeleton } from "./tab-skeleton";
import { UpgradePrompt } from "./upgrade-prompt";

interface TabContentProps {
  isLoading: boolean;
  data: unknown;
  error?: string;
  children: React.ReactNode;
  // Optional props for enhanced error/empty handling
  projectId?: Id<"projects">;
  feature?: FeatureName;
  featureName?: string;
  jobName?: RetryableJob;
  emptyMessage?: string;
  // If project is shared, bypass plan restrictions (viewer should see owner's content)
  isShared?: boolean;
}

/**
 * Enhanced TabContent wrapper component
 *
 * Handles common patterns across all tabs:
 * 1. Loading state (shows skeleton)
 * 2. Error state (shows retry card)
 * 3. Empty state (shows generate missing card)
 * 4. Content rendering with optional feature gating
 */
export function TabContent({
  isLoading,
  data,
  error,
  children,
  projectId,
  feature,
  featureName,
  jobName,
  emptyMessage = "No data available",
  isShared = false,
}: TabContentProps) {
  const { userId, has } = useAuth();
  const { user } = useUser();
  const previousPlanRef = useRef<string | null>(null);

  // Check if user is owner - owners bypass plan restrictions
  const isOwner = useQuery(
    api.userSettings.isUserOwner,
    userId ? { userId } : "skip"
  );

  // Get current plan for upgrade prompts
  const currentPlan = getCurrentPlan(has as any);

  // Detect plan changes and refresh the page to update Clerk session
  // Only refreshes when plan actually changes (not on every render)
  useEffect(() => {
    if (user && has) {
      const currentPlanKey = has({ plan: "ultra" })
        ? "ultra"
        : has({ plan: "pro" })
        ? "pro"
        : "free";

      // Only refresh when plan actually changes (not on every render)
      if (
        previousPlanRef.current !== null &&
        previousPlanRef.current !== currentPlanKey
      ) {
        // Small delay to ensure Clerk has updated, then refresh once
        const timer = setTimeout(() => {
          window.location.reload();
        }, 1500);
        return () => clearTimeout(timer);
      }

      // Update previous plan only if it's different (prevents re-triggering)
      if (previousPlanRef.current !== currentPlanKey) {
        previousPlanRef.current = currentPlanKey;
      }
    } else if (!previousPlanRef.current && user) {
      // Initialize on first load
      const currentPlanKey = has?.({ plan: "ultra" })
        ? "ultra"
        : has?.({ plan: "pro" })
        ? "pro"
        : "free";
      previousPlanRef.current = currentPlanKey;
    }
  }, [user, has]);

  // Helper to wrap content with feature gating if needed
  // Owners and shared project viewers bypass all plan/role restrictions
  const wrapWithProtect = (content: React.ReactNode) => {
    // If project is shared, show content without plan restrictions (read-only viewing)
    // Shared projects allow viewers to see all content regardless of their plan
    if (isShared) {
      return content;
    }

    // Owners bypass all plan restrictions (explicitly check for true)
    if (isOwner === true) {
      return content;
    }

    // No feature requirement - available to all
    if (!feature || !featureName) return content;

    // Special exception: Allow free users to access Q&A on their own uploaded files
    // This matches the behavior where free users can see Q&A in shared files
    // If the project is not shared (meaning it's the user's own project), allow Q&A access
    // Note: Users can only view their own non-shared projects, so !isShared means it's their project
    if (feature === FEATURES.ENGAGEMENT && projectId && userId && !isShared) {
      return content;
    }

    // Use Clerk's Protect component to check feature access
    // This checks BOTH plan permissions (free/pro/ultra) AND role permissions (user/admin/owner)
    // Free users without the feature will see the upgrade prompt
    return (
      <Protect
        feature={feature}
        fallback={
          <UpgradePrompt
            feature={featureName}
            featureKey={feature}
            currentPlan={currentPlan}
          />
        }
      >
        {content}
      </Protect>
    );
  };

  // Loading state
  if (isLoading) {
    return <TabSkeleton />;
  }

  // If feature is provided, always wrap with protection (even if projectId/jobName missing)
  // This ensures locked tabs show upgrade prompt
  if (feature && featureName) {
    // If we don't have projectId/jobName, just wrap children with protection
    if (!projectId || !jobName) {
      return wrapWithProtect(children);
    }
  } else {
    // No feature, simple pass-through if enhanced props not provided (backward compatible)
    if (!projectId || !jobName) {
      return <>{children}</>;
    }
  }

  // Error state
  if (error) {
    return wrapWithProtect(
      <ErrorRetryCard
        projectId={projectId}
        job={jobName}
        errorMessage={error}
      />
    );
  }

  // Empty state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return wrapWithProtect(
      <GenerateMissingCard
        projectId={projectId}
        message={emptyMessage}
        jobName={jobName}
      />
    );
  }

  // Content rendering
  return wrapWithProtect(children);
}
