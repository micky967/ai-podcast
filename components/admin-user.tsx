"use client";

import { AdminUserList } from "@/components/admin/admin-user-list";
import { AdminSharing } from "@/components/admin/admin-sharing";
import { AdminCategories } from "@/components/admin/admin-categories";
import { AdminLoggedInUsers } from "@/components/admin/admin-logged-in-users";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";

interface UserWithInfo {
  userId: string;
  role: string;
  createdAt: number;
  name: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AdminUserProps {
  preloadedIsAdmin: Preloaded<typeof api.userSettings.isUserAdmin>;
  preloadedUsers: Preloaded<typeof api.userSettings.listAllUsers>;
  usersWithInfo?: UserWithInfo[];
}

export function AdminUser({
  preloadedIsAdmin,
  preloadedUsers,
  usersWithInfo,
}: AdminUserProps) {
  const { userId } = useAuth();

  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
          <span className="gradient-emerald-text">Admin</span> Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Manage user roles, permissions, sharing groups, and categories. Only owners can access this page.
        </p>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="logged-in">Logged In</TabsTrigger>
          <TabsTrigger value="sharing">Sharing Groups</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUserList
            preloadedIsAdmin={preloadedIsAdmin}
            preloadedUsers={preloadedUsers}
            usersWithInfo={usersWithInfo}
          />
        </TabsContent>
        <TabsContent value="logged-in">
          {userId && <AdminLoggedInUsers adminUserId={userId} />}
        </TabsContent>
        <TabsContent value="sharing">
          {userId && <AdminSharing adminId={userId} />}
        </TabsContent>
        <TabsContent value="categories">
          <AdminCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}

