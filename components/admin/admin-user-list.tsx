"use client";

import { useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, User, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";

interface UserWithInfo {
  userId: string;
  role: string;
  createdAt: number;
  name: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AdminUserListProps {
  preloadedIsAdmin: Preloaded<typeof api.userSettings.isUserAdmin>;
  preloadedUsers: Preloaded<typeof api.userSettings.listAllUsers>;
  usersWithInfo?: UserWithInfo[];
}

export function AdminUserList({
  preloadedIsAdmin,
  preloadedUsers,
  usersWithInfo,
}: AdminUserListProps) {
  const { userId } = useAuth();
  const [changingRoles, setChangingRoles] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    targetUserId: string | null;
    newRole: "user" | "admin" | null;
    currentRole: string | null;
  }>({
    open: false,
    targetUserId: null,
    newRole: null,
    currentRole: null,
  });

  // Use preloaded queries
  const adminStatus = usePreloadedQuery(preloadedIsAdmin);
  const usersList = usePreloadedQuery(preloadedUsers);

  const setUserRole = useMutation(api.userSettings.setUserRole);

  // Redirect if not owner (handled by page, but show message)
  if (adminStatus === false) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You don't have permission to access this page. Only owners can view
            the admin dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (usersList === undefined) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Merge usersList with usersWithInfo to get names and emails
  const usersWithMergedInfo = usersList.map((user) => {
    const userInfo = usersWithInfo?.find((info) => info.userId === user.userId);
    return {
      ...user,
      name: userInfo?.name || user.userId,
      email: userInfo?.email || null,
      firstName: userInfo?.firstName || null,
      lastName: userInfo?.lastName || null,
    };
  });

  const handleRoleChangeClick = (
    targetUserId: string,
    newRole: "user" | "admin",
    currentRole: string
  ) => {
    setConfirmDialog({
      open: true,
      targetUserId,
      newRole,
      currentRole,
    });
  };

  const handleConfirmRoleChange = async () => {
    if (!userId || !confirmDialog.targetUserId || !confirmDialog.newRole)
      return;

    const targetUserId = confirmDialog.targetUserId;
    const newRole = confirmDialog.newRole;

    // Close dialog first
    setConfirmDialog({
      open: false,
      targetUserId: null,
      newRole: null,
      currentRole: null,
    });

    setChangingRoles((prev) => new Set(prev).add(targetUserId));

    try {
      await setUserRole({
        targetUserId,
        role: newRole,
        adminUserId: userId,
      });

      toast.success(`User role changed to ${newRole}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user role"
      );
    } finally {
      setChangingRoles((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleCancelRoleChange = () => {
    setConfirmDialog({
      open: false,
      targetUserId: null,
      newRole: null,
      currentRole: null,
    });
  };

  if (usersList === null || usersList.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No users found.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort users: owners first, then admins, then by creation date
  const sortedUsers = [...usersWithMergedInfo].sort((a, b) => {
    // Owners always first
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    // Then admins
    if (a.role === "admin" && b.role !== "admin" && b.role !== "owner")
      return -1;
    if (a.role !== "admin" && a.role !== "owner" && b.role === "admin")
      return 1;
    // Then by creation date
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const getRoleChangeMessage = () => {
    if (!confirmDialog.newRole || !confirmDialog.currentRole) return "";
    const action = confirmDialog.newRole === "admin" ? "promote" : "demote";
    const fromRole = confirmDialog.currentRole === "admin" ? "Admin" : "User";
    const toRole = confirmDialog.newRole === "admin" ? "Admin" : "User";
    return `Are you sure you want to ${action} this user from ${fromRole} to ${toRole}?`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Total users: {sortedUsers.length} (
              {sortedUsers.filter((u) => u.role === "owner").length} owner
              {sortedUsers.filter((u) => u.role === "owner").length !== 1
                ? "s"
                : ""}
              , {sortedUsers.filter((u) => u.role === "admin").length} admin
              {sortedUsers.filter((u) => u.role === "admin").length !== 1
                ? "s"
                : ""}
              ,{" "}
              {
                sortedUsers.filter(
                  (u) => u.role !== "admin" && u.role !== "owner"
                ).length
              }{" "}
              user
              {sortedUsers.filter(
                (u) => u.role !== "admin" && u.role !== "owner"
              ).length !== 1
                ? "s"
                : ""}
              )
            </div>

            <div className="space-y-2">
              {sortedUsers.map((user) => {
                const isChanging = changingRoles.has(user.userId);
                const isCurrentUser = user.userId === userId;
                const isAdmin = user.role === "admin";
                const isOwner = user.role === "owner";

                return (
                  <div
                    key={user.userId}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                        {isOwner ? (
                          <Crown
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            style={{ color: "#eab308", stroke: "#eab308" }}
                          />
                        ) : isAdmin ? (
                          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                        ) : (
                          <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="font-semibold text-sm sm:text-base truncate">
                              {user.name || user.userId}
                            </div>
                            {user.email && (
                              <div className="text-xs sm:text-sm text-muted-foreground truncate">
                                {user.email}
                              </div>
                            )}
                            <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded break-all">
                              {user.userId}
                            </code>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                            <Badge
                              variant={
                                isOwner
                                  ? "default"
                                  : isAdmin
                                  ? "default"
                                  : "secondary"
                              }
                              className={`text-xs ${
                                isOwner ? "bg-yellow-600 text-white" : ""
                              }`}
                            >
                              {isOwner ? "Owner" : isAdmin ? "Admin" : "User"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 sm:self-center">
                      {isOwner ? (
                        <span className="text-xs sm:text-sm text-muted-foreground italic">
                          Owner role cannot be changed
                        </span>
                      ) : isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleRoleChangeClick(
                              user.userId,
                              "user",
                              user.role
                            )
                          }
                          disabled={isChanging || isCurrentUser}
                          className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
                        >
                          {isChanging ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <User className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span className="hidden sm:inline">Demote to User</span>
                          <span className="sm:hidden">Demote</span>
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            handleRoleChangeClick(
                              user.userId,
                              "admin",
                              user.role
                            )
                          }
                          disabled={isChanging}
                          className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
                        >
                          {isChanging ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span className="hidden sm:inline">Promote to Admin</span>
                          <span className="sm:hidden">Promote</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={handleCancelRoleChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>{getRoleChangeMessage()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRoleChange}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRoleChange}
              className="gradient-emerald text-white hover-glow"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
