"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Users, Trash2, Crown, Lock, Sparkles } from "lucide-react";
import { adminDeleteGroupAction } from "@/app/actions/sharing";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { PLAN_NAMES, PLAN_PRICES, PLAN_FEATURES } from "@/lib/tier-config";
import Link from "next/link";

interface AdminSharingProps {
  adminId: string;
}

export function AdminSharing({ adminId }: AdminSharingProps) {
  const router = useRouter();
  const { has } = useAuth();
  const userPlan = getCurrentPlan(has);
  
  const allGroups = useQuery(api.sharingGroups.listAllGroups, {
    adminId,
  });

  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  // Show upgrade prompt for free plan users
  if (userPlan === "free") {
    const planFeatures = PLAN_FEATURES.pro;
    const planName = PLAN_NAMES.pro;
    const planPrice = PLAN_PRICES.pro;

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold mb-4">All Sharing Groups</h2>
        <div className="glass-card rounded-3xl border-2 border-dashed border-emerald-200">
          <div className="text-center p-8 md:p-12">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <Lock className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3">
              File Sharing Locked
            </h3>
            <p className="text-base md:text-lg text-gray-600 mb-8">
              File sharing is available on the{" "}
              <strong className="text-emerald-600">{planName}</strong> or{" "}
              <strong className="text-emerald-600">{PLAN_NAMES.ultra}</strong> plan
            </p>

            {/* Feature List */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 md:p-8 mb-8 text-left">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-6 w-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-base md:text-lg mb-4 text-gray-900">
                    Unlock File Sharing and more with {planName}:
                  </p>
                  <ul className="space-y-3 text-sm md:text-base text-gray-700">
                    <li className="flex items-center gap-3">
                      <span className="text-emerald-600 font-bold text-lg">✓</span>
                      <span className="font-medium">File Sharing Groups</span>
                    </li>
                    {planFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <span className="text-emerald-600 font-bold text-lg">✓</span>
                        <span className="font-medium">
                          {feat
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="text-center mb-6">
              <p className="text-gray-600 mb-6">
                Starting at{" "}
                <span className="font-extrabold text-2xl md:text-3xl text-gray-900">
                  {planPrice}
                </span>
              </p>

              {/* CTA Button */}
              <Link href="/dashboard/upgrade?reason=feature&feature=File Sharing">
                <Button
                  size="lg"
                  className="gradient-emerald text-white hover-glow px-8 md:px-10 py-5 md:py-6 text-base md:text-lg rounded-xl font-bold w-full md:w-auto"
                >
                  Upgrade to {planName}
                </Button>
              </Link>
            </div>

            <p className="text-sm text-gray-500">
              Cancel anytime. No long-term contracts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch user names
  useEffect(() => {
    if (!allGroups) return;

    const fetchUserNames = async () => {
      const names = new Map<string, string>();
      const userIds = new Set<string>();

      allGroups.forEach((group) => {
        userIds.add(group.ownerId);
      });

      const namePromises = Array.from(userIds).map(async (userId) => {
        try {
          const response = await fetch(`/api/users/${userId}/name`);
          if (response.ok) {
            const data = await response.json();
            return { userId, name: data.name || userId };
          }
          return { userId, name: userId };
        } catch {
          return { userId, name: userId };
        }
      });

      const results = await Promise.all(namePromises);
      results.forEach(({ userId, name }) => {
        names.set(userId, name);
      });

      setUserNames(names);
    };

    fetchUserNames();
  }, [allGroups]);

  const handleDeleteGroup = async (groupId: Id<"sharingGroups">) => {
    if (
      !confirm(
        "Are you sure you want to delete this group? All members will lose access.",
      )
    ) {
      return;
    }

    try {
      const result = await adminDeleteGroupAction(groupId);
      if (result.success) {
        toast.success("Group deleted successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete group");
      }
    } catch (error) {
      toast.error("Failed to delete group");
    }
  };

  if (allGroups === undefined) {
    return <div>Loading groups...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">All Sharing Groups</h2>
      {allGroups.length === 0 ? (
        <p className="text-gray-600">No groups found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allGroups.map((group) => {
            const ownerName = userNames.get(group.ownerId) || group.ownerId;
            return (
              <Card key={group.groupId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {group.name || "Unnamed Group"}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Owner: {ownerName}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteGroup(group.groupId)}
                  className="w-full mt-4"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

