"use client";

import {
  Upload,
  FolderOpen,
  Users,
  Settings,
  FileText,
  Share2,
  FolderTree,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Zap,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function DocumentationContent() {
  const router = useRouter();
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Show/hide scroll to top button based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const sections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Sparkles,
      steps: [
        {
          number: 1,
          title: "Sign Up or Sign In",
          description:
            "Create an account or sign in to access the AI Podcast Assistant. You can use your email, Google, or Facebook account.",
        },
        {
          number: 2,
          title: "Configure API Keys",
          description:
            "Go to Settings and add your OpenAI and AssemblyAI API keys. These are required for processing your podcasts. You can get API keys from their respective websites.",
        },
        {
          number: 3,
          title: "Choose Your Plan",
          description:
            "Select a plan that fits your needs: Free (limited features), Pro (more features), or Ultra (all features). You can upgrade anytime.",
        },
      ],
    },
    {
      id: "uploading-files",
      title: "Uploading Files",
      icon: Upload,
      steps: [
        {
          number: 1,
          title: "Navigate to Upload Page",
          description:
            "Click the 'Upload' button in the navigation bar or go to the Upload page from the dashboard.",
        },
        {
          number: 2,
          title: "Select a Category",
          description:
            "Choose a medical specialty category (required). You can also select a subcategory for better organization.",
        },
        {
          number: 3,
          title: "Choose Your File",
          description:
            "Click the upload area or drag and drop your audio file (MP3, WAV, etc.) or PDF document. Supported formats include audio files and PDF documents.",
        },
        {
          number: 4,
          title: "Wait for Processing",
          description:
            "Your file will be uploaded and processed automatically. You'll see a progress indicator. Processing time depends on file size and your plan.",
        },
        {
          number: 5,
          title: "View Results",
          description:
            "Once processing is complete, you'll be redirected to the project detail page where you can view all generated content.",
        },
      ],
    },
    {
      id: "viewing-projects",
      title: "Viewing and Managing Projects",
      icon: FolderOpen,
      steps: [
        {
          number: 1,
          title: "Access Projects Page",
          description:
            "Click 'Projects' in the navigation bar to see all your projects.",
        },
        {
          number: 2,
          title: "Use Filters",
          description:
            "Use the filter tabs: 'All Files' (your projects + shared), 'My Files' (only your projects), or 'Shared' (projects shared with you).",
        },
        {
          number: 3,
          title: "Search Projects",
          description:
            "Use the search bar to find projects by name. The search works across all your visible projects.",
        },
        {
          number: 4,
          title: "View Project Details",
          description:
            "Click on any project card to view detailed information including summary, key moments, social posts, and more.",
        },
        {
          number: 5,
          title: "Edit Project Name",
          description:
            "Click the edit icon on a project to change its display name. You can only edit your own projects.",
        },
        {
          number: 6,
          title: "Delete Projects",
          description:
            "Click the delete icon to remove a project. Deleted projects are permanently removed from your account.",
        },
      ],
    },
    {
      id: "categories",
      title: "Organizing with Categories",
      icon: FolderTree,
      steps: [
        {
          number: 1,
          title: "Browse Categories",
          description:
            "Go to the Categories page to see all available medical specialty categories.",
        },
        {
          number: 2,
          title: "Filter by Category",
          description:
            "Click on a category card to view all projects in that category. This helps you organize projects by medical specialty.",
        },
        {
          number: 3,
          title: "Change Project Category",
          description:
            "Ultra plan users can drag and drop projects onto category cards to change their category. This helps reorganize your projects.",
        },
        {
          number: 4,
          title: "Select Category on Upload",
          description:
            "When uploading, select a category to automatically organize your new project.",
        },
      ],
    },
    {
      id: "sharing",
      title: "Sharing Files",
      icon: Share2,
      steps: [
        {
          number: 1,
          title: "Go to Sharing Page",
          description:
            "Click 'Sharing' in the navigation bar to access the file sharing features.",
        },
        {
          number: 2,
          title: "Create a Group",
          description:
            "Click 'Create Group' to start sharing your files. Free users cannot create groups - upgrade to Pro or Ultra.",
        },
        {
          number: 3,
          title: "Invite Members",
          description:
            "In your group, click 'Invite Members' and search for users by name or email. Send invitations to share your files.",
        },
        {
          number: 4,
          title: "Accept Invitations",
          description:
            "When someone invites you to a group, you'll see a notification. Click to accept and gain access to their shared files.",
        },
        {
          number: 5,
          title: "View Shared Files",
          description:
            "Shared files appear in the 'Shared' tab on the Projects page. You can view and use these files but cannot edit or delete them.",
        },
        {
          number: 6,
          title: "Leave Groups",
          description:
            "You can leave a sharing group at any time. This removes your access to the group owner's files.",
        },
      ],
    },
    {
      id: "project-features",
      title: "Project Features & Content",
      icon: FileText,
      steps: [
        {
          number: 1,
          title: "Summary Tab",
          description:
            "View a comprehensive summary with key points and insights. This is available to all users.",
        },
        {
          number: 2,
          title: "Key Moments",
          description:
            "Ultra plan users can see AI-identified key moments from the podcast with timestamps.",
        },
        {
          number: 3,
          title: "Social Posts",
          description:
            "Pro and Ultra users get platform-optimized social media posts for Twitter, LinkedIn, Instagram, TikTok, YouTube, and Facebook.",
        },
        {
          number: 4,
          title: "Titles",
          description:
            "Pro and Ultra users receive suggested titles for YouTube shorts, long-form videos, podcast episodes, and SEO keywords.",
        },
        {
          number: 5,
          title: "PowerPoint",
          description:
            "Pro and Ultra users can generate PowerPoint outlines with slide content based on the podcast.",
        },
        {
          number: 6,
          title: "Q&A",
          description:
            "Ultra users get anticipated questions with answers, pin comments, and community post ideas. You will need to click on Generate Q&A to see the questions and answers.",
        },
        {
          number: 7,
          title: "Hashtags",
          description:
            "Ultra users receive platform-specific hashtag suggestions for better social media reach.",
        },
        {
          number: 8,
          title: "YouTube Timestamps",
          description:
            "Ultra users get chapter timestamps formatted for YouTube video descriptions.",
        },
        {
          number: 9,
          title: "Speaker Dialogue",
          description:
            "Ultra users can view speaker diarization showing who said what and when in the podcast.",
        },
      ],
    },
    {
      id: "settings",
      title: "Settings & Configuration",
      icon: Settings,
      steps: [
        {
          number: 1,
          title: "Access Settings",
          description:
            "Click the 'Settings' button in the navigation bar to configure your account.",
        },
        {
          number: 2,
          title: "Add API Keys",
          description:
            "Enter your OpenAI and AssemblyAI API keys. These are required for processing. Your keys are encrypted and stored securely.",
        },
        {
          number: 3,
          title: "Update API Keys",
          description:
            "You can update your API keys at any time. Changes take effect immediately for new uploads.",
        },
        {
          number: 4,
          title: "Remove API Keys",
          description:
            "You can remove your API keys if needed. You'll need to add them again before uploading new files.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Quick Navigation */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 gradient-emerald-text">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-300 group"
              >
                <div className="p-2 rounded-lg gradient-emerald group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <span className="font-medium text-sm sm:text-base text-gray-700 group-hover:text-emerald-700">
                  {section.title}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Documentation Sections */}
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div
            key={section.id}
            id={section.id}
            className="glass-card rounded-2xl p-6 sm:p-8 scroll-mt-8"
          >
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="p-3 sm:p-4 rounded-xl gradient-emerald">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold gradient-emerald-text">
                {section.title}
              </h2>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {section.steps.map((step) => (
                <div
                  key={step.number}
                  className="flex items-start gap-4 sm:gap-6 p-4 sm:p-6 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-300 border border-emerald-100"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full gradient-emerald flex items-center justify-center">
                      <span className="text-white font-bold text-lg sm:text-xl">
                        {step.number}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg sm:text-xl text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Plan Comparison */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="p-3 sm:p-4 rounded-xl gradient-emerald">
            <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold gradient-emerald-text">
            Plan Features
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-6 rounded-xl border-2 border-gray-200 bg-white/50">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-gray-600" />
              <h3 className="font-bold text-lg text-gray-900">Free</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Summary only</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>3 projects total</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>No file sharing</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl border-2 border-emerald-300 bg-emerald-50/50">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-lg text-emerald-700">Pro</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>All Free features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Social Posts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Titles & PowerPoint</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>File sharing (max 2 members)</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-lg text-emerald-700">Ultra</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>All Pro features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Key Moments & YouTube Timestamps</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Q&A & Hashtags</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Speaker Dialogue</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Unlimited file sharing</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Drag & drop categories</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <Link href="/dashboard/upgrade">
            <Button className="gradient-emerald text-white hover-glow shadow-lg px-6 sm:px-8 py-3 sm:py-6 text-sm sm:text-base">
              <Crown className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Upgrade Your Plan
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tips & Best Practices */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="p-3 sm:p-4 rounded-xl gradient-emerald">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold gradient-emerald-text">
            Tips & Best Practices
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="p-4 sm:p-6 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              File Quality
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              For best results, use high-quality audio files with clear speech.
              Avoid background noise when possible. PDF documents should have
              clear, readable text.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              Organization
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Use categories to organize your projects by medical specialty.
              This makes it easier to find specific content later. You can
              change categories anytime (Ultra plan).
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              Sharing Groups
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Create sharing groups to collaborate with colleagues. All your
              files are automatically shared with group members. They can view
              but not edit or delete your files.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              Processing Time
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Processing time depends on file length and your plan. Longer files
              take more time. You can navigate away and return later - your
              project will continue processing in the background.
            </p>
          </div>
        </div>
      </div>

      {/* Help & Support */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
        <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-emerald-600" />
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 gradient-emerald-text">
          Need More Help?
        </h2>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          If you have questions or need assistance, please check the settings
          page or contact support through your account dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard/settings">
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-6 py-3"
            >
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Button>
          </Link>
          <Link href="/dashboard/projects">
            <Button className="gradient-emerald text-white hover-glow shadow-lg px-6 py-3">
              <FolderOpen className="mr-2 h-4 w-4" />
              View Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 p-3 sm:p-4 rounded-full gradient-emerald text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group hover:cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}
    </div>
  );
}
