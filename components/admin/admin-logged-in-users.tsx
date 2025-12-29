"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Shield, Crown, Clock } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";

interface AdminLoggedInUsersProps {
  adminUserId: string;
}

export function AdminLoggedInUsers({ adminUserId }: AdminLoggedInUsersProps) {
  const { userId } = useAuth();
  const [userInfoMap, setUserInfoMap] = useState<
    Map<
      string,
      {
        name: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        role: string;
      }
    >
  >(new Map());

  // Get active sessions (logged-in users)
  const activeSessions = useQuery(
    api.sessions.getActiveSessions,
    userId === adminUserId ? { adminUserId } : "skip"
  );

  // Get all users to fetch roles
  const allUsers = useQuery(
    api.userSettings.listAllUsers,
    userId === adminUserId ? { adminUserId } : "skip"
  );

  // Fetch user info from Clerk and get roles for all active sessions
  useEffect(() => {
    if (!activeSessions || activeSessions.length === 0) return;
    if (!allUsers) return; // Wait for user roles to load

    const fetchUserInfo = async () => {
      const infoMap = new Map<
        string,
        {
          name: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
          role: string;
        }
      >();

      // Create a map of userId to role
      const roleMap = new Map<string, string>();
      allUsers.forEach((user) => {
        roleMap.set(user.userId, user.role);
      });

      await Promise.all(
        activeSessions.map(async (session) => {
          try {
            const response = await fetch(`/api/users/${session.userId}/name`);
            const role = roleMap.get(session.userId) || "user";
            
            if (response.ok) {
              const data = await response.json();
              infoMap.set(session.userId, {
                name: data.name || session.userId,
                email: data.email || null,
                firstName: data.firstName || null,
                lastName: data.lastName || null,
                role,
              });
            } else {
              infoMap.set(session.userId, {
                name: session.userId,
                email: null,
                firstName: null,
                lastName: null,
                role,
              });
            }
          } catch (error) {
            console.error(`Error fetching user info for ${session.userId}:`, error);
            const role = roleMap.get(session.userId) || "user";
            infoMap.set(session.userId, {
              name: session.userId,
              email: null,
              firstName: null,
              lastName: null,
              role,
            });
          }
        })
      );

      setUserInfoMap(infoMap);
    };

    fetchUserInfo();
  }, [activeSessions, allUsers]);

  if (activeSessions === undefined) {
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

  if (activeSessions === null || activeSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logged In Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            No users are currently logged in.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logged In Users</CardTitle>
        <p className="text-sm text-muted-foreground">
          Users with active sessions ({activeSessions.length}{" "}
          {activeSessions.length === 1 ? "user" : "users"})
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activeSessions.map((session) => {
            const userInfo = userInfoMap.get(session.userId);
            const isCurrentUser = session.userId === userId;
            const role = userInfo?.role || "user";
            const isAdmin = role === "admin";
            const isOwner = role === "owner";

            return (
              <div
                key={session.userId}
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
                          {userInfo?.name || session.userId}
                        </div>
                        {userInfo?.email && (
                          <div className="text-xs sm:text-sm text-muted-foreground truncate">
                            {userInfo.email}
                          </div>
                        )}
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded break-all">
                          {session.userId}
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
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0 sm:self-center">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">Session started {formatTimeAgo(session.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

