"use client";

import { FileAudio, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  message?: string; // Legacy prop for backward compatibility
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  title, 
  description, 
  message,
  actionLabel,
  onAction 
}: EmptyStateProps) {
  const router = useRouter();
  
  // Use title/description if provided, otherwise fall back to message (legacy)
  const displayTitle = title || "No projects yet";
  const displayDescription = description || message || "Upload your first podcast to unlock AI-powered insights, summaries, and social content";
  const showAction = actionLabel && onAction;
  
  return (
    <div className="glass-card rounded-3xl p-12 md:p-16 text-center hover-lift">
      <div className="max-w-md mx-auto">
        <div className="relative mb-8">
          <div className="absolute inset-0 gradient-emerald opacity-20 blur-3xl rounded-full"></div>
          <div className="relative rounded-3xl gradient-emerald p-8 w-fit mx-auto shadow-2xl">
            <FileAudio className="h-20 w-20 text-white" />
          </div>
        </div>
        <h3 className="text-3xl font-bold mb-4 text-gray-900">
          {displayTitle}
        </h3>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          {displayDescription}
        </p>
        {showAction ? (
          <Button 
            onClick={onAction}
            className="gradient-emerald text-white hover-glow shadow-xl px-8 py-6 text-lg"
          >
            <Upload className="mr-2 h-6 w-6" />
            {actionLabel}
          </Button>
        ) : !title && (
          <Link 
            href="/dashboard/upload"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/dashboard/upload")}
          >
            <Button className="gradient-emerald text-white hover-glow shadow-xl px-8 py-6 text-lg">
              <Upload className="mr-2 h-6 w-6" />
              Upload Your First Podcast
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
