/**
 * Admin Dashboard Page
 *
 * Allows owners to manage user roles (promote/demote users to/from admin).
 * Only accessible to users with owner role.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminUser } from "@/components/admin-user";
import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";
import { convex } from "@/lib/convex-client";

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Server-side check: Verify user is owner before rendering
  // Use ConvexHttpClient to actually execute the query on the server
  try {
    // Check if user is owner - this will throw if not owner
    const isOwner = await convex.query(api.userSettings.isUserOwner, {
      userId,
    });

    if (!isOwner) {
      // User is not owner, redirect immediately
      redirect("/dashboard/projects");
    }
  } catch (error) {
    // User is not owner or query failed, redirect
    redirect("/dashboard/projects");
  }

  // User is owner - preload data for client component
  const preloadedIsOwner = await preloadQuery(api.userSettings.isUserOwner, {
    userId,
  });

  const preloadedUsers = await preloadQuery(api.userSettings.listAllUsers, {
    adminUserId: userId,
  });

  return (
    <AdminUser
      preloadedIsAdmin={preloadedIsOwner}
      preloadedUsers={preloadedUsers}
    />
  );
}
