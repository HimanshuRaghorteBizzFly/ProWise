"use client";

import React from "react";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth-store";
import type { PermissionKey } from "@/types/permission";

interface OwnerAccessGateProps {
  children: React.ReactNode;
  /** Single key required to enter. */
  requiredPermission?: PermissionKey;
  /** Enter when any of these keys is held (used by the Admin family). */
  anyOf?: readonly PermissionKey[];
  /** Shown in the shell title and messages, e.g. "Owner workspace". */
  workspaceLabel?: string;
  loading?: boolean;
  accessLostMessage?: string;
}

/**
 * Route-family gate. Deny by default: nothing renders until permissions are loaded and the
 * membership holds the required key(s). Gate states render inside the shared shell.
 */
export function OwnerAccessGate({
  children,
  requiredPermission,
  anyOf,
  workspaceLabel = "Owner workspace",
  loading = false,
  accessLostMessage = "Your workspace context is missing or expired. Select an authorized workspace and try again.",
}: OwnerAccessGateProps) {
  const { currentOrg, currentRole } = useAuthStore();
  const { can, canAny, status, retry } = usePermissions();
  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };
  const shell = (content: React.ReactNode) => (
    <PanelLayout title={workspaceLabel} breadcrumb={[{ label: currentOrg.name || "Organization" }]}>
      {content}
    </PanelLayout>
  );

  if (!currentOrg?.id || !currentRole || status === "access-lost") {
    return shell(<OwnerPageState state="access-lost" description={accessLostMessage} onRetry={reload} />);
  }
  if (loading || status === "loading") {
    return shell(<OwnerPageState state="loading" label={`Checking access to the ${workspaceLabel.toLowerCase()}`} />);
  }
  if (status === "unauthenticated") {
    return shell(
      <OwnerPageState state="error" title="Session expired" description="Your session has ended. Sign in again to continue." onRetry={reload} />,
    );
  }
  if (status === "error") {
    return shell(
      <OwnerPageState
        state="error"
        title="Unable to check your permissions"
        description="Your access could not be verified, so this page stays locked. Try again."
        onRetry={retry}
      />,
    );
  }

  const missingSingle = requiredPermission !== undefined && !can(requiredPermission);
  const missingAny = anyOf !== undefined && !canAny(anyOf);
  if (missingSingle || missingAny) {
    return shell(
      <OwnerPageState
        state="forbidden"
        requiredPermission={missingSingle ? requiredPermission : `one of ${anyOf?.join(", ")}`}
        description={`The ${workspaceLabel.toLowerCase()} needs a matching permission on your active membership.`}
      />,
    );
  }

  return <>{children}</>;
}
