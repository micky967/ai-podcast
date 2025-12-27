"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupMembersModal } from "./group-members-modal";
import { leaveGroupAction } from "@/app/actions/sharing";
import { toast } from "sonner";
import { Users, Crown, Trash2, LogOut, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteGroupAction } from "@/app/actions/sharing";

interface Group {
  groupId: Id<"sharingGroups">;
  name?: string;
  ownerId: string;
  isOwner: boolean;
  canDelete?: boolean; // Group owner or app owner can delete
  memberCount: number;
  createdAt: number;
}

interface SharingGroupCardProps {
  group: Group;
}

export function SharingGroupCard({ group }: SharingGroupCardProps) {
  const { userId: currentUserId } = useAuth();
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [ownerImageUrl, setOwnerImageUrl] = useState<string | null>(null);
  const [ownerInitials, setOwnerInitials] = useState<string>("");
  const router = useRouter();

  // Fetch owner name and avatar from Clerk
  useEffect(() => {
    const fetchOwnerInfo = async () => {
      if (!group.ownerId) return;

      try {
        const response = await fetch(`/api/users/${group.ownerId}/name`);
        if (response.ok) {
          const data = await response.json();
          setOwnerName(data.name || group.ownerId);
          setOwnerImageUrl(data.imageUrl || null);

          // Use initials from API if available (for owner it will be "A")
          if (data.initials) {
            setOwnerInitials(data.initials);
          } else {
            // Fallback: Generate initials from firstName and lastName, or from name
            if (data.firstName && data.lastName) {
              setOwnerInitials(
                `${data.firstName[0]}${data.lastName[0]}`.toUpperCase()
              );
            } else if (data.name) {
              // Fallback: extract first letters of first two words
              const nameParts = data.name.trim().split(/\s+/);
              if (nameParts.length >= 2) {
                setOwnerInitials(
                  `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
                );
              } else if (nameParts.length === 1) {
                setOwnerInitials(nameParts[0][0].toUpperCase());
              }
            }
          }
        } else {
          setOwnerName(group.ownerId);
        }
      } catch {
        setOwnerName(group.ownerId);
      }
    };

    fetchOwnerInfo();
  }, [group.ownerId]);

  // CRITICAL: Don't trust the group.ownerId from getUserGroups - always verify with server
  // The server query fetches the group directly from DB and compares IDs
  const deletePermission = useQuery(
    api.sharingGroups.canDeleteGroup,
    currentUserId
      ? { groupId: group.groupId, requesterId: currentUserId }
      : "skip"
  );

  // ONLY trust the server's response - don't use group.ownerId from getUserGroups
  // The server fetches the group fresh from the database and compares IDs
  // CRITICAL: Require ALL checks to pass - be extra strict
  const canDelete =
    deletePermission !== undefined &&
    deletePermission?.canDelete === true &&
    deletePermission?.isGroupOwner === true &&
    deletePermission?.idsMatch === true &&
    (deletePermission as any)?.groupOwnerId ===
      (deletePermission as any)?.requesterId; // Extra explicit check

  // Security check: Only log warning if canDelete is true but user is NOT owner AND NOT app owner
  // This should never happen in normal flow, so it's a security concern
  // Suppressed - this was causing false positives when properties don't exist in error responses

  const handleLeaveClick = () => {
    setLeaveConfirmOpen(true);
  };

  const handleCancelLeave = () => {
    setLeaveConfirmOpen(false);
  };

  const handleConfirmLeave = async () => {
    setLeaveConfirmOpen(false);
    setIsLeaving(true);
    try {
      const result = await leaveGroupAction(group.groupId);
      if (result.success) {
        toast.success("Left group successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to leave group");
      }
    } catch (error) {
      toast.error("Failed to leave group");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteClick = () => {
    // Show confirmation modal instead of default confirm dialog
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    // CRITICAL: Multiple server-side checks - don't trust any client-side data
    // Check 1: Server query must have completed
    if (deletePermission === undefined) {
      toast.error("Please wait while we verify permissions...");
      setDeleteConfirmOpen(false);
      return;
    }

    // Check 2: Server must explicitly say user can delete
    if (!deletePermission.canDelete) {
      toast.error("Unauthorized: Only the group owner can delete the group");
      setDeleteConfirmOpen(false);
      return;
    }

    // Check 3: Server must confirm user is group owner (not just app owner)
    if (!deletePermission.isGroupOwner) {
      toast.error("Unauthorized: Only the group owner can delete the group");
      setDeleteConfirmOpen(false);
      return;
    }

    // Check 4: IDs must match exactly (server verified)
    if (!deletePermission.idsMatch) {
      toast.error("Unauthorized: User ID mismatch");
      setDeleteConfirmOpen(false);
      return;
    }

    // Check 5: Explicit ID comparison (extra safety)
    if (
      (deletePermission as any).groupOwnerId !==
      (deletePermission as any).requesterId
    ) {
      toast.error("Unauthorized: User ID does not match group owner");
      setDeleteConfirmOpen(false);
      return;
    }

    // Check 6: Verify currentUserId matches requesterId from server
    if (
      currentUserId?.trim() !== (deletePermission as any).requesterId?.trim()
    ) {
      toast.error("Unauthorized: Session mismatch");
      setDeleteConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteGroupAction(group.groupId);
      if (result.success) {
        toast.success("Group deleted successfully");
        setDeleteConfirmOpen(false);
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

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold">
                {group.name || "Unnamed Group"}
              </h3>
              {group.isOwner && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Owner
                </Badge>
              )}
            </div>
            {ownerName && (
              <div className="flex items-center gap-2 mb-2">
                {ownerImageUrl ? (
                  <img
                    src={ownerImageUrl}
                    alt={ownerName}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : ownerInitials ? (
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700">
                    {ownerInitials}
                  </div>
                ) : null}
                <p className="text-sm text-gray-500">Created by {ownerName}</p>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">
              {group.memberCount}{" "}
              {group.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMembersModalOpen(true)}
            className="flex-1"
          >
            <Users className="mr-2 h-4 w-4" />
            View Members
          </Button>
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteClick}
              disabled={isDeleting || deletePermission === undefined}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeaveClick}
              disabled={isLeaving}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      <GroupMembersModal
        groupId={group.groupId}
        isOwner={group.isOwner}
        open={membersModalOpen}
        onOpenChange={setMembersModalOpen}
      />

      {/* Leave Group Confirmation Dialog */}
      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave "{group.name || "this group"}"? You
              will lose access to all shared files from this group. You can
              request to rejoin later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelLeave}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLeave}
              disabled={isLeaving}
              className="gradient-emerald text-white hover-glow"
            >
              {isLeaving ? "Leaving..." : "Leave Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
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
              Are you sure you want to delete{" "}
              <strong>"{group.name || "this group"}"</strong>? All members will
              lose access to all shared files in this group.
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
              onClick={() => setDeleteConfirmOpen(false)}
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
    </>
  );
}
