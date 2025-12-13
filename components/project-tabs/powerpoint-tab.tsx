"use client";

import { Button } from "@/components/ui/button";

interface SlideOutline {
  title: string;
  bullets: string[];
  notes?: string;
  visualHint?: string;
  layout?: string;
}

interface PowerPointTabProps {
  powerPoint?: {
    slides?: SlideOutline[];
    summary?: string;
    theme?: string;
    downloadUrl?: string;
  };
}

export function PowerPointTab({ powerPoint }: PowerPointTabProps) {
  if (!powerPoint?.slides?.length) {
    return (
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold mb-4 gradient-emerald-text">
          PowerPoint Outline
        </h3>
        <p className="text-sm text-muted-foreground">
          Slide outlines will appear here once the audio or document has been
          processed. Hit "Regenerate" from the dashboard if you need to rebuild
          the deck with updated notes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 md:p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-xl md:text-2xl font-bold gradient-emerald-text">
              PowerPoint Outline
            </h3>
            {powerPoint.theme && (
              <p className="text-sm text-muted-foreground">
                Suggested theme: {powerPoint.theme}
              </p>
            )}
          </div>
          {powerPoint.downloadUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-600 hover:text-white"
            >
              <a href={powerPoint.downloadUrl} target="_blank" rel="noreferrer">
                Download deck
              </a>
            </Button>
          )}
        </div>

        {powerPoint.summary && (
          <p className="text-sm text-gray-700 leading-relaxed">
            {powerPoint.summary}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {powerPoint.slides.map((slide, idx) => (
          <div
            key={`${slide.title}-${idx}`}
            className="glass-card rounded-2xl p-5 border border-emerald-100 bg-white/70 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-lg font-semibold text-gray-900">
                Slide {idx + 1}: {slide.title}
              </p>
              {slide.layout && (
                <span className="text-xs uppercase tracking-wide text-emerald-600">
                  {slide.layout} layout
                </span>
              )}
            </div>

            <ul className="list-disc list-inside mb-3 space-y-1 text-sm text-gray-700">
              {slide.bullets.map((bullet, bulletIdx) => (
                <li key={`slide-${idx}-bullet-${bulletIdx}`}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

