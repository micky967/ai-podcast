"use client";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { retryJob } from "@/app/actions/retry-job";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Trash2, Search, BookOpen } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClinicalScenario = {
  // New QBank format
  vignette?: string;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: {
    correct: string;
    distractors: string[];
  };
  sourceReference?: string;
  verifiedAccuracy?: boolean;
  // Legacy SOAP format
  title?: string;
  patient?: string;
  presentation?: string;
  difficulty?: number;
  soap?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  rationale?: string;
  redFlags?: string[];
  teachingPearls?: string[];
};

type ClinicalScenariosTabProps = {
  projectId: Id<"projects">;
  clinicalScenarios?: { scenarios: ClinicalScenario[] };
  isLoading?: boolean;
  userId: string;
  projectCreatorId: string;
};

export function ClinicalScenariosTab({
  projectId,
  clinicalScenarios,
  isLoading = false,
  userId,
  projectCreatorId,
}: ClinicalScenariosTabProps) {
  if (!clinicalScenarios) return null;

  const scenarios = clinicalScenarios.scenarios || [];
  const [difficulty, setDifficulty] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<number | null>(null);
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  
  // Fetch user role for permission checks
  const userRole = useQuery(api.userSettings.getUserRole, { userId });
  
  // Check if user has permission to delete scenarios
  const canDelete = userId === projectCreatorId || userRole === "owner";
  
  // Mutation for deleting scenarios
  const deleteScenario = useMutation(api.projects.deleteClinicalScenario);
  
  const handleDeleteClick = (idx: number) => {
    setScenarioToDelete(idx);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (scenarioToDelete === null) return;
    try {
      await deleteScenario({
        projectId,
        scenarioIndex: scenarioToDelete,
        userId,
      });
      toast.success("Scenario deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete scenario",
      );
    } finally {
      setScenarioToDelete(null);
    }
  };

  // Memoized filtered scenarios with original indices for proper state management
  const filteredScenarios = useMemo(() => {
    return scenarios
      .map((scenario, originalIndex) => ({ scenario, originalIndex }))
      .filter(({ scenario }) => {
        // Search filter - check vignette and question text (case-insensitive with optional chaining)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const vignette = scenario.vignette?.toLowerCase() ?? "";
          const question = scenario.question?.toLowerCase() ?? "";
          const title = scenario.title?.toLowerCase() ?? "";
          
          if (!vignette.includes(query) && !question.includes(query) && !title.includes(query)) {
            return false;
          }
        }
        
        // Difficulty filter (for legacy scenarios with difficulty field)
        // If scenario is missing difficulty field (legacy data), show it regardless of filter
        if (difficultyFilter !== "all") {
          const targetDiff = parseInt(difficultyFilter);
          // Only filter out if scenario HAS a difficulty and it doesn't match
          if (scenario.difficulty !== undefined && scenario.difficulty !== targetDiff) {
            return false;
          }
        }
        
        // Verification status filter
        if (verificationFilter === "verified" && scenario.verifiedAccuracy !== true) {
          return false;
        }
        if (verificationFilter === "not-verified" && scenario.verifiedAccuracy === true) {
          return false;
        }
        
        return true;
      });
  }, [scenarios, searchQuery, difficultyFilter, verificationFilter]);
  
  const verifiedCount = scenarios.filter((s) => s.verifiedAccuracy === true).length;
  const totalCount = scenarios.length;
  const verifiedPercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  const normalizeOptionText = (opt: string, i: number) => {
    const trimmed = opt.trim();
    if (/^[A-E][\)\.:]/i.test(trimmed)) {
      return trimmed;
    }
    return `${String.fromCharCode(65 + i)}. ${trimmed}`;
  };

  const formatAnswerText = (answer: string, index: number) => {
    const trimmed = answer.trim();
    if (/^[A-E][\)\.:]/i.test(trimmed)) {
      return trimmed;
    }

    if (index >= 0) {
      return `${String.fromCharCode(65 + index)}) ${trimmed}`;
    }

    return trimmed;
  };

  const setVerifiedAccuracy = useMutation(
    (api as any).projects.setClinicalScenarioVerifiedAccuracy,
  );

  return (
    <div className="flex-1 h-auto min-h-screen pb-40">
      <div className="glass-card rounded-2xl p-6 md:p-8 overflow-visible h-auto min-h-fit">
        <div className="mb-6 md:mb-8">
          <h3 className="text-xl md:text-2xl font-bold gradient-emerald-text mb-2">
            Clinical Scenarios
          </h3>
          <p className="text-sm text-gray-600">
            Self-testing QBank questions grounded in your uploaded content.
          </p>

          {totalCount > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <div className="font-semibold">Verification</div>
                <div>
                  {verifiedCount} / {totalCount} verified
                </div>
              </div>
              <Progress value={verifiedPercent} className="h-2" />
            </div>
          )}
        </div>

        {/* Search and Filter Bar */}
        {totalCount > 0 && (
          <div className="mb-6 glass-card rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by vignette or question text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Difficulty Filter */}
              <div className="w-full md:w-48">
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                    <SelectItem value="5">Level 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Verification Status Filter */}
              <div className="w-full md:w-48">
                <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">Verified Only</SelectItem>
                    <SelectItem value="not-verified">Not Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Results count */}
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredScenarios.length} of {totalCount} questions
            </div>
          </div>
        )}

        <div className={isGenerating ? "animate-pulse" : ""}>
          <Accordion className="w-full overflow-visible">
            {filteredScenarios.map(({ scenario: s, originalIndex }, displayIdx) => {
            // Use originalIndex for state management (revealed, delete, verify)
            const isRevealed = revealed[originalIndex] === true;
            const isQBank = typeof s.vignette === "string" && s.vignette.length > 0;
            const options = s.options ?? [];
            const correctAnswer = s.correctAnswer ?? "";
            const correctIndex = options.findIndex(
              (opt) => opt.trim() === correctAnswer.trim(),
            );

            return (
              <AccordionItem
                key={`${originalIndex}-${isQBank ? s.question : s.title}`}
                title={`${displayIdx + 1}. ${isQBank ? "QBank Question" : s.title ?? "Clinical Scenario"}`}
                className="bg-white/30 rounded-xl overflow-visible h-auto min-h-fit"
              >
                <div className="space-y-4 overflow-visible h-auto min-h-fit">
                {isQBank ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600">{s.verifiedAccuracy === true ? "Verified" : "Not verified"}</div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(originalIndex)}
                            className="text-red-500 hover:text-red-700 transition-all p-1 hover:bg-red-50 rounded cursor-pointer hover:scale-110"
                            title="Delete scenario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {s.verifiedAccuracy === true && typeof s.sourceReference === "string" && s.sourceReference.trim().length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="shrink-0">
                                <Badge className="bg-emerald-600 text-white">Verified</Badge>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="text-sm">
                              <div className="font-semibold mb-2">Source quote</div>
                              <div className="text-gray-700 whitespace-pre-wrap">{s.sourceReference}</div>
                            </PopoverContent>
                          </Popover>
                        )}
                        {s.verifiedAccuracy === true && (!s.sourceReference || s.sourceReference.trim().length === 0) && (
                          <Badge className="bg-emerald-600 text-white">Verified</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Vignette</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.vignette}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Question</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.question}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-2">Options</div>
                      <div className="space-y-2">
                        {options.map((opt, i) => (
                          <div
                            key={i}
                            className="text-sm text-gray-700 whitespace-pre-wrap"
                          >
                            {normalizeOptionText(opt, i)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Patient</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.patient}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Presentation</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.presentation}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-1">SOAP</div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold">S</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {s.soap?.subjective}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">O</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {s.soap?.objective}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">A</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {s.soap?.assessment}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">P</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {s.soap?.plan}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Rationale</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.rationale}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">Red Flags</div>
                        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                          {(s.redFlags ?? []).map((rf, i) => (
                            <li key={i}>{rf}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">
                          Teaching Pearls
                        </div>
                        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                          {(s.teachingPearls ?? []).map((tp, i) => (
                            <li key={i}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {isQBank && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRevealed((prev) => ({ ...prev, [originalIndex]: !isRevealed }))
                      }
                    >
                      {isRevealed
                        ? "Hide Answer & Explanation"
                        : "Reveal Answer & Explanation"}
                    </Button>
                  )}

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={s.verifiedAccuracy === true}
                      onChange={async (e) => {
                        try {
                          await setVerifiedAccuracy({
                            projectId,
                            scenarioIndex: originalIndex,
                            verifiedAccuracy: e.target.checked,
                            sourceQuote: s.sourceReference ?? "",
                          });
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to update verification",
                          );
                        }
                      }}
                    />
                    Verified Accuracy
                  </label>
                </div>

                {isQBank && isRevealed && (
                  <div className="space-y-3 overflow-visible h-auto min-h-fit pb-8">
                    <div className="rounded-xl bg-white/40 p-4">
                      <div className="font-semibold text-gray-900 mb-1">Answer</div>
                      <div className="text-sm text-gray-700">
                        {formatAnswerText(correctAnswer, correctIndex)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/40 p-4">
                      <div className="font-semibold text-gray-900 mb-1">
                        Explanation (Why this is right)
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.explanation?.correct}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/40 p-4">
                      <div className="font-semibold text-gray-900 mb-2">
                        Why the other options are wrong
                      </div>
                      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                        {(s.explanation?.distractors ?? []).map((d, i) => (
                          <li key={i} className="whitespace-pre-wrap">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl bg-white/40 p-4">
                      <div className="font-semibold text-gray-900 mb-1">
                        Source Reference
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {s.sourceReference}
                      </div>
                    </div>

                    {/* Expandable Rationale Section with Backward Compatibility */}
                    {s.rationale ? (
                      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="h-5 w-5 text-emerald-600" />
                          <div className="font-semibold text-gray-900">
                            Clinical Rationale
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {s.rationale}
                        </div>
                        <div className="mt-3 text-xs text-gray-500 italic">
                          This rationale explains the gold standard approach and addresses key clinical nuances.
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
                        <div className="text-sm text-gray-500 italic">
                          Rationale not available for older questions. New questions include comprehensive clinical rationales.
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </AccordionItem>
            );
            })}
          </Accordion>
        </div>

        {scenarios.length === 0 && (
          <div className="text-sm text-gray-600">No scenarios available.</div>
        )}

        {scenarios.length > 0 && scenarios.length < 20 && (
          <div className="mt-6">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="font-semibold text-gray-900">Difficulty Level</div>
                    <div className="text-sm text-gray-600">{difficulty} / 5</div>
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[difficulty]}
                    onValueChange={(value) => setDifficulty(value[0] ?? 3)}
                  />
                  <div className="mt-3 text-xs text-gray-500">
                    Level 1: Textbook. Level 3: Comorbidities. Level 5: Gray-area.
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    onClick={async () => {
                      setIsGenerating(true);
                      try {
                        await retryJob(projectId, "clinicalScenarios", difficulty);
                        toast.success("Generating 2 more scenarios...");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Failed to generate scenarios",
                        );
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    disabled={isGenerating || isLoading}
                    className="gradient-emerald text-white hover-glow shadow-lg px-6 py-3"
                  >
                    {isGenerating
                      ? "Generating..."
                      : `Generate 2 more scenarios (${scenarios.length}/20)`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Clinical Scenario"
        description="Are you absolutely sure you want to delete this scenario? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
