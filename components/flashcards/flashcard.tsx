"use client";

import { useState } from "react";

interface FlashcardProps {
  front: string;
  back: string;
  rationale?: string;
}

export function Flashcard({ front, back, rationale }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="h-[320px] w-full cursor-pointer select-none [perspective:1000px]"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div 
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front of Card */}
        <div className="absolute inset-0 h-full w-full rounded-xl glass-card border-l-4 border-l-emerald-400 p-6 flex flex-col items-center justify-center text-center shadow-lg [backface-visibility:hidden]">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-4">Question</span>
          <h3 className="text-base font-medium leading-relaxed">{front}</h3>
          <p className="mt-4 text-xs text-muted-foreground italic">Click to reveal answer</p>
        </div>

        {/* Back of Card */}
        <div className="absolute inset-0 h-full w-full rounded-xl bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-400 p-6 flex flex-col items-center justify-center text-center shadow-lg overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4">Answer</span>
          <p className="text-lg leading-relaxed font-bold text-gray-900 dark:text-gray-100">{back}</p>
          
          {rationale && (
            <div className="mt-4 p-3 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-emerald-300 dark:border-emerald-600">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">Clinical Pearl</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug font-medium">{rationale}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground italic">Click to see question</p>
        </div>
      </div>
    </div>
  );
}