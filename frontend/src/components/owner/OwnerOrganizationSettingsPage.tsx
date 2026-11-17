"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrganizationDangerZone } from "@/components/owner/OrganizationDangerZone";
import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerOrganizationSettingsView } from "@/components/owner/OwnerOrganizationSettingsView";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useOwnerOrganizationSettings } from "@/hooks/useOwnerOrganizationSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function OwnerOrganizationSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { currentOrg } = useAuthStore();
  const workspaceOrg = useWorkspaceStore((state) => state.currentOrg);
  const { can } = usePermissions();
  const canManage = can("org.manage");
  const currentUserId = useAuthStore((authState) => authState.currentUser.id);
  const isCurrentOwner = Boolean(currentOrg.ownerId && currentOrg.ownerId === currentUserId);
  // Read-only: there is no organization update endpoint yet, so no local "save" is offered.
  const { state } = useOwnerOrganizationSettings(orgId);

  let content: React.ReactNode;
  if (!orgId || currentOrg.id !== orgId || workspaceOrg.id !== orgId || state.status === "access-lost") {
    content = (
      <OwnerPageState
        state="access-lost"
        description="The active organization does not match these settings. Select an authorized workspace and try again."
        onRetry={() => window.location.reload()}
      />
    );
  } else if (state.status === "error") {
    content = (
      <OwnerPageState
        state="error"
        title="Unable to load organization settings"
        description={state.message}
        onRetry={() => window.location.reload()}
      />
    );
  } else if (!canManage) {
    content = (
      <OwnerPageState
        state="forbidden"
        requiredPermission="org.manage"
        description="You do not have permission to change this organization's settings."
      />
    );
  } else if (state.status === "loading") {
    content = <OwnerPageState state="loading" label="Loading organization settings" />;
  } else {
    content = (
      <div className="space-y-4">
        <OwnerOrganizationSettingsView
          key={state.organization.id}
          organization={state.organization}
          canEdit={false}
          onSave={() => false}
          showLocalPreviewNotice={false}
          readOnlyReason={
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <span>Saving the profile is not available yet.</span>
              <OwnerLaterBadge task="1.1" />
              <span>Working calendar changes arrive with the calendar engine.</span>
              <OwnerLaterBadge task="2.3" />
            </div>
          }
        />
        <OrganizationDangerZone canTransfer={canManage && isCurrentOwner} />
      </div>
    );
  }

  return (
    <PanelLayout
      title="Organization settings"
      breadcrumb={[{ label: currentOrg.name || "Organization" }, { label: "Owner" }, { label: "Settings" }]}
    >
      {content}
    </PanelLayout>
  );
}
