import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { transformUserName } from "@/lib/name-utils";
import { convex } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    // Get user from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // Return user's full name or first name or email or userId as fallback
    const rawName =
      user.fullName ||
      user.firstName ||
      user.emailAddresses[0]?.emailAddress ||
      userId;

    // Check if this user is the owner before applying transformation
    // Only transform the owner's name and hide avatar, not other users
    let name = rawName;
    let imageUrl = user.imageUrl || null;
    let initials = "";
    try {
      const isOwner = await convex.query(api.userSettings.isUserOwner, {
        userId,
      });
      
      // Only apply transformation if user is owner
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
    } catch (error) {
      // If query fails, don't apply transformation (safer to show real name)
      console.error("Error checking owner status:", error);
      // Generate initials from name as fallback
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

    return NextResponse.json({
      name,
      email: user.emailAddresses[0]?.emailAddress || null,
      imageUrl,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      initials,
    });
  } catch (error) {
    console.error("Error fetching user name:", error);
    return NextResponse.json(
      { error: "Failed to fetch user name" },
      { status: 500 },
    );
  }
}

