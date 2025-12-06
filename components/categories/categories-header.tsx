"use client";

import { FolderOpen, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CategoriesHeader() {
  return (
    <div className="mb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            <span className="gradient-emerald-text">Categories</span>
          </h1>
          <p className="text-lg text-gray-600">
            Browse your projects by medical specialty category
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/projects">
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-6 py-6 text-base"
            >
              <FolderOpen className="mr-2 h-5 w-5" />
              View All Projects
            </Button>
          </Link>
          <Link href="/dashboard/upload">
            <Button className="gradient-emerald text-white hover-glow shadow-lg px-6 py-6 text-base">
              <Upload className="mr-2 h-5 w-5" />
              New Upload
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

