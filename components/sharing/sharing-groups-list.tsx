"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/projects/empty-state";
import { SharingGroupCard } from "./sharing-group-card";
import { CreateGroupDialog } from "./create-group-dialog";
import { BrowseGroups } from "./browse-groups";
import type { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { getCurrentPlan } from "@/lib/client-tier-utils";
import { canUserCreateGroup, getSharingUpgradeMessage } from "@/lib/sharing-utils";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface SharingGroupsListProps {
  preloadedGroups: Preloaded<typeof api.sharingGroups.getUserGroups>;
}

export function SharingGroupsList({ preloadedGroups }: SharingGroupsListProps) {
  const { has } = useAuth();
  const groups = usePreloadedQuery(preloadedGroups);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groups");

  const userPlan = getCurrentPlan(has as any);
  const canCreate = canUserCreateGroup(userPlan);

  const handleCreateClick = () => {
    if (!canCreate) {
      toast.error(getSharingUpgradeMessage(userPlan));
      return;
    }
    setCreateDialogOpen(true);
  };

  return (
    <div className="container max-w-6xl mx-auto py-4 sm:py-6 md:py-8 lg:py-10 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-0">
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">
        <div className="mb-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold">
            <span className="gradient-emerald-text">File Sharing</span>
          </h1>
        </div>
        <p className="text-sm sm:text-base md:text-lg text-gray-600">
          Share your files with others by creating or joining groups.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="my-groups">My Groups</TabsTrigger>
            <TabsTrigger value="browse">Browse Groups</TabsTrigger>
          </TabsList>
          <Button 
            onClick={handleCreateClick} 
            disabled={!canCreate}
            className="w-full sm:w-auto gradient-emerald text-white hover-glow shadow-lg"
          >
            <Users className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </div>

        <TabsContent value="my-groups" className="space-y-6">
          {groups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              description={
                canCreate
                  ? "Create your first group to start sharing files with others."
                  : getSharingUpgradeMessage(userPlan)
              }
              actionLabel={canCreate ? "Create Group" : undefined}
              onAction={canCreate ? handleCreateClick : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <SharingGroupCard key={group.groupId} group={group} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          <BrowseGroups />
        </TabsContent>
      </Tabs>

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}



