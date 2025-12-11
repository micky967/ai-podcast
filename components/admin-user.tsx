"use client";

import { AdminUserList } from "@/components/admin/admin-user-list";
import { AdminSharing } from "@/components/admin/admin-sharing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";

interface AdminUserProps {
  preloadedIsAdmin: Preloaded<typeof api.userSettings.isUserAdmin>;
  preloadedUsers: Preloaded<typeof api.userSettings.listAllUsers>;
}

export function AdminUser({
  preloadedIsAdmin,
  preloadedUsers,
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
          Manage user roles, permissions, and sharing groups. Only owners can access this page.
        </p>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sharing">Sharing Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUserList
            preloadedIsAdmin={preloadedIsAdmin}
            preloadedUsers={preloadedUsers}
          />
        </TabsContent>
        <TabsContent value="sharing">
          {userId && <AdminSharing adminId={userId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

