"use client";

import React from "react";

import { usePermissions } from "@/hooks/usePermissions";
import { PermissionAction } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { PermissionDenied } from "@/components/feedback/PermissionDenied";
import { ErrorState } from "@/components/feedback/ErrorState";

interface OwnerAccessGateProps {
  children: React.ReactNode;
  requiredPermission?: PermissionAction;
  loading?: boolean;
  accessLostMessage?: string;
}

export function OwnerAccessGate({
  children,
  requiredPermission,
  loading = false,
  accessLostMessage = "Your workspace context is missing or expired. Please reload the application and retry.",
}: OwnerAccessGateProps) {
  const { currentOrg, currentRole } = useAuthStore();
  const { can } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-primary-600" aria-hidden="true" />
          <span className="text-sm font-medium">Loading owner workspace…</span>
        </div>
      </div>
    );
  }

  if (!currentOrg?.id || !currentRole) {
    return (
      <ErrorState
        title="Access lost"
        message={accessLostMessage}
        onRetry={() => {
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }}
      />
    );
  }

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <PermissionDenied
        requiredPermission={requiredPermission}
        message="This owner workspace feature requires a matching tenant permission."
      />
    );
  }

  return <>{children}</>;
}
