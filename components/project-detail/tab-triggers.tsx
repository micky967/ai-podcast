/**
 * Tab Trigger Components for Project Detail Page
 *
 * Reusable components to render tab triggers consistently across
 * mobile dropdown and desktop tabs, using centralized configuration.
 */

"use client";

import React, { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { AlertCircle, Lock } from "lucide-react";
import { SelectItem } from "@/components/ui/select";
import { TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { TabConfig } from "@/lib/tab-config";
import { FEATURES } from "@/lib/tier-config";

interface TabTriggerItemProps {
  tab: TabConfig;
  project: Doc<"projects">;
  isShared?: boolean;
}

/**
 * Mobile dropdown item for a tab
 */
export function MobileTabItem({
  tab,
  project,
  isShared = false,
}: TabTriggerItemProps) {
  const { userId, has } = useAuth();
  const { user } = useUser();
  const previousPlanRef = useRef<string | null>(null);

  // Check if user is owner - owners bypass plan restrictions
  const isOwner = useQuery(
    api.userSettings.isUserOwner,
    userId ? { userId } : "skip"
  );

  // Detect plan changes and refresh to update Clerk session
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
        const timer = setTimeout(() => {
          window.location.reload();
        }, 1500);
        return () => clearTimeout(timer);
      }

      if (previousPlanRef.current !== currentPlanKey) {
        previousPlanRef.current = currentPlanKey;
      }
    } else if (!previousPlanRef.current && user) {
      const currentPlanKey = has?.({ plan: "ultra" })
        ? "ultra"
        : has?.({ plan: "pro" })
        ? "pro"
        : "free";
      previousPlanRef.current = currentPlanKey;
    }
  }, [user, has]);

  const hasError =
    tab.errorKey &&
    project.jobErrors?.[tab.errorKey as keyof typeof project.jobErrors];

  // Simple lock icon logic: Show lock if tab has a feature AND user doesn't have access (and isn't owner)
  // Shared projects: no lock icons (viewers can see all content in read-only mode)
  // Special exception: Q&A (engagement) is accessible to free users on their own projects
  // This checks both plan permissions (free/pro/ultra) and role permissions (user/admin/owner)
  const shouldShowLock = React.useMemo(() => {
    // No feature = no lock (available to all)
    if (!tab.feature) return false;

    // Shared projects: no lock icons (viewers get read-only access to all content)
    if (isShared) return false;

    // Special exception: Q&A is accessible to free users on their own projects (not shared)
    // Don't show lock icon for Q&A on user's own projects
    if (tab.feature === FEATURES.ENGAGEMENT && !isShared) {
      return false;
    }

    // Owner check still loading = don't show lock yet
    if (isOwner === undefined) return false;

    // Owners bypass restrictions = no lock
    if (isOwner === true) return false;

    // Check Clerk feature access - show lock if user doesn't have it
    // This checks plan and role permissions via Clerk
    if (has) {
      return !has({ feature: tab.feature });
    }

    // If has function not available, assume no access = show lock
    return true;
  }, [tab.feature, isShared, isOwner, has]);

  // Dynamic label for titles tab - show "Flashcards" if flashcards have been generated
  const displayLabel = React.useMemo(() => {
    if (tab.value === "titles") {
      const flashcardStatus = (project as any).flashcardStatus;
      if (flashcardStatus === "completed" || flashcardStatus === "generating") {
        return "Flashcards";
      }
    }
    return tab.label;
  }, [tab.value, tab.label, project]);

  return (
    <SelectItem value={tab.value}>
      <span className="flex items-center gap-2">
        {displayLabel}
        {shouldShowLock && (
          <Lock
            className="h-3 w-3 text-red-600 shrink-0"
            style={{ color: "#dc2626" }}
          />
        )}
        {hasError && (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
      </span>
    </SelectItem>
  );
}

/**
 * Desktop tab trigger for a tab
 */
export function DesktopTabTrigger({
  tab,
  project,
  isShared = false,
}: TabTriggerItemProps) {
  const { userId, has } = useAuth();
  const { user } = useUser();
  const previousPlanRef = useRef<string | null>(null);

  // Check if user is owner - owners bypass plan restrictions
  const isOwner = useQuery(
    api.userSettings.isUserOwner,
    userId ? { userId } : "skip"
  );

  // Detect plan changes and refresh to update Clerk session
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
        const timer = setTimeout(() => {
          window.location.reload();
        }, 1500);
        return () => clearTimeout(timer);
      }

      if (previousPlanRef.current !== currentPlanKey) {
        previousPlanRef.current = currentPlanKey;
      }
    } else if (!previousPlanRef.current && user) {
      const currentPlanKey = has?.({ plan: "ultra" })
        ? "ultra"
        : has?.({ plan: "pro" })
        ? "pro"
        : "free";
      previousPlanRef.current = currentPlanKey;
    }
  }, [user, has]);

  const hasError =
    tab.errorKey &&
    project.jobErrors?.[tab.errorKey as keyof typeof project.jobErrors];

  // Simple lock icon logic: Show lock if tab has a feature AND user doesn't have access (and isn't owner)
  // Shared projects: no lock icons (viewers can see all content in read-only mode)
  // Special exception: Q&A (engagement) is accessible to free users on their own projects
  // This checks both plan permissions (free/pro/ultra) and role permissions (user/admin/owner)
  const shouldShowLock = React.useMemo(() => {
    // No feature = no lock (available to all)
    if (!tab.feature) return false;

    // Shared projects: no lock icons (viewers get read-only access to all content)
    if (isShared) return false;

    // Special exception: Q&A is accessible to free users on their own projects (not shared)
    // Don't show lock icon for Q&A on user's own projects
    if (tab.feature === FEATURES.ENGAGEMENT && !isShared) {
      return false;
    }

    // Owner check still loading = don't show lock yet
    if (isOwner === undefined) return false;

    // Owners bypass restrictions = no lock
    if (isOwner === true) return false;

    // Check Clerk feature access - show lock if user doesn't have it
    // This checks plan and role permissions via Clerk
    if (has) {
      return !has({ feature: tab.feature });
    }

    // If has function not available, assume no access = show lock
    return true;
  }, [tab.feature, isShared, isOwner, has]);

  // Dynamic label for titles tab - show "Flashcards" if flashcards have been generated
  const displayLabel = React.useMemo(() => {
    if (tab.value === "titles") {
      const flashcardStatus = (project as any).flashcardStatus;
      if (flashcardStatus === "completed" || flashcardStatus === "generating") {
        return "Flashcards";
      }
    }
    return tab.label;
  }, [tab.value, tab.label, project]);

  return (
    <TabsTrigger
      value={tab.value}
      className="flex items-center gap-0.5 px-2 sm:px-2.5 md:px-3 py-2 sm:py-2.5 rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-400 data-[state=active]:text-white transition-all font-semibold whitespace-nowrap cursor-pointer text-xs sm:text-sm md:text-base shrink-0 flex-shrink-0"
    >
      <span className="inline-flex items-center gap-0.5">
        {shouldShowLock && (
          <Lock
            className="size-[12px] text-red-600 shrink-0 relative top-[1px] mr-0.5"
            style={{ color: "#dc2626" }}
          />
        )}
        {hasError && (
          <AlertCircle className="size-[12px] text-destructive shrink-0 relative top-[1px] mr-0.5" />
        )}
        {displayLabel}
      </span>
    </TabsTrigger>
  );
}
