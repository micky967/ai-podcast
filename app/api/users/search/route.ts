import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

    // Format results
    const results = users.data.map((user) => ({
      userId: user.id,
      name:
        user.fullName ||
        user.firstName ||
        user.emailAddresses[0]?.emailAddress ||
        user.username ||
        user.id,
      email: user.emailAddresses[0]?.emailAddress || null,
      imageUrl: user.imageUrl || null,
    }));

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 },
    );
  }
}




