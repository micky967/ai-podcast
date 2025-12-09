"use client";

import { AdminUserList } from "@/components/admin/admin-user-list";
import type { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";

interface AdminUserProps {
  preloadedIsAdmin: Preloaded<typeof api.userSettings.isUserAdmin>;
  preloadedUsers: Preloaded<typeof api.userSettings.listAllUsers>;
}

export function AdminUser({
  preloadedIsAdmin,
  preloadedUsers,
}: AdminUserProps) {
  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
          <span className="gradient-emerald-text">Admin</span> Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Manage user roles and permissions. Only admins can access this page.
        </p>
      </div>

      {/* Admin User List */}
      <AdminUserList
        preloadedIsAdmin={preloadedIsAdmin}
        preloadedUsers={preloadedUsers}
      />
    </div>
  );
}

