"use client";

import { Protect, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { Crown, Home, Shield, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardNav } from "@/components/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinRequestsNotification } from "@/components/sharing/join-requests-notification";
import { UserActivityTracker } from "@/components/user-activity-tracker";

export function Header() {
  const { isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname?.startsWith("/dashboard");
  const showDashboardNav = isDashboard;

  // Check if user is admin
  const isAdmin = useQuery(
    api.userSettings.isUserAdmin,
    userId ? { userId } : "skip"
  );

  return (
    <header
      className={
        isDashboard
          ? "gradient-emerald sticky top-0 transition-all shadow-xl backdrop-blur-sm z-50 border-b border-white/10"
          : "glass-nav sticky top-0 transition-all z-50 backdrop-blur-md border-b border-gray-200/50 shadow-sm"
      }
    >
      <div className="container mx-auto px-1 sm:px-2 md:px-4 lg:px-6 overflow-hidden max-w-full">
        <div className="flex items-center justify-between h-14 sm:h-16 overflow-hidden max-w-full">
          <div className={`flex items-center gap-0.5 sm:gap-1 md:gap-2 lg:gap-8 min-w-0 flex-shrink overflow-hidden ${isDashboard ? 'max-w-[45%] md:max-w-none' : ''}`}>
            <Link
              href="/"
              className="flex items-center gap-0.5 sm:gap-1 md:gap-2.5 hover:opacity-90 transition-all duration-300 group min-w-0 flex-shrink"
            >
              <div
                className={
                  isDashboard
                    ? "p-1 sm:p-1.5 md:p-2 rounded-lg sm:rounded-xl bg-white/95 group-hover:bg-white group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 flex-shrink-0"
                    : "p-1 sm:p-1.5 md:p-2 rounded-lg sm:rounded-xl gradient-emerald group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 flex-shrink-0"
                }
              >
                <Sparkles
                  className={
                    isDashboard
                      ? "h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-emerald-600 group-hover:rotate-12 transition-transform duration-300"
                      : "h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white group-hover:rotate-12 transition-transform duration-300"
                  }
                />
              </div>
              <span
                className={
                  isDashboard
                    ? "hidden md:inline text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold text-white tracking-tight whitespace-nowrap"
                    : "text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold gradient-emerald-text tracking-tight whitespace-nowrap"
                }
              >
                MedTrain
              </span>
            </Link>

            {/* Dashboard Navigation inline with logo */}
            {showDashboardNav && (
              <div className="flex items-center pl-0 sm:pl-0.5 md:pl-1 lg:pl-2 xl:pl-4 border-l border-white/20 flex-shrink-0 overflow-hidden">
                <DashboardNav />
              </div>
            )}
          </div>

          <div className="flex items-center gap-0 sm:gap-0.5 md:gap-1 lg:gap-2 xl:gap-3 flex-shrink-0 min-w-0">
            {isSignedIn ? (
              <>
                {/* Show "Upgrade to Pro" for Free users - hide on mobile dashboard */}
                <Protect
                  condition={(has) =>
                    !has({ plan: "pro" }) && !has({ plan: "ultra" })
                  }
                  fallback={null}
                >
                  <Link
                    href="/dashboard/upgrade"
                    prefetch={true}
                    onMouseEnter={() => router.prefetch("/dashboard/upgrade")}
                    className={isDashboard ? "hidden md:block" : ""}
                  >
                    <Button
                      className={
                        isDashboard
                          ? "bg-white/95 text-emerald-600 hover:bg-white hover:scale-101 hover:cursor-pointer gap-2 shadow-lg font-semibold transition-all duration-300 border border-white/20"
                          : "gradient-emerald text-white hover-glow hover:scale-101 hover:cursor-pointer gap-2 shadow-lg transition-all duration-300"
                      }
                    >
                      <Zap className="h-4 w-4" />
                      <span className="hidden lg:inline">Upgrade to Pro</span>
                      <span className="lg:hidden">Pro</span>
                    </Button>
                  </Link>
                </Protect>

                {/* Show "Upgrade to Ultra" for Pro users - hide on mobile dashboard */}
                <Protect
                  condition={(has) =>
                    has({ plan: "pro" }) && !has({ plan: "ultra" })
                  }
                  fallback={null}
                >
                  <Link
                    href="/dashboard/upgrade"
                    prefetch={true}
                    onMouseEnter={() => router.prefetch("/dashboard/upgrade")}
                    className={isDashboard ? "hidden md:block" : ""}
                  >
                    <Button
                      className={
                        isDashboard
                          ? "bg-white/95 text-emerald-600 hover:bg-white hover:scale-105 gap-2 shadow-lg font-semibold transition-all duration-300 border border-white/20"
                          : "gradient-emerald text-white hover-glow hover:scale-105 gap-2 shadow-lg transition-all duration-300"
                      }
                    >
                      <Crown className="h-4 w-4" />
                      <span className="hidden lg:inline">Upgrade to Ultra</span>
                      <span className="lg:hidden">Ultra</span>
                    </Button>
                  </Link>
                </Protect>

                {/* Show Ultra badge for Ultra users */}
                <Protect
                  condition={(has) => has({ plan: "ultra" })}
                  fallback={null}
                >
                  <Badge
                    className={
                      isDashboard
                        ? "gap-1.5 hidden md:flex bg-white/95 text-emerald-600 border-0 px-3 py-1.5 shadow-md hover:shadow-lg transition-all duration-300"
                        : "gap-1.5 hidden md:flex gradient-emerald text-white border-0 px-3 py-1.5 shadow-md hover:shadow-lg transition-all duration-300"
                    }
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span className="font-semibold">Ultra</span>
                  </Badge>
                </Protect>

                {!showDashboardNav && (
                  <>
                    <Link
                      href="/dashboard/projects"
                      prefetch={true}
                      onMouseEnter={() =>
                        router.prefetch("/dashboard/projects")
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          isDashboard
                            ? "hover-scale text-white hover:bg-white/20 transition-all duration-300"
                            : "hover-scale transition-all duration-300"
                        }
                      >
                        <span className="hidden lg:inline">My Projects</span>
                        <span className="lg:hidden">Projects</span>
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/dashboard/admin"
                        prefetch={true}
                        onMouseEnter={() => router.prefetch("/dashboard/admin")}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            isDashboard
                              ? "gap-2 hover-scale text-white hover:bg-white/20 transition-all duration-300"
                              : "gap-2 hover-scale transition-all duration-300"
                          }
                        >
                          <Shield className="h-4 w-4" />
                          <span className="hidden lg:inline">Admin</span>
                        </Button>
                      </Link>
                    )}
                  </>
                )}
                {showDashboardNav && (
                  <Link href="/" className="hidden lg:block" prefetch={true}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        isDashboard
                          ? "gap-2 hover-scale text-white hover:bg-white/20 transition-all duration-300"
                          : "gap-2 hover-scale transition-all duration-300"
                      }
                    >
                      <Home className="h-4 w-4" />
                      Home
                    </Button>
                  </Link>
                )}
                {/* Show notification component on dashboard pages */}
                {isDashboard && (
                  <div className="hidden md:block">
                    <JoinRequestsNotification />
                  </div>
                )}
                <div className={isDashboard ? "scale-75 sm:scale-90 md:scale-100 lg:scale-110 hover:scale-125 transition-transform duration-300 flex-shrink-0" : "scale-110 hover:scale-125 transition-transform duration-300 flex-shrink-0"}>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </>
            ) : (
              <SignInButton mode="modal">
                <Button
                  className={
                    isDashboard
                      ? "bg-white/95 text-emerald-600 hover:bg-white hover:scale-105 shadow-lg font-semibold transition-all duration-300 "
                      : "gradient-emerald text-white hover-glow hover:scale-105 shadow-lg transition-all duration-300 hover:cursor-pointer"
                  }
                >
                  Sign In
                </Button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
      <UserActivityTracker />
    </header>
  );
}
