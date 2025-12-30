"use client";

import { useState, useRef, useEffect } from "react";
import { QuizQuestion } from "./quiz-question";
import { QuizResults } from "./quiz-results";
import { BookOpen, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateQuizAction } from "@/app/actions/projects";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

interface QuizQuestionType {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface Quiz {
  contentType: "podcast" | "document";
  questionCount: number;
  questions: QuizQuestionType[];
  generatedAt?: number;
  status?: "pending" | "completed" | "failed";
}

interface QuizTabProps {
  quiz: Quiz | null | undefined;
  projectId: Id<"projects">;
  isShared: boolean;
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomizeQuizQuestions(questions: readonly QuizQuestionType[]): QuizQuestionType[] {
  const randomized = shuffleArray(questions).map((q) => {
    const optionsWithIndex = q.options.map((opt, idx) => ({ opt, idx }));
    const shuffledOptions = shuffleArray(optionsWithIndex);
    const newCorrectAnswer = shuffledOptions.findIndex(
      (x) => x.idx === q.correctAnswer
    );

    return {
      ...q,
      options: shuffledOptions.map((x) => x.opt),
      correctAnswer: newCorrectAnswer,
    };
  });

  return randomized;
}

export function QuizTab({ quiz, projectId, isShared }: QuizTabProps) {
  const [displayQuestions, setDisplayQuestions] = useState<QuizQuestionType[]>(
    () => (quiz?.questions ? randomizeQuizQuestions(quiz.questions) : [])
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Randomize questions whenever the quiz payload changes (new quiz generated, refresh, etc.)
  useEffect(() => {
    if (quiz?.questions?.length) {
      setDisplayQuestions(randomizeQuizQuestions(quiz.questions));
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setIsSubmitted(false);
      setShowResults(false);
    }
  }, [quiz?.generatedAt]);

  // Auto-scroll to current question when it changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const questionButton = container.querySelector(`[data-question-index="${currentQuestionIndex}"]`) as HTMLElement;
      if (questionButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = questionButton.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const buttonLeft = buttonRect.left - containerRect.left + scrollLeft;
        const buttonRight = buttonLeft + buttonRect.width;
        const containerWidth = containerRect.width;

        // Scroll if button is outside visible area
        if (buttonLeft < scrollLeft) {
          container.scrollTo({ left: buttonLeft - 20, behavior: 'smooth' });
        } else if (buttonRight > scrollLeft + containerWidth) {
          container.scrollTo({ left: buttonRight - containerWidth + 20, behavior: 'smooth' });
        }
      }
    }
  }, [currentQuestionIndex]);

  const scrollQuestions = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = 200; // pixels to scroll
      const newScrollLeft = direction === 'left' 
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    try {
      const result = await generateQuizAction({ projectId });
      if (result.success) {
        toast.success("Quiz generation started! It may take a few minutes.");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to generate quiz");
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate quiz. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Show loading state if quiz is being generated
  if (quiz?.status === "pending" || isGenerating) {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Generating Quiz...
        </h2>
        <p className="text-gray-600">
          This may take a few minutes. Please keep this tab open.
        </p>
      </div>
    );
  }

  // Show empty state if no quiz or quiz failed
  const hasNoQuiz = !quiz || !quiz.questions || quiz.questions.length === 0;
  const quizFailed = quiz?.status === "failed";
  
  if (hasNoQuiz || quizFailed) {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
        <BookOpen className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {quizFailed ? "Quiz Generation Failed" : "No Quiz Available"}
        </h2>
        <p className="text-gray-600 mb-6">
          {quizFailed
            ? "The quiz generation encountered an error. Please try generating again."
            : "A multiple-choice quiz can be generated from this content."}
        </p>
        {!isShared && (
          <Button
            onClick={handleGenerateQuiz}
            disabled={isGenerating}
            className="gradient-emerald text-white hover-glow shadow-lg px-6 py-3"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Generate Quiz
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  const questions = displayQuestions.length ? displayQuestions : quiz.questions;
  const safeIndex = Math.min(currentQuestionIndex, questions.length - 1);
  const currentQuestion = questions[safeIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = answeredCount === totalQuestions;

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    if (isSubmitted) return; // Don't allow changes after submission

    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: answerIndex,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    setShowResults(true);
  };

  const handleRetake = () => {
    setDisplayQuestions(randomizeQuizQuestions(quiz.questions));
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setShowResults(false);
  };

  if (showResults) {
    return (
      <QuizResults
        questions={questions}
        selectedAnswers={selectedAnswers}
        onRetake={handleRetake}
      />
    );
  }

  return (
    <div className="quiz-root space-y-6 w-full max-w-full overflow-x-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Progress Bar */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 w-full max-w-full overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
          <span className="text-sm sm:text-base font-medium text-gray-700 truncate min-w-0 flex-1">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-xs sm:text-sm text-gray-500 shrink-0">
            {answeredCount} / {totalQuestions} answered
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%" }}>
          <div
            className="bg-emerald-600 h-2 sm:h-3 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(((currentQuestionIndex + 1) / totalQuestions) * 100, 100)}%`,
              maxWidth: "100%",
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-full overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <QuizQuestion
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          selectedAnswer={selectedAnswers[currentQuestion.id]}
          onAnswerSelect={(answerIndex) =>
            handleAnswerSelect(currentQuestion.id, answerIndex)
          }
          isSubmitted={isSubmitted}
        />
      </div>

      {/* Navigation */}
      <div className="space-y-4 w-full max-w-full box-border" style={{ width: "100%", maxWidth: "100%" }}>
        {/* Question Navigation Dots - Full Width Scrollable with Scroll Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 w-full min-w-0 max-w-full box-border" style={{ width: "100%", maxWidth: "100%" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollQuestions('left')}
            className="flex-shrink-0"
            aria-label="Scroll questions left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div 
            ref={scrollContainerRef}
            className="flex-1 min-w-0 max-w-full overflow-x-auto px-1 sm:px-2 scrollbar-hide box-border"
            style={{ minWidth: 0, maxWidth: "100%" }}
          >
            <div className="flex gap-2 min-w-max">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  data-question-index={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    idx === currentQuestionIndex
                      ? "bg-emerald-600 text-white"
                      : selectedAnswers[questions[idx].id] !== undefined
                      ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  aria-label={`Go to question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollQuestions('right')}
            className="flex-shrink-0"
            aria-label="Scroll questions right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Previous/Next/Finish Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 w-full min-w-0 max-w-full box-border" style={{ width: "100%", maxWidth: "100%" }}>
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="w-full sm:w-auto"
          >
            Previous
          </Button>

          {currentQuestionIndex < totalQuestions - 1 ? (
            <Button
              onClick={handleNext}
              className="w-full sm:w-auto gradient-emerald text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="w-full sm:w-auto gradient-emerald text-white"
            >
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
