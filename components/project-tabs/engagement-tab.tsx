"use client";

import { Check, Copy } from "lucide-react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";

interface EngagementTabProps {
  engagement?: {
    commentStarters: Array<{
      question: string;
      answer: string;
    }>;
    pinComment: string;
    communityPosts: string[];
    descriptions: {
      short: string;
      medium: string;
      long: string;
    };
  };
}

export function EngagementTab({ engagement }: EngagementTabProps) {
  const { copy, isCopied } = useCopyToClipboard();

  // TabContent ensures this is never undefined at runtime
  if (!engagement) return null;

  return (
    <div className="space-y-6">
      {/* Pin-Worthy Comment */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 md:mb-6 gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold gradient-emerald-text mb-2">
              Pin-Worthy Comment
            </h3>
            <p className="text-sm text-gray-600">
              Perfect comment to pin on YouTube - sets the tone for your
              community
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              copy(
                engagement.pinComment,
                "pin-comment",
                "Pin comment copied to clipboard!",
              )
            }
            className="shrink-0 gradient-emerald text-white hover-glow shadow-lg gap-2"
          >
            {isCopied("pin-comment") ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
        <div className="p-4 md:p-5 glass-card rounded-xl border-l-4 border-l-emerald-400">
          <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed text-gray-700 wrap-break-word">
            {engagement.pinComment}
          </p>
        </div>
      </div>

      {/* Comment Starters with Answers */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 gradient-emerald-text">
          Comment Starters with Answers
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Anticipated questions to prime engagement - click any question to
          reveal your answer
        </p>
        <Accordion className="space-y-3">
          {engagement.commentStarters.map((item, idx) => (
            <div
              key={`comment-${idx}`}
              className="glass-card rounded-xl border-l-4 border-l-emerald-400 overflow-hidden"
            >
              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="shrink-0 font-bold text-emerald-600 text-base md:text-lg mt-3">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <AccordionItem title={item.question}>
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-sm md:text-base text-gray-700 leading-relaxed wrap-break-word">
                          {item.answer}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copy(
                              item.question,
                              `question-${idx}`,
                              "Question copied!",
                            )
                          }
                          className="border-emerald-300 hover:bg-emerald-50"
                        >
                          {isCopied(`question-${idx}`) ? (
                            <>
                              <Check className="h-4 w-4 mr-2 text-emerald-600" />
                              Copied Question
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2 text-emerald-600" />
                              Copy Question
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copy(item.answer, `answer-${idx}`, "Answer copied!")
                          }
                          className="border-emerald-300 hover:bg-emerald-50"
                        >
                          {isCopied(`answer-${idx}`) ? (
                            <>
                              <Check className="h-4 w-4 mr-2 text-emerald-600" />
                              Copied Answer
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2 text-emerald-600" />
                              Copy Answer
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </AccordionItem>
                </div>
              </div>
            </div>
          ))}
        </Accordion>
      </div>

      {/* Community Post Ideas */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 gradient-emerald-text">
          Community Post Ideas
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Follow-up content ideas to keep your audience engaged between episodes
        </p>
        <div className="space-y-3">
          {engagement.communityPosts.map((post, idx) => (
            <div
              key={`post-${idx}`}
              className="flex items-start gap-3 md:gap-4 p-4 md:p-5 glass-card rounded-xl border-l-4 border-l-emerald-400"
            >
              <span className="shrink-0 font-bold text-gray-900 text-base md:text-lg">
                {idx + 1}.
              </span>
              <p className="flex-1 text-sm md:text-base leading-relaxed text-gray-700 wrap-break-word">
                {post}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(post, `post-${idx}`, "Post idea copied!")}
                className="shrink-0"
              >
                {isCopied(`post-${idx}`) ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 text-emerald-600" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Podcast Descriptions */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 gradient-emerald-text">
          Podcast Descriptions
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Three description lengths optimized for different contexts
        </p>

        <div className="space-y-6">
          {/* Short Description */}
          <div>
            <div className="flex items-start sm:items-center justify-between mb-3 gap-4">
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-900">
                  Short (150-200 chars)
                </h4>
                <p className="text-xs md:text-sm text-gray-600">
                  Perfect for social media previews
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  copy(
                    engagement.descriptions.short,
                    "desc-short",
                    "Short description copied!",
                  )
                }
                className="shrink-0 gradient-emerald text-white hover-glow shadow-lg gap-2"
              >
                {isCopied("desc-short") ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="p-4 md:p-5 glass-card rounded-xl border-l-4 border-l-emerald-400">
              <p className="text-sm md:text-base leading-relaxed text-gray-700 wrap-break-word">
                {engagement.descriptions.short}
              </p>
            </div>
          </div>

          {/* Medium Description */}
          <div>
            <div className="flex items-start sm:items-center justify-between mb-3 gap-4">
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-900">
                  Medium (300-500 chars)
                </h4>
                <p className="text-xs md:text-sm text-gray-600">
                  Ideal for podcast feeds and directories
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  copy(
                    engagement.descriptions.medium,
                    "desc-medium",
                    "Medium description copied!",
                  )
                }
                className="shrink-0 gradient-emerald text-white hover-glow shadow-lg gap-2"
              >
                {isCopied("desc-medium") ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="p-4 md:p-5 glass-card rounded-xl border-l-4 border-l-emerald-400">
              <p className="text-sm md:text-base leading-relaxed text-gray-700 wrap-break-word">
                {engagement.descriptions.medium}
              </p>
            </div>
          </div>

          {/* Long Description */}
          <div>
            <div className="flex items-start sm:items-center justify-between mb-3 gap-4">
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-900">
                  Long (800-1000 words)
                </h4>
                <p className="text-xs md:text-sm text-gray-600">
                  Full show notes for blog posts and YouTube
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  copy(
                    engagement.descriptions.long,
                    "desc-long",
                    "Long description copied!",
                  )
                }
                className="shrink-0 gradient-emerald text-white hover-glow shadow-lg gap-2"
              >
                {isCopied("desc-long") ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="p-4 md:p-5 glass-card rounded-xl border-l-4 border-l-emerald-400 max-h-96 overflow-y-auto">
              <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed text-gray-700 wrap-break-word">
                {engagement.descriptions.long}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
