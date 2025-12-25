/**
 * Upgrade Page
 *
 * Displays pricing table with contextual messaging based on why user is upgrading.
 * Uses Clerk's PricingTable component to handle subscriptions.
 *
 * Query Parameters:
 * - reason: file_size | duration | projects | feature
 * - feature: (optional) specific feature name if reason=feature
 *
 * Examples:
 * - /dashboard/upgrade?reason=file_size
 * - /dashboard/upgrade?reason=projects
 * - /dashboard/upgrade?reason=feature
 */

import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Crown, Lock, Zap } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PricingTableWrapper } from "@/components/upgrade/pricing-table-wrapper";

interface UpgradePageProps {
  searchParams: Promise<{
    reason?: string;
    feature?: string;
  }>;
}

/**
 * Get contextual messaging based on upgrade reason
 */
function getUpgradeMessage(reason?: string, feature?: string) {
  switch (reason) {
    case "file_size":
      return {
        title: "File Size",
        description:
          "All plans support files of any size. If you're seeing this message, please contact support.",
        icon: Zap,
      };
    case "duration":
      return {
        title: "Duration",
        description:
          "All plans support unlimited duration. If you're seeing this message, please contact support.",
        icon: Zap,
      };
    case "projects":
      return {
        title: "You've Reached Your Project Limit",
        description:
          "Upgrade to create more projects. Pro: 30 projects, Ultra: unlimited projects.",
        icon: Lock,
      };
    case "feature":
      return {
        title: `Unlock ${feature || "Premium Features"}`,
        description:
          "Access advanced AI features like social posts, YouTube timestamps, and key moments by upgrading your plan.",
        icon: Lock,
      };
    default:
      return {
        title: "Upgrade Your Plan",
        description:
          "Get access to more projects, larger files, and advanced AI features.",
        icon: Zap,
      };
  }
}

/**
 * Detect current plan using Clerk's has() method
 */
function getCurrentPlan(authObj: Awaited<ReturnType<typeof auth>>) {
  const { has } = authObj;
  if (has?.({ plan: "ultra" })) return "ultra";
  if (has?.({ plan: "pro" })) return "pro";
  return "free";
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const { reason, feature } = await searchParams;
  const message = getUpgradeMessage(reason, feature);
  const Icon = message.icon;

  const authObj = await auth();
  const currentPlan = getCurrentPlan(authObj);

  return (
    <div className="min-h-screen mesh-background-subtle">
      {/* Header */}
      <div className="glass-nav border-b">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        {/* Contextual Message */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
            <Icon className="h-10 w-10 text-gray-700" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6">
            <span className="gradient-emerald-text">{message.title}</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            {message.description}
          </p>

          {/* Current Plan Badge */}
          <div className="flex items-center justify-center gap-2 text-base text-gray-600">
            <span>Current plan:</span>
            <Badge
              className={
                currentPlan === "ultra"
                  ? "gradient-emerald text-white px-4 py-1.5"
                  : "bg-gray-200 text-gray-700 px-4 py-1.5"
              }
            >
              {currentPlan === "ultra" && <Crown className="h-4 w-4 mr-1" />}
              {currentPlan === "free" && "Free"}
              {currentPlan === "pro" && "Pro"}
              {currentPlan === "ultra" && "Ultra"}
            </Badge>
          </div>
        </div>

        {/* Pricing Table */}
        <PricingTableWrapper />
      </div>
    </div>
  );
}
