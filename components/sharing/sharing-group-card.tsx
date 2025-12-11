"use client";

import { useState } from "react";
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
import { Users, Crown, Trash2, LogOut } from "lucide-react";
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
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // CRITICAL: Don't trust the group.ownerId from getUserGroups - always verify with server
  // The server query fetches the group directly from DB and compares IDs
  const deletePermission = useQuery(
    api.sharingGroups.canDeleteGroup,
    currentUserId ? { groupId: group.groupId, requesterId: currentUserId } : "skip"
  );

  // ONLY trust the server's response - don't use group.ownerId from getUserGroups
  // The server fetches the group fresh from the database and compares IDs
  // CRITICAL: Require ALL checks to pass - be extra strict
  const canDelete = deletePermission !== undefined &&
                    deletePermission?.canDelete === true &&
                    deletePermission?.isGroupOwner === true &&
                    deletePermission?.idsMatch === true &&
                    deletePermission?.groupOwnerId === deletePermission?.requesterId; // Extra explicit check

  // Enhanced debug logging - ALWAYS log to help debug security issues
  if (deletePermission !== undefined) {
    console.log("🔒 SECURITY CHECK - Delete Permission:", {
      groupId: group.groupId,
      groupName: group.name,
      "⚠️ CLIENT currentUserId": currentUserId?.trim(),
      "⚠️ CLIENT group.ownerId (from getUserGroups)": group.ownerId?.trim(),
      "✅ SERVER groupOwnerId (from DB)": deletePermission.groupOwnerId,
      "✅ SERVER requesterId": deletePermission.requesterId,
      "✅ SERVER canDelete": deletePermission.canDelete,
      "✅ SERVER isGroupOwner": deletePermission.isGroupOwner,
      "✅ SERVER idsMatch": deletePermission.idsMatch,
      "✅ SERVER ownerId length": deletePermission.ownerIdLength,
      "✅ SERVER requesterId length": deletePermission.requesterIdLength,
      "✅ SERVER ownerId first 10 chars": deletePermission.ownerIdFirst10,
      "✅ SERVER requesterId first 10 chars": deletePermission.requesterIdFirst10,
      "🔍 IDs Match?": deletePermission.groupOwnerId === deletePermission.requesterId,
      "🚨 FINAL canDelete": canDelete,
      "🚨 BUTTON WILL SHOW": canDelete,
    });
    
    // CRITICAL: If IDs don't match but canDelete is true, log a warning
    if (deletePermission.groupOwnerId !== deletePermission.requesterId && deletePermission.canDelete) {
      console.error("🚨 SECURITY WARNING: IDs don't match but canDelete is true!", {
        groupOwnerId: deletePermission.groupOwnerId,
        requesterId: deletePermission.requesterId,
        isAppOwner: deletePermission.isAppOwner,
      });
    }
  }

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

  const handleDelete = async () => {
    // CRITICAL: Multiple server-side checks - don't trust any client-side data
    // Check 1: Server query must have completed
    if (deletePermission === undefined) {
      toast.error("Please wait while we verify permissions...");
      return;
    }

    // Check 2: Server must explicitly say user can delete
    if (!deletePermission.canDelete) {
      toast.error("Unauthorized: Only the group owner can delete the group");
      return;
    }

    // Check 3: Server must confirm user is group owner (not just app owner)
    if (!deletePermission.isGroupOwner) {
      toast.error("Unauthorized: Only the group owner can delete the group");
      return;
    }

    // Check 4: IDs must match exactly (server verified)
    if (!deletePermission.idsMatch) {
      toast.error("Unauthorized: User ID mismatch");
      return;
    }

    // Check 5: Explicit ID comparison (extra safety)
    if (deletePermission.groupOwnerId !== deletePermission.requesterId) {
      toast.error("Unauthorized: User ID does not match group owner");
      return;
    }

    // Check 6: Verify currentUserId matches requesterId from server
    if (currentUserId?.trim() !== deletePermission.requesterId?.trim()) {
      toast.error("Unauthorized: Session mismatch");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to delete this group? All members will lose access.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteGroupAction(group.groupId);
      if (result.success) {
        toast.success("Group deleted successfully");
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
            <p className="text-sm text-gray-600 mb-4">
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
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
              onClick={handleDelete}
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
              Are you sure you want to leave "{group.name || "this group"}"? 
              You will lose access to all shared files from this group. 
              You can request to rejoin later if needed.
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
    </>
  );
}

