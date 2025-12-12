"use client";

import { useQuery } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, UserPlus, Search, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  inviteUserAction,
  addMemberAction,
  removeMemberAction,
  respondToJoinRequestAction,
} from "@/app/actions/sharing";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getCurrentPlan } from "@/lib/client-tier-utils";

interface GroupMembersModalProps {
  groupId: Id<"sharingGroups">;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Member {
  userId: string;
  addedAt: number;
  addedBy: "owner" | "admin";
}

interface UserName {
  userId: string;
  name: string | null;
}

export function GroupMembersModal({
  groupId,
  isOwner,
  open,
  onOpenChange,
}: GroupMembersModalProps) {
  const { userId: currentUserId, has } = useAuth();
  const router = useRouter();
  const groupDetails = useQuery(
    api.sharingGroups.getGroupDetails,
    currentUserId && open ? { groupId, userId: currentUserId } : "skip"
  );

  // Get pending join requests (only for owners)
  const pendingRequests = useQuery(
    api.sharingGroups.getPendingJoinRequests,
    isOwner && currentUserId && open
      ? { groupId, ownerId: currentUserId }
      : "skip"
  );

  // Check if current user has "owner" role (app owner)
  const userRole = useQuery(
    api.userSettings.getUserRole,
    currentUserId ? { userId: currentUserId } : "skip"
  );
  const isAppOwner = userRole === "owner";

  // Can remove members if group owner OR app owner
  const canRemoveMembers = isOwner || isAppOwner;

  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      userId: string;
      name: string;
      email: string | null;
      imageUrl: string | null;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{
    userId: string;
    name: string;
    email: string | null;
    imageUrl: string | null;
  } | null>(null);
  const [requestNames, setRequestNames] = useState<Map<string, string>>(
    new Map()
  );
  const [respondingRequests, setRespondingRequests] = useState<Set<string>>(
    new Set()
  );

  // Fetch user names from Clerk
  useEffect(() => {
    if (!groupDetails || !open) return;

    const fetchUserNames = async () => {
      const names = new Map<string, string>();
      const userIds = [
        groupDetails.ownerId,
        ...groupDetails.members.map((m) => m.userId),
      ];

      // Add pending request user IDs
      if (pendingRequests) {
        pendingRequests.forEach((req) => {
          if (!userIds.includes(req.requesterId)) {
            userIds.push(req.requesterId);
          }
        });
      }

      // Fetch names in parallel
      const namePromises = userIds.map(async (userId) => {
        try {
          // Note: This requires a server action or API route to fetch from Clerk
          // For now, we'll use userId as fallback
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

      // Also set request names separately (using the same results)
      if (pendingRequests) {
        const reqNames = new Map<string, string>();
        for (const req of pendingRequests) {
          const nameData = results.find((n) => n.userId === req.requesterId);
          reqNames.set(req.requesterId, nameData?.name || req.requesterId);
        }
        setRequestNames(reqNames);
      }
    };

    fetchUserNames();
  }, [groupDetails, pendingRequests, open]);

  // Debounced user search
  useEffect(() => {
    if (!showAddMember) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.users || []);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search by 300ms
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, showAddMember]);

  if (groupDetails === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (groupDetails === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group Members</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-sm text-gray-600 mb-4">
              You don't have access to view this group's members.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const ownerName = userNames.get(groupDetails.ownerId) || groupDetails.ownerId;
  const allMembers = [
    {
      userId: groupDetails.ownerId,
      addedAt: groupDetails.createdAt,
      addedBy: "owner" as const,
    },
    ...groupDetails.members,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {groupDetails.name || "Group Members"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Owner</p>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Crown className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">{ownerName}</span>
              <Badge variant="secondary" className="ml-auto">
                Owner
              </Badge>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                Members ({groupDetails.memberCount})
              </p>
              {isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="h-8"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Add Member
                </Button>
              )}
            </div>

            {showAddMember && isOwner && (
              <div className="mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <Label
                  htmlFor="memberSearch"
                  className="text-sm font-medium mb-2 block"
                >
                  Search Users by Name or Email
                </Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="memberSearch"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type name or email to search..."
                      disabled={isAdding}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults([]);
                          setSelectedUserId(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {searchQuery.trim().length >= 2 && !selectedUserId && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="py-2">
                          {searchResults.map((user) => {
                            const isAlreadyMember = groupDetails.members.some(
                              (m) => m.userId === user.userId
                            );
                            const isOwner =
                              groupDetails.ownerId === user.userId;

                            return (
                              <button
                                key={user.userId}
                                type="button"
                                onClick={() => {
                                  if (!isAlreadyMember && !isOwner) {
                                    setSelectedUserId(user.userId);
                                    setSelectedUserInfo(user); // Store selected user info
                                    setSearchQuery(""); // Clear search to close dropdown
                                    setSearchResults([]); // Clear results
                                  }
                                }}
                                disabled={
                                  isAlreadyMember || isOwner || isAdding
                                }
                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                                  selectedUserId === user.userId
                                    ? "bg-emerald-50 border-l-4 border-emerald-500"
                                    : ""
                                } ${
                                  isAlreadyMember || isOwner
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                {user.imageUrl && (
                                  <img
                                    src={user.imageUrl}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.name}
                                  </p>
                                  {user.email && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {user.email}
                                    </p>
                                  )}
                                </div>
                                {isAlreadyMember && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Member
                                  </Badge>
                                )}
                                {isOwner && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Owner
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No users found. Try a different search term.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected User Display and Add Button */}
                {selectedUserId && selectedUserInfo && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                      {selectedUserInfo.imageUrl && (
                        <img
                          src={selectedUserInfo.imageUrl}
                          alt={selectedUserInfo.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {selectedUserInfo.name}
                        </p>
                        {selectedUserInfo.email && (
                          <p className="text-xs text-gray-500 truncate">
                            {selectedUserInfo.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          setIsAdding(true);
                          try {
                            const ownerPlan = getCurrentPlan(has);
                            const result = await inviteUserAction({
                              groupId,
                              userId: selectedUserId,
                              ownerPlan,
                            });
                            if (result.success) {
                              toast.success(
                                "Invitation sent! The user will see the request in their notifications."
                              );
                              setSearchQuery("");
                              setSearchResults([]);
                              setSelectedUserId(null);
                              setSelectedUserInfo(null);
                              setShowAddMember(false);
                              router.refresh();
                            } else {
                              toast.error(
                                result.error || "Failed to invite user"
                              );
                            }
                          } catch (error) {
                            toast.error("Failed to invite user");
                          } finally {
                            setIsAdding(false);
                          }
                        }}
                        disabled={isAdding}
                        className="flex-1"
                      >
                        {isAdding ? "Inviting..." : "Invite User"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUserId(null);
                          setSelectedUserInfo(null);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        disabled={isAdding}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Type at least 2 characters to search for users by name or
                  email.
                </p>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {allMembers
                .filter((m) => m.userId !== groupDetails.ownerId)
                .map((member) => {
                  const memberName =
                    userNames.get(member.userId) || member.userId;
                  const isCurrentUser = member.userId === currentUserId;
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm flex-1">{memberName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {member.addedBy === "admin"
                            ? "Added by Admin"
                            : "Member"}
                        </Badge>
                        {canRemoveMembers && !isCurrentUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Are you sure you want to remove ${memberName} from this group?`
                                )
                              ) {
                                return;
                              }
                              try {
                                const result = await removeMemberAction({
                                  groupId,
                                  userId: member.userId,
                                });
                                if (result.success) {
                                  toast.success("Member removed successfully");
                                  router.refresh();
                                } else {
                                  toast.error(
                                    result.error || "Failed to remove member"
                                  );
                                }
                              } catch (error) {
                                toast.error("Failed to remove member");
                              }
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {groupDetails.memberCount === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No members yet
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
