"use client";

import React from "react";
import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { usePermissions } from "@/hooks/usePermissions";
import { previewEnabled } from "@/lib/permissions";
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
  const { currentOrg, currentRole, sessionStatus } = useAuthStore();
  const isRolePreview = useAuthStore((state) => state.isRolePreview) && previewEnabled();
  const { can, canAny, status, retry } = usePermissions();
  const params = useParams();
  const routeOrgId = typeof params?.orgId === "string" ? params.orgId : "";
  const shell = (content: React.ReactNode) => (
    <PanelLayout title={workspaceLabel} breadcrumb={[{ label: currentOrg.name || "Organization" }]}>
      {content}
    </PanelLayout>
  );

  // Wait for the server session before judging anything (no "restricted access" flash after sign-up or sign-in).
  if (loading || status === "loading" || (!isRolePreview && sessionStatus === "checking")) {
    return shell(<OwnerPageState state="loading" label={`Checking access to the ${workspaceLabel.toLowerCase()}`} />);
  }
  if (status === "unauthenticated") {
    return shell(
      <OwnerPageState state="error" title="Session expired" description="Your session has ended. Sign in again to continue."
        onRetry={() => window.location.assign("/login")} />,
    );
  }
  // The page's organization must be the session's active organization (task 1.3: switching is explicit).
  const wrongWorkspace = !isRolePreview && routeOrgId !== "" && routeOrgId !== currentOrg?.id;
  if (!currentOrg?.id || !currentRole || status === "access-lost" || wrongWorkspace) {
    return shell(<OwnerPageState state="access-lost" description={accessLostMessage}
      onRetry={() => window.location.assign("/select-workspace")} />);
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
