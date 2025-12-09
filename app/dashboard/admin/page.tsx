/**
 * Admin Dashboard Page
 *
 * Allows admins to manage user roles (promote/demote users to/from admin).
 * Only accessible to users with admin role.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminUser } from "@/components/admin-user";
import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Check if user is admin
  const preloadedIsAdmin = await preloadQuery(api.userSettings.isUserAdmin, {
    userId,
  });

  // Check admin status and redirect if not admin
  // Note: We can't directly await the preloaded query value, so we'll check it client-side
  // But we can try to preload users and catch the error
  let preloadedUsers;
  try {
    preloadedUsers = await preloadQuery(api.userSettings.listAllUsers, {
      adminUserId: userId,
    });
  } catch (error) {
    // User is not admin, redirect
    redirect("/dashboard/projects");
  }

  return (
    <AdminUser
      preloadedIsAdmin={preloadedIsAdmin}
      preloadedUsers={preloadedUsers}
    />
  );
}
