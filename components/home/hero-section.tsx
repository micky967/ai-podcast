"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PodcastUploader } from "@/components/podcast-uploader";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const { userId } = useAuth();
  const isSignedIn = !!userId;
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <section className="relative overflow-hidden mesh-background">
      <div className="container mx-auto px-4 py-24 md:pb-32 md:pt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20 animate-float">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card hover-glow mb-8 animate-shimmer">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                AI-Powered Podcast Processing
              </span>
            </div>

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold mb-8 leading-tight">
              <span className="gradient-emerald-text">Transform</span> Your
              <br />
              Podcasts with AI
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Upload your podcasts or PDF files and get AI-generated summaries,
              transcripts, social posts, key moments, questions and answers plus more. The questions and answers can be exported as a CSV file and then import them into Anki to create study flash cards.
            </p>
          </div>

          {isSignedIn ? (
            <div className="space-y-6 pb-32 md:pb-0">
              <div className="glass-card-strong rounded-2xl p-8 hover-lift">
                <PodcastUploader />
              </div>
              {/* Desktop buttons - hidden on mobile */}
              <div className="hidden md:flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/dashboard/projects" prefetch={true}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="hover-glow hover:cursor-pointer text-lg px-8 py-6 rounded-xl"
                  >
                    View All Projects
                  </Button>
                </Link>
                <Link href="/dashboard/categories" prefetch={true}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="hover-glow hover:cursor-pointer text-lg px-8 py-6 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    Browse Categories
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop buttons - hidden on mobile */}
              <div className="hidden md:flex flex-col sm:flex-row items-center justify-center gap-4">
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    className="gradient-emerald text-white hover-glow text-lg px-8 py-6 rounded-xl shadow-lg hover:cursor-pointer"
                  >
                    Get Started
                    <Sparkles className="ml-2 h-6 w-6" />
                  </Button>
                </SignInButton>
                <Link href="/dashboard/projects" prefetch={true}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="hover-glow text-lg px-8 py-6 rounded-xl"
                  >
                    View Projects
                  </Button>
                </Link>
                <Link href="/dashboard/categories" prefetch={true}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="hover-glow text-lg px-8 py-6 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    Browse Categories
                  </Button>
                </Link>
              </div>
            </>
          )}
          
          {/* Mobile buttons - fixed at bottom via portal using anchor tags */}
          {mounted && isMobile && typeof window !== "undefined" && createPortal(
            <div 
              style={{ 
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                width: '100%',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e5e7eb',
                boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 2147483647,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                pointerEvents: 'none'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', padding: '12px', pointerEvents: 'auto' }}>
                {isSignedIn ? (
                  <>
                    <a
                      href="/dashboard/projects"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        border: '2px solid #e5e7eb',
                        color: '#374151',
                        backgroundColor: '#ffffff',
                        padding: '16px 12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        minHeight: '64px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <span>View All Projects</span>
                    </a>
                    <a
                      href="/dashboard/categories"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        border: '2px solid #a7f3d0',
                        color: '#047857',
                        backgroundColor: '#ffffff',
                        padding: '16px 12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        minHeight: '64px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <span>Browse Categories</span>
                    </a>
                  </>
                ) : (
                  <>
                    <SignInButton mode="modal">
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'linear-gradient(to right, #10b981, #14b8a6)',
                          color: '#ffffff',
                          padding: '16px 12px',
                          fontSize: '14px',
                          fontWeight: 600,
                          minHeight: '64px',
                          borderRadius: '6px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          textDecoration: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'manipulation',
                          border: 'none'
                        }}
                      >
                        <Sparkles style={{ width: '16px', height: '16px' }} />
                        <span>Get Started</span>
                      </a>
                    </SignInButton>
                    <a
                      href="/dashboard/projects"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        border: '2px solid #e5e7eb',
                        color: '#374151',
                        backgroundColor: '#ffffff',
                        padding: '16px 12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        minHeight: '64px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <span>View Projects</span>
                    </a>
                    <a
                      href="/dashboard/categories"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        border: '2px solid #a7f3d0',
                        color: '#047857',
                        backgroundColor: '#ffffff',
                        padding: '16px 12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        minHeight: '64px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <span>Browse Categories</span>
                    </a>
                  </>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"></div>
      <div
        className="absolute bottom-0 left-0 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"
        style={{ animationDelay: "1s" }}
      ></div>
    </section>
  );
}
