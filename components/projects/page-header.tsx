"use client";

import { FolderTree, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PageHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  filter?: "all" | "own" | "shared";
  onFilterChange?: (filter: "all" | "own" | "shared") => void;
}

export function PageHeader({
  searchQuery = "",
  onSearchChange,
  filter = "all",
  onFilterChange,
}: PageHeaderProps) {
  const router = useRouter();

  const getTitle = () => {
    switch (filter) {
      case "own":
        return "My Projects";
      case "shared":
        return "Shared Projects";
      case "all":
      default:
        return "All Projects";
    }
  };

  const getDescription = () => {
    switch (filter) {
      case "own":
        return "Manage and view your own podcast projects";
      case "shared":
        return "Projects shared with you from other users";
      case "all":
      default:
        return "All your projects and projects shared with you";
    }
  };

  return (
    <div className="mb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            {filter === "own" ? (
              <>
                My <span className="gradient-emerald-text">Projects</span>
              </>
            ) : filter === "shared" ? (
              <>
                <span className="gradient-emerald-text">Shared</span> Projects
              </>
            ) : (
              <>
                All <span className="gradient-emerald-text">Projects</span>
              </>
            )}
          </h1>
          <p className="text-lg text-gray-600">
            {getDescription()}
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/dashboard/categories"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/dashboard/categories")}
          >
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-6 py-6 text-base"
            >
              <FolderTree className="mr-2 h-5 w-5" />
              Browse Categories
            </Button>
          </Link>
          <Link 
            href="/dashboard/upload"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/dashboard/upload")}
          >
            <Button className="gradient-emerald text-white hover-glow shadow-lg px-6 py-6 text-base">
              <Upload className="mr-2 h-5 w-5" />
              New Upload
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Filter and Search */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        {onFilterChange && (
          <Tabs value={filter} onValueChange={onFilterChange}>
            <TabsList>
              <TabsTrigger value="all">All Files</TabsTrigger>
              <TabsTrigger value="own">My Files</TabsTrigger>
              <TabsTrigger value="shared">Shared</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {onSearchChange && (
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search projects by name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10 h-12 text-base border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
