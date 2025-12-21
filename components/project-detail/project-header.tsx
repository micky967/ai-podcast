"use client";

import { useQuery } from "convex/react";
import { Edit2, Loader2, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteProjectAction,
  updateDisplayNameAction,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectHeaderProps {
  projectId: Id<"projects">;
  userId: string;
  initialDisplayName?: string;
  initialFileName: string;
  isShared?: boolean;
}

export function ProjectHeader({
  projectId,
  userId,
  initialDisplayName,
  initialFileName,
  isShared = false,
}: ProjectHeaderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if user is owner - owners bypass plan restrictions
  const isOwner = useQuery(
    api.userSettings.isUserOwner,
    userId ? { userId } : "skip"
  );

  const handleStartEdit = () => {
    setEditedName(initialDisplayName || initialFileName);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName("");
  };

  const handleSaveEdit = async () => {
    // Prevent editing if not owner
    if (isOwner !== true) {
      toast.error("You can only edit your own projects");
      setIsEditing(false);
      return;
    }

    if (!editedName.trim()) {
      toast.error("Project name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayNameAction(projectId, editedName);
      toast.success("Project name updated");
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update name"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    // Prevent deletion if not owner
    if (isOwner !== true) {
      toast.error("You can only delete your own projects");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteProjectAction(projectId);
      toast.success("Project deleted");
      router.push("/dashboard/projects");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project"
      );
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xl sm:text-2xl font-bold h-auto py-2 flex-1"
                placeholder="Project name"
                autoFocus
                disabled={isSaving}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="gradient-emerald text-white hover-glow px-4 sm:px-6 transition-all"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden sm:inline mr-2">Save</span>
                      <Save className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">
                {initialDisplayName || initialFileName}
              </h1>
            </div>
          )}
        </div>
        {/* Only show Edit/Delete buttons if user owns the project */}
        {isOwner === true && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isEditing && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleStartEdit}
                className="glass-card hover-lift border-2 border-emerald-200 hover:border-emerald-400 px-4 sm:px-6 bg-white"
              >
                <Edit2 className="h-4 w-4 sm:mr-2 text-emerald-600" />
                <span className="hidden sm:inline font-semibold text-emerald-700">
                  Edit
                </span>
              </Button>
            )}
            <Button
              size="lg"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="gradient-emerald text-white hover-glow px-4 sm:px-6 transition-all"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        )}
        {/* Show read-only indicator for shared projects */}
        {isShared && isOwner !== true && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground italic">
              Read-only (Shared project)
            </span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </>
  );
}

