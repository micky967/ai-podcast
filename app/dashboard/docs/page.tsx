import { BookOpen } from "lucide-react";
import { DocumentationContent } from "@/components/docs/documentation-content";

export default function DocumentationPage() {
  return (
    <div className="min-h-screen mesh-background-subtle">
      <div className="container max-w-6xl mx-auto py-4 sm:py-6 md:py-8 lg:py-10 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-0">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full gradient-emerald mb-4 sm:mb-6 shadow-lg">
            <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 sm:mb-3">
            <span className="gradient-emerald-text">Documentation</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            Step-by-step guide to using the AI Podcast Assistant
          </p>
        </div>

        {/* Documentation Content */}
        <DocumentationContent />
      </div>
    </div>
  );
}
