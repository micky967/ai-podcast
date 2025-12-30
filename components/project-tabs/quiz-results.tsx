"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface QuizResultsProps {
  questions: QuizQuestion[];
  selectedAnswers: Record<string, number>;
  onRetake: () => void;
}

export function QuizResults({
  questions,
  selectedAnswers,
  onRetake,
}: QuizResultsProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set()
  );

  // Calculate score
  let correct = 0;
  const results = questions.map((q) => {
    const isCorrect = selectedAnswers[q.id] === q.correctAnswer;
    if (isCorrect) correct++;
    return {
      question: q,
      isCorrect,
      selectedAnswer: selectedAnswers[q.id],
    };
  });

  const total = questions.length;
  const percentage = Math.round((correct / total) * 100);

  const getPerformanceMessage = () => {
    if (percentage >= 90) return "🎉 Excellent! Outstanding performance!";
    if (percentage >= 80) return "🌟 Great job! Well done!";
    if (percentage >= 70) return "👍 Good work! Keep it up!";
    if (percentage >= 60)
      return "📚 Not bad, but there's room for improvement.";
    return "💪 Keep studying! You'll get better with practice.";
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 gradient-emerald-text">
            Quiz Results
          </h2>
          <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-emerald-600 mb-2">
            {correct}/{total}
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-gray-700 mb-4">
            {percentage}%
          </div>
          <p className="text-base sm:text-lg text-gray-600">
            {getPerformanceMessage()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200">
            <div className="text-2xl sm:text-3xl font-bold text-green-700">
              {correct}
            </div>
            <div className="text-sm sm:text-base text-green-600">Correct</div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200">
            <div className="text-2xl sm:text-3xl font-bold text-red-700">
              {total - correct}
            </div>
            <div className="text-sm sm:text-base text-red-600">Incorrect</div>
          </div>
        </div>

        <Button
          onClick={onRetake}
          className="gradient-emerald text-white hover-glow shadow-lg px-6 sm:px-8 py-3 sm:py-6 text-sm sm:text-base"
        >
          <RotateCcw className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          Retake Quiz
        </Button>
      </div>

      {/* Review Answers */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
          Review Answers
        </h3>
        <div className="space-y-4">
          {results.map((result, index) => {
            const { question, isCorrect, selectedAnswer } = result;
            const isExpanded = expandedQuestions.has(question.id);

            return (
              <div
                key={question.id}
                className={cn(
                  "border-2 rounded-xl p-4 sm:p-5 transition-all cursor-pointer hover:shadow-md",
                  isCorrect
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                )}
                onClick={() => toggleQuestion(question.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-sm sm:text-base">
                        Question {index + 1}
                      </span>
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-gray-800 mb-3">
                      {question.question}
                    </p>
                    {!isExpanded && selectedAnswer !== undefined && (
                      <p className="text-xs sm:text-sm text-gray-600 italic">
                        Your answer: {String.fromCharCode(65 + selectedAnswer)}{" "}
                        - {question.options[selectedAnswer]}
                      </p>
                    )}
                    {isExpanded && (
                      <div className="space-y-2 mt-4">
                        {question.options.map((option, optIndex) => {
                          const isSelected = optIndex === selectedAnswer;
                          const isCorrectOption =
                            optIndex === question.correctAnswer;

                          return (
                            <div
                              key={optIndex}
                              className={cn(
                                "p-3 rounded-lg border-2",
                                isCorrectOption
                                  ? "border-green-500 bg-green-100"
                                  : isSelected
                                  ? "border-red-500 bg-red-100"
                                  : "border-gray-200 bg-white"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {String.fromCharCode(65 + optIndex)}:
                                </span>
                                <span className="text-sm sm:text-base">
                                  {option}
                                </span>
                                {isCorrectOption && (
                                  <span className="ml-auto text-xs sm:text-sm font-semibold text-green-700">
                                    ✓ Correct
                                  </span>
                                )}
                                {isSelected && !isCorrectOption && (
                                  <span className="ml-auto text-xs sm:text-sm font-semibold text-red-700">
                                    ✗ Your Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {question.explanation && (
                          <div className="mt-3 p-3 rounded-lg bg-blue-50 border-2 border-blue-200">
                            <p className="text-xs sm:text-sm text-blue-800">
                              <strong>Explanation:</strong>{" "}
                              {question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleQuestion(question.id)}
                    className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Score Summary at Bottom */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-emerald-600 mb-2">
              {percentage}%
            </div>
            <p className="text-base sm:text-lg text-gray-600 mb-4">
              Final Score: {correct} out of {total} questions correct
            </p>
            <Button
              onClick={onRetake}
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-6 py-3"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Quiz
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
