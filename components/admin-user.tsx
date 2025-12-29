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
    <div className="container max-w-6xl mx-auto py-4 sm:py-6 md:py-8 lg:py-10 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-0">
      {/* Header */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 sm:mb-3">
          <span className="gradient-emerald-text">Admin</span> Dashboard
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600">
          Manage user roles, permissions, sharing groups, and categories. Only owners can access this page.
        </p>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-wrap sm:flex-nowrap">
          <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
          <TabsTrigger value="logged-in" className="text-xs sm:text-sm">Logged In</TabsTrigger>
          <TabsTrigger value="sharing" className="text-xs sm:text-sm">Sharing Groups</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">Categories</TabsTrigger>
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

