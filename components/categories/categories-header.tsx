"use client";

import { FolderOpen, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CategoriesHeader() {
  const router = useRouter();
  
  return (
    <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 sm:mb-3">
            <span className="gradient-emerald-text">Categories</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">
            Browse your projects by medical specialty category
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
          <Link 
            href="/dashboard/projects"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/dashboard/projects")}
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              className="w-full sm:w-auto border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-4 sm:px-6 py-3 sm:py-6 text-sm sm:text-base"
            >
              <FolderOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">View All Projects</span>
              <span className="sm:hidden">All Projects</span>
            </Button>
          </Link>
          <Link 
            href="/dashboard/upload"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/dashboard/upload")}
            className="w-full sm:w-auto"
          >
            <Button className="w-full sm:w-auto gradient-emerald text-white hover-glow shadow-lg px-4 sm:px-6 py-3 sm:py-6 text-sm sm:text-base">
              <Upload className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">New Upload</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

