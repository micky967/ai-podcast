import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { transformUserName } from "@/lib/name-utils";
import { convex } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Get user from Clerk
    const client = await clerkClient();
    
    // Search users by email address or username
    // Clerk's getUserList can filter by email address
    const users = await client.users.getUserList({
      query: query.trim(),
      limit: 10,
    });

    // Check owner status for all users in parallel
    const ownerChecks = await Promise.all(
      users.data.map(async (user) => {
        try {
          const isOwner = await convex.query(api.userSettings.isUserOwner, {
            userId: user.id,
          });
          return { userId: user.id, isOwner };
        } catch {
          return { userId: user.id, isOwner: false };
        }
      })
    );

    const ownerMap = new Map(
      ownerChecks.map((check) => [check.userId, check.isOwner])
    );

    // Format results
    const results = users.data.map((user) => {
      const rawName =
        user.fullName ||
        user.firstName ||
        user.emailAddresses[0]?.emailAddress ||
        user.username ||
        user.id;
      
      // Only transform name and hide avatar if user is owner
      let name = rawName;
      let imageUrl = user.imageUrl || null;
      let initials = "";
      const isOwner = ownerMap.get(user.id) || false;
      if (isOwner) {
        name = transformUserName(rawName);
        // Hide owner's photo - return null for avatar
        imageUrl = null;
        // Set initials to "A" for Administrator
        initials = "A";
      } else {
        // Generate initials for non-owner users
        if (user.firstName && user.lastName) {
          initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        } else if (rawName) {
          const nameParts = rawName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            initials = `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
          } else if (nameParts.length === 1) {
            initials = nameParts[0][0].toUpperCase();
          }
        }
      }
      
      return {
        userId: user.id,
        name,
        email: user.emailAddresses[0]?.emailAddress || null,
        imageUrl,
        initials,
      };
    });

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 },
    );
  }
}





