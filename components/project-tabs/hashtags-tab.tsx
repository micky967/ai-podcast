"use client";

import { Check, Copy, Hash } from "lucide-react";
import { SocialIcon } from "react-social-icons";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";

interface HashtagsTabProps {
  hashtags?: {
    instagram: string[];
    linkedin: string[];
    tiktok: string[];
    twitter: string[];
    youtube: string[];
  };
}

const PLATFORMS = [
  {
    key: "twitter" as const,
    title: "Twitter / X",
    url: "https://twitter.com",
    bgColor: "bg-black/5",
    hoverColor: "hover:bg-black/10",
  },
  {
    key: "linkedin" as const,
    title: "LinkedIn",
    url: "https://linkedin.com",
    bgColor: "bg-blue-50",
    hoverColor: "hover:bg-blue-100",
  },
  {
    key: "instagram" as const,
    title: "Instagram",
    url: "https://instagram.com",
    bgColor: "bg-pink-50",
    hoverColor: "hover:bg-pink-100",
  },
  {
    key: "tiktok" as const,
    title: "TikTok",
    url: "https://tiktok.com",
    bgColor: "bg-slate-50",
    hoverColor: "hover:bg-slate-100",
  },
  {
    key: "youtube" as const,
    title: "YouTube",
    url: "https://youtube.com",
    bgColor: "bg-red-50",
    hoverColor: "hover:bg-red-100",
  },
];

export function HashtagsTab({ hashtags }: HashtagsTabProps) {
  const { copy, isCopied } = useCopyToClipboard();

  if (!hashtags) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {PLATFORMS.map((platform) => {
        const tags = hashtags[platform.key] || [];
        const tagsText = tags.join(" ");

        return (
          <div
            key={platform.key}
            className={`glass-card rounded-2xl p-4 md:p-6 ${platform.bgColor}`}
          >
            {/* Header with Icon and Title */}
            <div className="flex items-start gap-3 md:gap-5 mb-4 md:mb-6">
              <div className="shrink-0">
                <SocialIcon
                  url={platform.url}
                  style={{ height: 48, width: 48 }}
                  className="md:h-14 md:w-14"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base md:text-xl mb-1 wrap-break-word">
                  {platform.title}
                </h3>
                <p className="text-xs md:text-sm text-gray-600">
                  {tags.length} hashtag{tags.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  copy(
                    tagsText,
                    platform.key,
                    `${platform.title} hashtags copied to clipboard!`,
                  )
                }
                className="shrink-0 gradient-emerald text-white shadow-md text-xs md:text-sm"
                disabled={tags.length === 0}
              >
                {isCopied(platform.key) ? (
                  <>
                    <Check className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Hashtags Content */}
            <div className="relative">
              <div className="rounded-xl bg-white p-4 md:p-5 text-xs md:text-sm border-2 shadow-sm">
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-gray-700"
                      >
                        <Hash className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No hashtags available</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

