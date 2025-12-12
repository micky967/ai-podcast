"use client";

import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/projects/empty-state";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import {
  canUserCreateGroup,
  getSharingUpgradeMessage,
} from "@/lib/sharing-utils";
import {
  requestToJoinAction,
  cancelJoinRequestAction,
  acceptInvitationAction,
  declineInvitationAction,
} from "@/app/actions/sharing";
import { toast } from "sonner";
import { Users, UserPlus, Loader2, Clock, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

export function BrowseGroups() {
  const { userId, has } = useAuth();
  const router = useRouter();
  const [requestingGroups, setRequestingGroups] = useState<Set<string>>(
    new Set()
  );
  const [cancelingGroups, setCancelingGroups] = useState<Set<string>>(
    new Set()
  );
  const [acceptingGroups, setAcceptingGroups] = useState<Set<string>>(
    new Set()
  );
  const [decliningGroups, setDecliningGroups] = useState<Set<string>>(
    new Set()
  );
  const [ownerNames, setOwnerNames] = useState<Map<string, string>>(new Map());

  const groups = useQuery(
    api.sharingGroups.browseGroups,
    userId ? { userId } : "skip"
  );

  const userPlan = getCurrentPlan(has);
  const canJoin = canUserCreateGroup(userPlan);

  // Fetch owner names for groups with owner invites
  useEffect(() => {
    if (!groups || groups.length === 0) return;

    const fetchOwnerNames = async () => {
      const names = new Map<string, string>();
      const ownerIds = Array.from(
        new Set(
          groups
            .filter((g) => g.hasOwnerInvite && g.ownerId)
            .map((g) => g.ownerId)
        )
      );

      const namePromises = ownerIds.map(async (ownerId) => {
        try {
          const response = await fetch(`/api/users/${ownerId}/name`);
          if (response.ok) {
            const data = await response.json();
            return { userId: ownerId, name: data.name || ownerId };
          }
          return { userId: ownerId, name: ownerId };
        } catch {
          return { userId: ownerId, name: ownerId };
        }
      });

      const results = await Promise.all(namePromises);
      results.forEach(({ userId, name }) => {
        names.set(userId, name);
      });

      setOwnerNames(names);
    };

    fetchOwnerNames();
  }, [groups]);

  const handleRequestJoin = async (groupId: Id<"sharingGroups">) => {
    if (!canJoin) {
      toast.error(getSharingUpgradeMessage(userPlan));
      return;
    }

    setRequestingGroups((prev) => new Set(prev).add(groupId));
    try {
      const result = await requestToJoinAction(groupId);
      if (result.success) {
        toast.success(
          "Join request sent! The group owner will review your request."
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send join request");
      }
    } catch (error) {
      toast.error("Failed to send join request");
    } finally {
      setRequestingGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleCancelRequest = async (groupId: Id<"sharingGroups">) => {
    setCancelingGroups((prev) => new Set(prev).add(groupId));
    try {
      const result = await cancelJoinRequestAction(groupId);
      if (result.success) {
        toast.success("Join request cancelled");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel request");
      }
    } catch (error) {
      toast.error("Failed to cancel request");
    } finally {
      setCancelingGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleAcceptInvite = async (
    requestId: Id<"groupJoinRequests">,
    groupName: string
  ) => {
    setAcceptingGroups((prev) => new Set(prev).add(requestId));
    try {
      const result = await acceptInvitationAction({ requestId });
      if (result.success) {
        toast.success(
          `You've joined "${groupName}"! The group owner has been notified.`
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to accept invitation");
      }
    } catch (error) {
      toast.error("Failed to accept invitation");
    } finally {
      setAcceptingGroups((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDeclineInvite = async (
    requestId: Id<"groupJoinRequests">,
    groupName: string,
    ownerName: string
  ) => {
    setDecliningGroups((prev) => new Set(prev).add(requestId));
    try {
      // Decline by canceling the request (which will notify the owner via the request status change)
      // Actually, we should reject it so the owner knows it was declined
      const result = await declineInvitationAction({ requestId });
      if (result.success) {
        toast.success(
          `You've declined the invitation. ${ownerName} has been notified.`
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to decline invitation");
      }
    } catch (error) {
      toast.error("Failed to decline invitation");
    } finally {
      setDecliningGroups((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (groups === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No groups available"
        description={
          canJoin
            ? "There are no groups available to join at the moment. Create your own group to get started!"
            : getSharingUpgradeMessage(userPlan)
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groups.map((group) => {
        const isRequesting = requestingGroups.has(group.groupId);
        return (
          <Card
            key={group.groupId}
            className="p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  {group.name || "Unnamed Group"}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {group.memberCount}{" "}
                  {group.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
            </div>

            {group.hasOwnerInvite && group.inviteRequestId ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-900 font-medium">
                    {ownerNames.get(group.ownerId) || "Someone"} invited you to
                    join this group
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      handleAcceptInvite(
                        group.inviteRequestId!,
                        group.name || "Unnamed Group"
                      )
                    }
                    disabled={acceptingGroups.has(group.inviteRequestId!)}
                    className="flex-1 gradient-emerald text-white hover-glow"
                  >
                    {acceptingGroups.has(group.inviteRequestId!) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDeclineInvite(
                        group.inviteRequestId!,
                        group.name || "Unnamed Group",
                        ownerNames.get(group.ownerId) || "The owner"
                      )
                    }
                    disabled={decliningGroups.has(group.inviteRequestId!)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {decliningGroups.has(group.inviteRequestId!) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Declining...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Decline
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {group.hasPendingRequest ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelRequest(group.groupId)}
                    disabled={cancelingGroups.has(group.groupId)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {cancelingGroups.has(group.groupId) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancel Request
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleRequestJoin(group.groupId)}
                    disabled={!canJoin || isRequesting}
                    className="flex-1 gradient-emerald text-white hover-glow"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Request to Join
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
