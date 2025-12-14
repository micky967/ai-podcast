/**
 * Settings Page
 *
 * Allows users to manage their required API keys and subscription.
 * Users MUST provide their own OpenAI and AssemblyAI API keys
 * to process podcasts. Keys are provided by the administrator.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";
import { SubscriptionManagement } from "@/components/settings/subscription-management";
import { UserSettingsInitializer } from "@/components/user-settings-initializer";
import { api } from "@/convex/_generated/api";
import { preloadQuery } from "convex/nextjs";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Preload user settings status (frontend only sees if keys are set, not the keys themselves)
  const preloadedSettings = await preloadQuery(
    api.userSettings.getUserSettingsStatus,
    {
      userId,
    }
  );

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      {/* Initialize user settings client-side (has proper auth context) */}
      <UserSettingsInitializer />
      
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold mb-3">Settings</h1>
          <p className="text-lg text-gray-600">
            Manage your subscription and configure your API keys.{" "}
            <strong>Both OpenAI and AssemblyAI keys are required</strong> to
            process podcasts.
          </p>
        </div>

        {/* Subscription Management */}
        <SubscriptionManagement />

        {/* Settings Form */}
        <SettingsForm preloadedSettings={preloadedSettings} />
      </div>
    </div>
  );
}
