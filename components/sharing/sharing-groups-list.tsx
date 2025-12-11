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

  const userPlan = getCurrentPlan(has);
  const canCreate = canUserCreateGroup(userPlan);

  const handleCreateClick = () => {
    if (!canCreate) {
      toast.error(getSharingUpgradeMessage(userPlan));
      return;
    }
    setCreateDialogOpen(true);
  };

  return (
    <div className="container max-w-6xl mx-auto py-10 px-12 xl:px-0">
      <div className="mb-12">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            <span className="gradient-emerald-text">File Sharing</span>
          </h1>
          <Button onClick={handleCreateClick} disabled={!canCreate}>
            <Users className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </div>
        <p className="text-lg text-gray-600">
          Share your files with others by creating or joining groups.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="my-groups">My Groups</TabsTrigger>
          <TabsTrigger value="browse">Browse Groups</TabsTrigger>
        </TabsList>

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



