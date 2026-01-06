"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Flashcard } from "./flashcard";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, BookOpen, FolderOpen, RefreshCw, RotateCcw, AlertCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { generateFlashcardsAction, FlashcardScope } from "@/app/actions/flashcards";
import { toast } from "sonner";

export function FlashcardManager({ projectId }: { projectId: Id<"projects"> }) {
  const { user } = useUser();
  const userId = user?.id;
  const [isLoading, setIsLoading] = useState<FlashcardScope | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [completedCards, setCompletedCards] = useState<Set<number>>(new Set());
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [resetKey, setResetKey] = useState(0); // Increment to reset all cards to front

  // 1. Fetch the project data
  const project = useQuery(
    api.projects.getProject,
    userId ? { projectId, userId } : "skip"
  );

  // 2. Fetch the flashcard set results
  const flashcardData = useQuery(api.flashcards.getFlashcardsForProject, { projectId });

  // 3. Reset mutation for regenerating
  const resetStatus = useMutation(api.flashcards.resetFlashcardStatus);

  const handleGenerate = async (scope: FlashcardScope) => {
    if (!userId) return;
    setIsLoading(scope);
    try {
      await generateFlashcardsAction({ projectId, scope });
      toast.success(`Generating ${scope === "category" ? "40 category" : "15 project"} flashcards...`);
    } catch (error) {
      console.error("Failed to start generation:", error);
      toast.error("Failed to start generation. Please try again.");
      setIsLoading(null);
    }
  };

  const handleRegenerate = async (scope: FlashcardScope) => {
    if (!userId) return;
    try {
      await resetStatus({ projectId });
      // Small delay then trigger new generation
      setTimeout(() => handleGenerate(scope), 500);
    } catch (error) {
      console.error("Failed to reset:", error);
      toast.error("Failed to reset. Please try again.");
    }
  };

  const handleRetry = async () => {
    if (!userId) return;
    try {
      await resetStatus({ projectId });
      toast.info("Ready to try again");
    } catch (error) {
      console.error("Failed to reset:", error);
    }
  };

  const handleRetest = () => {
    setCurrentCardIndex(0);
    setCompletedCards(new Set());
    setIsStudyMode(true);
    setResetKey(prev => prev + 1); // Flip all cards back to question side
  };

  const markCardComplete = (index: number) => {
    setCompletedCards(prev => new Set([...prev, index]));
    if (flashcardData && index < flashcardData.cards.length - 1) {
      setCurrentCardIndex(index + 1);
    }
  };

  // -- UI STATE: Initial Loading --
  if (project === undefined || !userId) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (!project) return <div>Project not found or access denied.</div>;

  const status = (project as any).flashcardStatus || "idle";
  const hasCategory = !!(project as any).categoryId;

  // -- UI STATE: Failed --
  if (status === "failed" || (status === "completed" && flashcardData && flashcardData.cards.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-destructive/50 rounded-xl bg-destructive/5">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-destructive">Generation Failed</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs mt-2 mb-6">
          We couldn&apos;t generate flashcards. This might be due to missing transcript data.
        </p>
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // -- UI STATE: Generating (In Progress) --
  if (status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-medium">Creating USMLE-Style Questions...</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">
          Generating high-yield clinical vignettes from your transcript. This usually takes 30-60 seconds.
        </p>
      </div>
    );
  }

  // -- UI STATE: Completed (Show the Cards) --
  if (status === "completed" && flashcardData && flashcardData.cards.length > 0) {
    const allCompleted = completedCards.size === flashcardData.cards.length;
    const progress = Math.round((completedCards.size / flashcardData.cards.length) * 100);

    return (
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Fixed Header with stats and actions */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold gradient-emerald-text">{flashcardData.title}</h3>
              <p className="text-sm text-muted-foreground">
                {flashcardData.cards.length} USMLE-style questions • {completedCards.size} reviewed ({progress}%)
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Show Restart button after first card is clicked */}
              {completedCards.size > 0 && (
                <Button onClick={handleRetest} size="sm" className="gap-2 gradient-emerald text-white hover-glow cursor-pointer">
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleRegenerate("project")} 
                className="gap-2 cursor-pointer hover:border-emerald-400 hover:text-emerald-600"
              >
                <RefreshCw className="h-4 w-4" />
                New Project Set
              </Button>
              {hasCategory && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleRegenerate("category")} 
                  className="gap-2 cursor-pointer hover:border-emerald-400 hover:text-emerald-600"
                >
                  <FolderOpen className="h-4 w-4" />
                  New Category Set
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Scrollable Cards grid */}
        <div className="flex-1 overflow-y-auto pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
            {flashcardData.cards.map((card: any, idx: number) => (
              <div key={idx} onClick={() => markCardComplete(idx)}>
                <Flashcard
                  front={card.front}
                  back={card.back}
                  rationale={card.rationale}
                  resetKey={resetKey}
                />
              </div>
            ))}
          </div>

          {/* Completion message */}
          {allCompleted && (
            <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 mb-6">
              <h4 className="text-lg font-semibold text-emerald-600 mb-2">🎉 All Cards Reviewed!</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Great job! You&apos;ve gone through all {flashcardData.cards.length} questions.
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={handleRetest} className="gap-2 gradient-emerald text-white hover-glow cursor-pointer">
                  <RotateCcw className="h-4 w-4" />
                  Retest All Cards
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -- UI STATE: Idle (Show the Two Generate Buttons) --
  return (
    <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl">
      <div className="gradient-emerald p-4 rounded-full mb-4 shadow-lg">
        <Sparkles className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-lg font-semibold mb-2 gradient-emerald-text">Generate USMLE-Style Flashcards</h3>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        Create high-yield clinical vignette questions in UWorld format. Perfect for board exam prep.
      </p>

      {/* Two Generate Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
        {/* Generate for Category */}
        <Button
          onClick={() => handleGenerate("category")}
          size="lg"
          disabled={!hasCategory || isLoading !== null}
          className={`flex-1 h-auto py-4 flex-col gap-2 cursor-pointer ${
            hasCategory 
              ? "gradient-emerald text-white hover-glow shadow-lg" 
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isLoading === "category" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FolderOpen className="h-5 w-5" />
          )}
          <span className="font-semibold">Generate for Category</span>
          <span className="text-xs opacity-80">
            {hasCategory ? "40 questions from all files" : "No category assigned"}
          </span>
        </Button>

        {/* Generate for Project */}
        <Button
          onClick={() => handleGenerate("project")}
          size="lg"
          variant="outline"
          disabled={isLoading !== null}
          className="flex-1 h-auto py-4 flex-col gap-2 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          {isLoading === "project" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <BookOpen className="h-5 w-5" />
          )}
          <span className="font-semibold">Generate for Project</span>
          <span className="text-xs opacity-80">15 questions from this file</span>
        </Button>
      </div>
    </div>
  );
}