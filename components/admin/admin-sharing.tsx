"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import {
  Users,
  Trash2,
  Crown,
  Lock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { adminDeleteGroupAction } from "@/app/actions/sharing";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { PLAN_NAMES, PLAN_PRICES, PLAN_FEATURES } from "@/lib/tier-config";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminSharingProps {
  adminId: string;
}

export function AdminSharing({ adminId }: AdminSharingProps) {
  const router = useRouter();
  const { has } = useAuth();
  const userPlan = getCurrentPlan(has as any);

  const allGroups = useQuery(api.sharingGroups.listAllGroups, {
    adminId,
  });

  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [userAvatars, setUserAvatars] = useState<Map<string, string | null>>(
    new Map()
  );
  const [userInitials, setUserInitials] = useState<Map<string, string>>(
    new Map()
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] =
    useState<Id<"sharingGroups"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
              <strong className="text-emerald-600">{PLAN_NAMES.ultra}</strong>{" "}
              plan
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
                      <span className="text-emerald-600 font-bold text-lg">
                        ✓
                      </span>
                      <span className="font-medium">File Sharing Groups</span>
                    </li>
                    {planFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <span className="text-emerald-600 font-bold text-lg">
                          ✓
                        </span>
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
              <Link
                href="/dashboard/upgrade?reason=feature&feature=File Sharing"
                prefetch={true}
                onMouseEnter={() => router.prefetch("/dashboard/upgrade")}
              >
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

  // Fetch user names, avatars, and initials
  useEffect(() => {
    if (!allGroups) return;

    const fetchUserInfo = async () => {
      const names = new Map<string, string>();
      const avatars = new Map<string, string | null>();
      const initialsMap = new Map<string, string>();
      const userIds = new Set<string>();

      allGroups.forEach((group) => {
        userIds.add(group.ownerId);
      });

      const infoPromises = Array.from(userIds).map(async (userId) => {
        try {
          const response = await fetch(`/api/users/${userId}/name`);
          if (response.ok) {
            const data = await response.json();
            const name = data.name || userId;

            // Use initials from API if available (for owner it will be "A")
            let initial = data.initials || "";
            if (!initial) {
              // Fallback: Generate initials
              if (data.firstName && data.lastName) {
                initial = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
              } else if (data.name) {
                const nameParts = data.name.trim().split(/\s+/);
                if (nameParts.length >= 2) {
                  initial = `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
                } else if (nameParts.length === 1) {
                  initial = nameParts[0][0].toUpperCase();
                }
              }
            }

            return {
              userId,
              name,
              imageUrl: data.imageUrl || null,
              initials: initial,
            };
          }
          return { userId, name: userId, imageUrl: null, initials: "" };
        } catch {
          return { userId, name: userId, imageUrl: null, initials: "" };
        }
      });

      const results = await Promise.all(infoPromises);
      results.forEach(({ userId, name, imageUrl, initials }) => {
        names.set(userId, name);
        avatars.set(userId, imageUrl);
        initialsMap.set(userId, initials);
      });

      setUserNames(names);
      setUserAvatars(avatars);
      setUserInitials(initialsMap);
    };

    fetchUserInfo();
  }, [allGroups]);

  const handleDeleteClick = (groupId: Id<"sharingGroups">) => {
    setDeleteConfirmOpen(groupId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmOpen) return;

    setIsDeleting(true);
    try {
      const result = await adminDeleteGroupAction(deleteConfirmOpen);
      if (result.success) {
        toast.success("Group deleted successfully");
        setDeleteConfirmOpen(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete group");
      }
    } catch (error) {
      toast.error("Failed to delete group");
    } finally {
      setIsDeleting(false);
    }
  };

  if (allGroups === undefined) {
    return <div>Loading groups...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">All Sharing Groups</h2>
      {allGroups.length === 0 ? (
        <p className="text-gray-600">No groups found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allGroups.map((group) => {
            const ownerName = userNames.get(group.ownerId) || group.ownerId;
            const ownerAvatar = userAvatars.get(group.ownerId);
            const ownerInitials = userInitials.get(group.ownerId) || "";
            return (
              <Card key={group.groupId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {group.name || "Unnamed Group"}
                    </h3>
                    {ownerName && (
                      <div className="flex items-center gap-2 mt-1">
                        {ownerAvatar ? (
                          <img
                            src={ownerAvatar}
                            alt={ownerName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : ownerInitials ? (
                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700">
                            {ownerInitials}
                          </div>
                        ) : null}
                        <p className="text-sm text-gray-600">
                          Created by {ownerName}
                        </p>
                      </div>
                    )}
                    <Badge variant="secondary" className="mt-2">
                      {group.memberCount}{" "}
                      {group.memberCount === 1 ? "member" : "members"}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(group.groupId)}
                  disabled={isDeleting}
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

      {/* Delete Group Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen !== null}
        onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Delete Group?</DialogTitle>
                <DialogDescription className="mt-1">
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to delete this group? All members will lose
              access to all shared files in this group.
            </p>
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-900 mb-1">
                What happens next:
              </p>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                <li>All members will lose access to files in this group</li>
                <li>
                  They will no longer receive notifications for this group
                </li>
                <li>The group and all its data will be permanently deleted</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(null)}
              disabled={isDeleting}
              className="sm:flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 hover:text-white sm:flex-1"
            >
              {isDeleting ? "Deleting..." : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
