"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizQuestionProps {
  question: {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
    difficulty?: "easy" | "medium" | "hard";
  };
  questionNumber: number;
  selectedAnswer: number | undefined;
  onAnswerSelect: (answerIndex: number) => void;
  isSubmitted: boolean;
}

export function QuizQuestion({
  question,
  questionNumber,
  selectedAnswer,
  onAnswerSelect,
  isSubmitted,
}: QuizQuestionProps) {
  const isCorrect = selectedAnswer === question.correctAnswer;
  const showResults = isSubmitted;

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Question Header */}
      <div className="w-full overflow-hidden">
        <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate min-w-0 flex-1">
            Question {questionNumber}
          </h3>
          {question.difficulty && (
            <span
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                question.difficulty === "easy" && "bg-green-100 text-green-700",
                question.difficulty === "medium" && "bg-yellow-100 text-yellow-700",
                question.difficulty === "hard" && "bg-red-100 text-red-700",
              )}
            >
              {question.difficulty.charAt(0).toUpperCase() +
                question.difficulty.slice(1)}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base text-gray-800 leading-relaxed break-words overflow-wrap-anywhere">
          {question.question}
        </p>
      </div>

      {/* Answer Options */}
      <div className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = index === question.correctAnswer;
          const showCorrect = showResults && isCorrectOption;
          const showIncorrect = showResults && isSelected && !isCorrectOption;

          return (
            <button
              key={index}
              onClick={() => !showResults && onAnswerSelect(index)}
              disabled={showResults}
              className={cn(
                "w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200",
                "hover:shadow-md",
                !showResults && "cursor-pointer hover:border-emerald-300",
                showResults && "cursor-default",
                isSelected && !showResults && "border-emerald-500 bg-emerald-50",
                showCorrect && "border-green-500 bg-green-50",
                showIncorrect && "border-red-500 bg-red-50",
                !isSelected && !showResults && "border-gray-200 bg-white",
                !isSelected && showResults && "border-gray-200 bg-gray-50",
              )}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center font-semibold text-sm",
                    isSelected && !showResults && "border-emerald-500 bg-emerald-500 text-white",
                    showCorrect && "border-green-500 bg-green-500 text-white",
                    showIncorrect && "border-red-500 bg-red-500 text-white",
                    !isSelected && "border-gray-300 bg-white text-gray-600",
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base text-gray-800 break-words">
                    {option}
                  </p>
                </div>
                {showResults && (
                  <div className="flex-shrink-0">
                    {showCorrect && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {showIncorrect && (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResults && question.explanation && (
        <div className="mt-6 p-4 sm:p-5 rounded-xl bg-blue-50 border-2 border-blue-200">
          <h4 className="font-semibold text-sm text-blue-900 mb-2">
            Explanation:
          </h4>
          <p className="text-sm sm:text-base text-blue-800 leading-relaxed">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

