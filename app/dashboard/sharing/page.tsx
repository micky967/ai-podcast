import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { SharingGroupsList } from "@/components/sharing/sharing-groups-list";
import { api } from "@/convex/_generated/api";

export default async function SharingPage() {
  const { userId } = await auth();

  // Redirect if not authenticated
  if (!userId) {
    redirect("/");
  }

  // Preload user's groups
  const preloadedGroups = await preloadQuery(api.sharingGroups.getUserGroups, {
    userId,
  });

  return <SharingGroupsList preloadedGroups={preloadedGroups} />;
}




