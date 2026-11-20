import React from "react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import type { OrgResourceState } from "@/hooks/useOrgResource";
import type { PermissionStatus } from "@/store/permission-store";
import type { PermissionKey } from "@/types/permission";

export function ManagerResourceNotice({
  orgMatches,
  permissionStatus,
  resourceStatus,
  permission,
  permissionName,
  laterTask,
  retry,
  retryPermissions,
}: {
  orgMatches: boolean;
  permissionStatus: PermissionStatus;
  resourceStatus: OrgResourceState<unknown>["status"];
  permission: boolean;
  permissionName: PermissionKey;
  laterTask: string;
  retry: () => void;
  retryPermissions: () => void;
}) {
  if (!orgMatches || permissionStatus === "access-lost") {
    return <OwnerPageState state="access-lost" />;
  }
  if (permissionStatus === "loading") {
    return <OwnerPageState state="loading" label="Checking project access" />;
  }
  if (permissionStatus === "unauthenticated") {
    return (
      <OwnerPageState
        state="error"
        title="Session expired"
        description="Sign in again to continue."
      />
    );
  }
  if (permissionStatus === "error") {
    return (
      <OwnerPageState
        state="error"
        title="Unable to check project access"
        description="Access could not be verified, so this page stays locked."
        onRetry={retryPermissions}
      />
    );
  }
  if (!permission) {
    return (
      <OwnerPageState
        state="forbidden"
        requiredPermission={permissionName}
        description={`This page requires ${permissionName} on a project you may access.`}
      />
    );
  }
  if (resourceStatus === "unavailable") {
    return (
      <section
        role="status"
        className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <p className="text-sm text-app-text-secondary">
          Not available yet. The required backend work is not built; no sample data is shown in production.
        </p>
        <OwnerLaterBadge task={laterTask} />
      </section>
    );
  }
  if (resourceStatus === "loading" || resourceStatus === "idle") {
    return <OwnerPageState state="loading" label="Loading Project Manager data" />;
  }
  if (resourceStatus === "access-lost") {
    return <OwnerPageState state="access-lost" />;
  }
  if (resourceStatus === "forbidden") {
    return (
      <OwnerPageState
        state="forbidden"
        requiredPermission={permissionName}
        description="The server denied access to this project."
      />
    );
  }
  if (resourceStatus === "unauthenticated") {
    return (
      <OwnerPageState
        state="error"
        title="Session expired"
        description="Sign in again to continue."
      />
    );
  }
  if (resourceStatus === "error") {
    return (
      <OwnerPageState
        state="error"
        title="Unable to load project data"
        description="Try again in a moment."
        onRetry={retry}
      />
    );
  }
  return null;
}
