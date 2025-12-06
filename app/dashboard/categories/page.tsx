import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { CategoriesGrid } from "@/components/categories/categories-grid";
import { CategoriesHeader } from "@/components/categories/categories-header";
import { api } from "@/convex/_generated/api";

export default async function CategoriesPage() {
  const { userId } = await auth();

  // Redirect if not authenticated (shouldn't happen with middleware, but for safety)
  if (!userId) {
    redirect("/");
  }

  // Preload categories data on the server
  const preloadedCategories = await preloadQuery(api.categories.getMainCategories);

  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      <CategoriesHeader />
      <CategoriesGrid preloadedCategories={preloadedCategories} />
    </div>
  );
}

