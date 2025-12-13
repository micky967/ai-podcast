"use client";

/**
 * Subscription Management Component
 *
 * Allows users to view their current plan and manage/cancel their subscription.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  CreditCard,
  ExternalLink,
  Crown,
  Zap,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { toast } from "sonner";
import { cancelSubscriptionAction } from "@/app/actions/user-settings";

export function SubscriptionManagement() {
  const router = useRouter();
  const { has, userId } = useAuth();
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Determine current plan
  const currentPlan = has?.({ plan: "ultra" })
    ? "ultra"
    : has?.({ plan: "pro" })
    ? "pro"
    : "free";

  const planLabels = {
    free: "Free",
    pro: "Pro",
    ultra: "Ultra",
  };

  const planColors = {
    free: "bg-gray-100 text-gray-800",
    pro: "bg-emerald-100 text-emerald-800",
    ultra: "bg-purple-100 text-purple-800",
  };

  const planIcons = {
    free: null,
    pro: Zap,
    ultra: Crown,
  };

  const PlanIcon = planIcons[currentPlan];

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancelSubscription = async () => {
    setShowCancelDialog(false);
    setIsCanceling(true);
    try {
      const result = await cancelSubscriptionAction();
      if (result.success) {
        toast.success(
          "Subscription ended successfully. Your account has been downgraded to the Free plan."
        );
        // Reload page to reflect the change
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(result.error || "Failed to end subscription");
        setIsCanceling(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to end subscription. Please try again."
      );
      setIsCanceling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription & Billing
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your subscription plan and billing information
            </CardDescription>
          </div>
          <Badge className={planColors[currentPlan]}>
            {PlanIcon && <PlanIcon className="h-3 w-3 mr-1" />}
            {planLabels[currentPlan]} Plan
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentPlan === "free" ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You're currently on the <strong>Free</strong> plan. Upgrade to
              unlock more features and capabilities.
            </p>
            <Link
              href="/dashboard/upgrade"
              prefetch={true}
              onMouseEnter={() => router.prefetch("/dashboard/upgrade")}
            >
              <Button className="gradient-emerald text-white">
                <Zap className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm font-semibold text-emerald-900 mb-1">
                Active Subscription
              </p>
              <p className="text-sm text-emerald-800">
                You're subscribed to the{" "}
                <strong>{planLabels[currentPlan]}</strong> plan. Manage your
                subscription, update payment method, or cancel anytime.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/dashboard/upgrade"
                prefetch={true}
                onMouseEnter={() => router.prefetch("/dashboard/upgrade")}
              >
                <Button
                  variant="outline"
                  className="border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleCancelClick}
                disabled={isCanceling}
                className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                {isCanceling ? "Ending..." : "End Subscription"}
              </Button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-900 mb-1">
                About Ending Subscription
              </p>
              <p className="text-xs text-blue-800">
                When you end your subscription, your account will immediately be
                downgraded to the Free plan and you'll lose access to Pro/Ultra
                features. You can resubscribe at any time.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Cancel Subscription Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">End Subscription?</DialogTitle>
                <DialogDescription className="mt-1">
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to end your subscription? Your subscription
              will end immediately and your account will be downgraded to the{" "}
              <strong>Free</strong> plan.
            </p>
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-900 mb-1">
                What happens next:
              </p>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                <li>You'll immediately lose access to Pro/Ultra features</li>
                <li>Your account will be downgraded to Free plan</li>
                <li>You can resubscribe at any time</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCanceling}
              className="sm:flex-1"
            >
              Keep Subscription
            </Button>
            <Button
              type="button"
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="bg-red-600 hover:bg-red-700 text-white sm:flex-1"
            >
              {isCanceling ? "Ending..." : "Yes, End Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

