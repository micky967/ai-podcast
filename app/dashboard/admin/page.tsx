/**
 * Admin Dashboard Page
 *
 * Allows owners to manage user roles (promote/demote users to/from admin).
 * Only accessible to users with owner role.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
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

  // Fetch user info from Clerk for all users
  const usersList = await convex.query(api.userSettings.listAllUsers, {
    adminUserId: userId,
  });

  const client = await clerkClient();
  const usersWithInfo = await Promise.all(
    usersList.map(async (user) => {
      try {
        const clerkUser = await client.users.getUser(user.userId);
        return {
          ...user,
          name:
            clerkUser.fullName ||
            `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
            clerkUser.emailAddresses[0]?.emailAddress ||
            user.userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || null,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
        };
      } catch (error) {
        // If user not found in Clerk, just return basic info
        console.error(`Error fetching user ${user.userId}:`, error);
        return {
          ...user,
          name: user.userId,
          email: null,
          firstName: null,
          lastName: null,
        };
      }
    })
  );

  return (
    <AdminUser
      preloadedIsAdmin={preloadedIsOwner}
      preloadedUsers={preloadedUsers}
      usersWithInfo={usersWithInfo}
    />
  );
}
