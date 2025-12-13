import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
    const name =
      user.fullName ||
      user.firstName ||
      user.emailAddresses[0]?.emailAddress ||
      userId;

    return NextResponse.json({
      name,
      imageUrl: user.imageUrl || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (error) {
    console.error("Error fetching user name:", error);
    return NextResponse.json(
      { error: "Failed to fetch user name" },
      { status: 500 },
    );
  }
}

