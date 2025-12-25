"use client";

/**
 * Settings Form Component
 *
 * Allows users to enter and manage their API keys.
 * Keys are stored securely and used for processing if provided.
 */

import { useState } from "react";
import { usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  updateUserApiKeysAction,
  clearUserApiKeysAction,
} from "@/app/actions/user-settings";
import type { Preloaded } from "convex/react";
import { useAuth } from "@clerk/nextjs";

interface SettingsFormProps {
  preloadedSettings: Preloaded<typeof api.userSettings.getUserSettingsStatus>;
}

export function SettingsForm({ preloadedSettings }: SettingsFormProps) {
  const { userId } = useAuth();
  const settings = usePreloadedQuery(preloadedSettings);

  const [openaiKey, setOpenaiKey] = useState("");
  const [assemblyaiKey, setAssemblyaiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAssemblyaiKey, setShowAssemblyaiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Check if user has existing keys
  const hasExistingKeys = settings
    ? settings.hasOpenaiKey || settings.hasAssemblyaiKey
    : false;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateUserApiKeysAction({
        openaiApiKey: openaiKey || undefined,
        assemblyaiApiKey: assemblyaiKey || undefined,
      });

      if (result.success) {
        toast.success("API keys saved successfully!");
        // Clear form after successful save
        setOpenaiKey("");
        setAssemblyaiKey("");
        // Reload settings
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to save API keys");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save API keys"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your API keys? You'll use shared keys again."
      )
    ) {
      return;
    }

    setIsClearing(true);
    try {
      const result = await clearUserApiKeysAction();

      if (result.success) {
        toast.success("API keys cleared successfully!");
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to clear API keys");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear API keys"
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-900">
                API Keys Required
              </p>
              <p className="text-sm text-blue-800">
                <strong>
                  Both OpenAI and AssemblyAI API keys are required
                </strong>{" "}
                to process podcasts. Add your keys below. Your keys are stored
                securely and only used for your projects. Contact the
                administrator if you need API keys.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI API Key <span className="text-red-600">*</span>
              </CardTitle>
              <CardDescription className="mt-1">
                <strong>Required.</strong> Used for AI content generation
                (summaries, social posts, titles, etc.)
              </CardDescription>
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Get Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.hasOpenaiKey && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-semibold text-emerald-900 mb-1">
                ✅ OpenAI API Key is configured
              </p>
              <p className="text-sm text-emerald-800">
                Enter a new key below to update your existing key.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="openai-key">
              {settings?.hasOpenaiKey
                ? "Update OpenAI API Key"
                : "OpenAI API Key"}
            </Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showOpenaiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {settings?.hasOpenaiKey
                ? "Enter a new key to update your existing key."
                : "This key is required to process podcasts."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AssemblyAI API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                AssemblyAI API Key <span className="text-red-600">*</span>
              </CardTitle>
              <CardDescription className="mt-1">
                <strong>Required.</strong> Used for podcast transcription with
                speaker diarization
              </CardDescription>
            </div>
            <a
              href="https://www.assemblyai.com/app/account"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Get Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.hasAssemblyaiKey && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-semibold text-emerald-900 mb-1">
                ✅ AssemblyAI API Key is configured
              </p>
              <p className="text-sm text-emerald-800">
                Enter a new key below to update your existing key.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="assemblyai-key">
              {settings?.hasAssemblyaiKey
                ? "Update AssemblyAI API Key"
                : "AssemblyAI API Key"}
            </Label>
            <div className="relative">
              <Input
                id="assemblyai-key"
                type={showAssemblyaiKey ? "text" : "password"}
                placeholder="Enter your AssemblyAI API key"
                value={assemblyaiKey}
                onChange={(e) => setAssemblyaiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAssemblyaiKey(!showAssemblyaiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showAssemblyaiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {settings?.hasAssemblyaiKey
                ? "Enter a new key to update your existing key."
                : "This key is required to process podcasts."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gradient-emerald text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save API Keys"}
        </Button>
      </div>

      {/* Security Note */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-6">
          <p className="text-xs text-gray-600">
            <strong>Security:</strong> Your API keys are encrypted at rest and
            only used for your projects. They are never exposed to client-side
            code or shared with other users.{" "}
            <strong>Both keys are required</strong> to process podcasts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
