"use client";

import { Loader2, Sparkles } from "lucide-react";

interface GeneratingSpinnerProps {
  title?: string;
  description?: string;
}

/**
 * Beautiful loading spinner shown while AI content is being generated
 * Matches the flashcard generation UI style
 */
export function GeneratingSpinner({ 
  title = "Generating Content...",
  description = "Our AI is creating high-quality content from your transcript. This usually takes 30-60 seconds."
}: GeneratingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl">
      <div className="relative mb-6">
        {/* Animated glow background */}
        <div className="absolute inset-0 gradient-emerald opacity-20 blur-3xl rounded-full animate-pulse" />
        {/* Spinner container */}
        <div className="relative gradient-emerald p-6 rounded-full shadow-xl">
          <Loader2 className="h-12 w-12 text-white animate-spin" />
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-emerald-500" />
        <h3 className="text-xl font-semibold gradient-emerald-text">{title}</h3>
        <Sparkles className="h-5 w-5 text-emerald-500" />
      </div>
      
      <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
        {description}
      </p>
      
      {/* Animated progress dots */}
      <div className="flex gap-2 mt-6">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
