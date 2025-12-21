"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { Bell, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { respondToJoinRequestAction, acceptInvitationAction, declineInvitationAction } from "@/app/actions/sharing";
import { toast } from "sonner";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

export function JoinRequestsNotification() {
  const { userId, has } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestNames, setRequestNames] = useState<Map<string, string>>(new Map());
  const [respondingRequests, setRespondingRequests] = useState<Set<string>>(new Set());
  // Track accepted/declined requests locally to immediately hide them
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set());

  // Get requests as owner (requests received for groups I own)
  const pendingCountAsOwner = useQuery(
    api.sharingGroups.getPendingRequestsCount,
    userId ? { userId } : "skip"
  );

  // Get requests as requester (requests where I was invited)
  const pendingCountAsRequester = useQuery(
    api.sharingGroups.getPendingRequestsCountForRequester,
    userId ? { userId } : "skip"
  );

  // Get invitations sent by this user (owner-initiated invites)
  const sentInvitationsCount = useQuery(
    api.sharingGroups.getSentInvitationsCount,
    userId ? { userId } : "skip"
  );

  // Get recent accepted/rejected requests (for notifications)
  // Query even when closed to show indicator badge
  const recentResponses = useQuery(
    api.sharingGroups.getRecentRequestResponses,
    userId ? { userId } : "skip"
  );

  // Get accepted requests where user was the requester (for green badge notification)
  const acceptedRequestsForRequester = useQuery(
    api.sharingGroups.getAcceptedRequestsForRequester,
    userId ? { userId } : "skip"
  );
  
  // Always show bell icon if user is logged in (even if count is 0)
  // This ensures User 2 sees the bell immediately when they have an invitation
  const shouldShowBell = userId !== null && userId !== undefined;

  // Get requests as owner
  // Always query (not just when open) so queries update reactively when status changes
  const pendingRequestsAsOwner = useQuery(
    api.sharingGroups.getAllPendingRequestsForOwner,
    userId ? { userId } : "skip"
  );

  // Get requests as requester (where I was invited)
  // Always query (not just when open) so queries update reactively when status changes
  const pendingRequestsAsRequester = useQuery(
    api.sharingGroups.getPendingRequestsForRequester,
    userId ? { userId } : "skip"
  );

  // Get invitations sent by this user
  // Always query (not just when open) so queries update reactively when status changes
  const sentInvitations = useQuery(
    api.sharingGroups.getSentInvitations,
    userId ? { userId } : "skip"
  );

  // Calculate all requests (always, not just when open) for accurate badge count
  // Filter out processed requests immediately (client-side safety check)
  // Deduplicate by groupId to prevent showing multiple requests for the same group
  const allPendingRequests = useMemo(() => {
    const allRequests = [
      ...(pendingRequestsAsOwner?.map((r) => ({ ...r, type: "received" as const })) || []),
      ...(sentInvitations?.map((r) => ({ ...r, type: "sent" as const })) || []),
      ...(pendingRequestsAsRequester?.map((r) => ({ 
        ...r, 
        type: (r as any).initiatedBy === "user" ? "requested" as const : "invited" as const 
      })) || []),
    ];
    
    // First, filter out requests that have been processed (accepted/declined)
    // This must happen BEFORE deduplication to ensure processed requests are removed
    const unprocessedRequests = allRequests.filter((r) => !processedRequests.has(r.requestId));
    
    // Then deduplicate by groupId - keep only the most recent request per group
    // Use a Map to track the most recent request per groupId
    const requestsByGroup = new Map<string, typeof unprocessedRequests[0]>();
    for (const request of unprocessedRequests) {
      const existing = requestsByGroup.get(request.groupId);
      if (!existing) {
        // First request for this group
        requestsByGroup.set(request.groupId, request);
      } else {
        // Compare timestamps - keep the most recent one
        const requestTime = request.requestedAt || 0;
        const existingTime = existing.requestedAt || 0;
        if (requestTime > existingTime) {
          requestsByGroup.set(request.groupId, request);
        }
      }
    }
    
    return Array.from(requestsByGroup.values());
  }, [pendingRequestsAsOwner, sentInvitations, pendingRequestsAsRequester, processedRequests]);

  // Combine all types of requests for modal display (only when open)
  const pendingRequests = useMemo(() => {
    if (!open) return undefined;
    return allPendingRequests;
  }, [open, allPendingRequests]);

  // Calculate pending count from the filtered requests list
  // This ensures badge updates immediately when requests are processed
  const pendingCount = useMemo(() => {
    // Always use the filtered list length for accurate badge count
    return allPendingRequests.length;
  }, [allPendingRequests]);
  
  // Track which response IDs have been viewed
  // Persist to localStorage so it survives page refreshes
  const getViewedResponseIdsFromStorage = (): Set<string> => {
    if (typeof window === "undefined" || !userId) return new Set();
    try {
      const stored = localStorage.getItem(`viewedResponseIds_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Error reading viewedResponseIds from localStorage:", error);
    }
    return new Set();
  };

  const [viewedResponseIds, setViewedResponseIds] = useState<Set<string>>(() => 
    getViewedResponseIdsFromStorage()
  );

  // Track which accepted request IDs have been viewed (for requester notifications)
  const getViewedAcceptedRequestIdsFromStorage = (): Set<string> => {
    if (typeof window === "undefined" || !userId) return new Set();
    try {
      const stored = localStorage.getItem(`viewedAcceptedRequestIds_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Error reading viewedAcceptedRequestIds from localStorage:", error);
    }
    return new Set();
  };

  const [viewedAcceptedRequestIds, setViewedAcceptedRequestIds] = useState<Set<string>>(() => 
    getViewedAcceptedRequestIdsFromStorage()
  );

  // Save viewedResponseIds to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    try {
      const array = Array.from(viewedResponseIds);
      localStorage.setItem(`viewedResponseIds_${userId}`, JSON.stringify(array));
    } catch (error) {
      console.error("Error saving viewedResponseIds to localStorage:", error);
    }
  }, [viewedResponseIds, userId]);

  // Save viewedAcceptedRequestIds to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    try {
      const array = Array.from(viewedAcceptedRequestIds);
      localStorage.setItem(`viewedAcceptedRequestIds_${userId}`, JSON.stringify(array));
    } catch (error) {
      console.error("Error saving viewedAcceptedRequestIds to localStorage:", error);
    }
  }, [viewedAcceptedRequestIds, userId]);

  // Check if there are recent responses to show
  // Mark responses as viewed when modal is opened
  useEffect(() => {
    if (open && recentResponses && recentResponses.length > 0) {
      // When modal opens, mark all current responses as viewed
      const currentResponseIds = new Set(recentResponses.map((r) => r.requestId));
      setViewedResponseIds((prev) => {
        const updated = new Set(prev);
        currentResponseIds.forEach((id) => updated.add(id));
        return updated;
      });
    }
    if (open && acceptedRequestsForRequester && acceptedRequestsForRequester.length > 0) {
      // When modal opens, mark all current accepted requests as viewed
      const currentAcceptedRequestIds = new Set(acceptedRequestsForRequester.map((r) => r.requestId));
      setViewedAcceptedRequestIds((prev) => {
        const updated = new Set(prev);
        currentAcceptedRequestIds.forEach((id) => updated.add(id));
        return updated;
      });
    }
  }, [open, recentResponses, acceptedRequestsForRequester]);

  // Check if there are any unviewed recent responses
  const hasRecentResponses = recentResponses && recentResponses.length > 0;
  const hasUnviewedRecentResponses = hasRecentResponses && 
    recentResponses.some((r) => !viewedResponseIds.has(r.requestId));

  // Check if there are any unviewed accepted requests (where user was requester)
  const hasAcceptedRequests = acceptedRequestsForRequester && acceptedRequestsForRequester.length > 0;
  const hasUnviewedAcceptedRequests = hasAcceptedRequests && 
    acceptedRequestsForRequester.some((r) => !viewedAcceptedRequestIds.has(r.requestId));

  // Fetch requester names (for both pending requests and recent responses)
  useEffect(() => {
    const allRequesterIds = new Set<string>();
    
    if (pendingRequests && pendingRequests.length > 0) {
      pendingRequests.forEach((r) => allRequesterIds.add(r.requesterId));
    }
    
    if (recentResponses && recentResponses.length > 0) {
      recentResponses.forEach((r) => allRequesterIds.add(r.requesterId));
    }

    if (allRequesterIds.size === 0) {
      setRequestNames(new Map());
      return;
    }

    const fetchNames = async () => {
      const names = new Map<string, string>();
      const uniqueRequesterIds = Array.from(allRequesterIds);

      const namePromises = uniqueRequesterIds.map(async (requesterId) => {
        try {
          const response = await fetch(`/api/users/${requesterId}/name`);
          if (response.ok) {
            const data = await response.json();
            return { userId: requesterId, name: data.name || requesterId };
          }
          return { userId: requesterId, name: requesterId };
        } catch {
          return { userId: requesterId, name: requesterId };
        }
      });

      const results = await Promise.all(namePromises);
      results.forEach(({ userId, name }) => {
        names.set(userId, name);
      });

      setRequestNames(names);
    };

    fetchNames();
  }, [pendingRequests, recentResponses, sentInvitations]);

  const userPlan = getCurrentPlan(has as any);

  const handleRespond = async (
    requestId: string,
    accept: boolean,
    requesterName: string,
    groupName: string,
    requestType: "received" | "invited" | "sent" | "requested",
    groupId?: string
  ) => {
    // Prevent double-clicks by checking if already responding
    if (respondingRequests.has(requestId)) {
      return;
    }
    
    setRespondingRequests((prev) => new Set(prev).add(requestId));
    try {
      let result;
      
      if (requestType === "invited") {
        // User is accepting/declining their own invitation
        if (!accept) {
          // Declining invitation
          result = await declineInvitationAction({
            requestId: requestId as any,
          });
          if (result.success) {
            toast.success(`You've declined the invitation to join "${groupName}"`);
          }
        } else {
          result = await acceptInvitationAction({
            requestId: requestId as any,
          });
          if (result.success) {
            toast.success(`You've joined "${groupName}"`);
          }
        }
      } else if ((requestType as any) === "sent") {
        // User sent this invitation - they can't accept/reject it
        toast.info("Waiting for the invited user to respond to your invitation");
        return;
      } else {
        // Owner is responding to a request they received
        result = await respondToJoinRequestAction({
          requestId: requestId as any,
          accept,
          ownerPlan: userPlan,
        });
        if (result.success) {
          toast.success(
            accept
              ? `Accepted ${requesterName}'s request to join "${groupName}"`
              : `Rejected ${requesterName}'s request to join "${groupName}"`
          );
        }
      }
      
      if (result.success) {
        // Immediately mark this request as processed to hide it from UI
        // Also mark all requests for the same group as processed to handle duplicates
        setProcessedRequests((prev) => {
          const next = new Set(prev);
          next.add(requestId);
          // Also mark any other requests for the same group as processed
          // This handles the case where there are duplicate requests
          if (groupId) {
            const allRequests = [
              ...(pendingRequestsAsOwner || []),
              ...(sentInvitations || []),
              ...(pendingRequestsAsRequester || []),
            ];
            allRequests.forEach((r) => {
              if (r.groupId === groupId && r.requestId !== requestId) {
                next.add(r.requestId);
              }
            });
          }
          return next;
        });
        // Close popover immediately to prevent double-clicks
        setOpen(false);
        // Convex queries will update reactively - the badge count will automatically update when the request status changes
      } else {
        toast.error(result.error || "Failed to respond to request");
      }
    } catch (error) {
      toast.error("Failed to respond to request");
    } finally {
      setRespondingRequests((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };


  // Always show bell icon if user is logged in
  if (!shouldShowBell) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative hover:bg-white/20 transition-all duration-300 text-white"
        >
          <Bell className="h-5 w-5" />
          {pendingCount !== undefined && pendingCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs font-bold border-2 border-white"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </Badge>
          )}
          {/* Show indicator if there are recent responses but no pending requests */}
          {/* Show green badge if there are unviewed accepted requests (user was requester) */}
          {pendingCount === 0 && hasUnviewedAcceptedRequests && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-green-500 text-white text-xs font-bold border-2 border-white"
              title="You've been accepted to a group"
            >
              !
            </Badge>
          )}
          {/* Show green badge for owner's recent responses if no accepted requests */}
          {pendingCount === 0 && !hasUnviewedAcceptedRequests && hasUnviewedRecentResponses && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-green-500 text-white text-xs font-bold border-2 border-white"
              title="Recent activity"
            >
              !
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold text-lg">Join Requests</h3>
          </div>
          <p className="text-sm text-gray-600">
            {pendingCount ?? "Loading..."} {pendingCount === 1 ? "request" : "requests"} pending
            {hasRecentResponses && (
              <span className="ml-2 text-green-600">
                • {recentResponses.length} recent {recentResponses.length === 1 ? "activity" : "activities"}
              </span>
            )}
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {pendingRequests === undefined ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : pendingRequests.length === 0 && (!recentResponses || recentResponses.length === 0) && (!acceptedRequestsForRequester || acceptedRequestsForRequester.length === 0) ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No pending requests
            </div>
          ) : (
            <>
              {/* Accepted Requests Section (where user was requester) */}
              {acceptedRequestsForRequester && acceptedRequestsForRequester.length > 0 && (
                <div className="divide-y border-b">
                  <h4 className="px-4 py-2 text-sm font-semibold bg-green-50 text-green-900 sticky top-0">
                    You've Been Accepted
                  </h4>
                  {acceptedRequestsForRequester.map((acceptedRequest) => {
                    const timeAgo = acceptedRequest.respondedAt
                      ? new Date(acceptedRequest.respondedAt).toLocaleTimeString()
                      : "";
                    const isViewed = viewedAcceptedRequestIds.has(acceptedRequest.requestId);
                    return (
                      <div 
                        key={acceptedRequest.requestId} 
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!isViewed ? 'bg-green-50/50' : ''}`}
                        onClick={() => {
                          // Mark as viewed
                          setViewedAcceptedRequestIds((prev) => {
                            const updated = new Set(prev);
                            updated.add(acceptedRequest.requestId);
                            return updated;
                          });
                          // Navigate to shared files
                          router.push('/dashboard/projects?filter=shared');
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-green-700">
                              ✓ You've been accepted to join
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">"{acceptedRequest.groupName}"</span>
                              {timeAgo && <span className="ml-2">• {timeAgo}</span>}
                            </p>
                            <p className="text-xs text-green-600 mt-1 italic">
                              Click to view shared files
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Recent Responses Section (for owners) */}
              {recentResponses && recentResponses.length > 0 && (
                <div className="divide-y border-b">
                  <h4 className="px-4 py-2 text-sm font-semibold bg-green-50 text-green-900 sticky top-0">
                    Recent Activity
                  </h4>
                  {recentResponses.map((response) => {
                    const requesterName = requestNames.get(response.requesterId) || response.requesterId;
                    const timeAgo = response.respondedAt
                      ? new Date(response.respondedAt).toLocaleTimeString()
                      : "";
                    return (
                      <div key={response.requestId} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {response.responseType === "accepted" ? (
                                <span className="text-green-700">✓ {requesterName} joined</span>
                              ) : (
                                <span className="text-red-700">✗ {requesterName} declined</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">"{response.groupName}"</span>
                              {timeAgo && <span className="ml-2">• {timeAgo}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Pending Requests Section */}
              {pendingRequests && pendingRequests.length > 0 && (
                <div className="divide-y">
                  <h4 className="px-4 py-2 text-sm font-semibold bg-blue-50 text-blue-900 sticky top-0">
                    Pending Requests
                  </h4>
                  {pendingRequests.map((request) => {
                const requesterName =
                  requestNames.get(request.requesterId) || request.requesterId;
                const isResponding = respondingRequests.has(request.requestId);
                const isInvited = request.type === "invited";
                const isSent = request.type === "sent";
                const isRequested = request.type === "requested"; // User-initiated request
                return (
                  <div key={request.requestId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {isInvited ? "You've been invited" : isSent ? "You invited" : isRequested ? "Request pending" : requesterName}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {isInvited ? (
                            <>
                              to join <span className="font-medium">"{request.groupName}"</span>
                            </>
                          ) : isSent ? (
                            <>
                              <span className="font-medium">{requesterName}</span> to join <span className="font-medium">"{request.groupName}"</span>
                            </>
                          ) : isRequested ? (
                            <>
                              Waiting for <span className="font-medium">"{request.groupName}"</span> owner to respond
                            </>
                          ) : (
                            <>
                              wants to join <span className="font-medium">"{request.groupName}"</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {!isSent && !isRequested && (
                      <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-8 gradient-emerald text-white hover-glow"
                        disabled={isResponding}
                        onClick={() =>
                          handleRespond(
                            request.requestId,
                            true,
                            requesterName,
                            request.groupName,
                            request.type as "received" | "invited" | "sent",
                            request.groupId
                          )
                        }
                      >
                        {isResponding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            {isInvited ? "Accept" : "Accept"}
                          </>
                        )}
                      </Button>
                      {!isInvited && !isSent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={isResponding}
                          onClick={() =>
                            handleRespond(
                              request.requestId,
                              false,
                              requesterName,
                              request.groupName,
                              request.type,
                              request.groupId
                            )
                          }
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      )}
                      {isInvited && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={isResponding}
                          onClick={() =>
                            handleRespond(
                              request.requestId,
                              false,
                              requesterName,
                              request.groupName,
                              request.type,
                              request.groupId
                            )
                          }
                        >
                          <X className="h-3 w-3 mr-1" />
                          Decline
                        </Button>
                      )}
                    </div>
                    )}
                    {(isSent || isRequested) && (
                      <div className="text-xs text-gray-500 italic">
                        Waiting for response...
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

