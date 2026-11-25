"use client";

import { useAuthStore } from "@/store/auth-store";

/*
 * Operator permission gating, moved unchanged out of the demo store (_store/usePlatformOperatorStore.ts re-exports it)
 * so the pages that read live data can gate their controls without importing the demo store. It depends only on the
 * signed-in role; the server still enforces every permission on every call.
 */

export type OperatorPermission =
  | "incidents.manage"
  | "tickets.manage"
  | "access.request"
  | "integrations.manage"
  | "communications.draft"
  | "billing.triage"
  | "system.manage"
  | "settings.manage"
  | "governance.super_admin_only";

const OPERATOR_ALLOWED_PERMISSIONS = new Set<OperatorPermission>([
  "incidents.manage",
  "tickets.manage",
  "access.request",
  "integrations.manage",
  "communications.draft",
  "billing.triage",
  "system.manage",
  "settings.manage",
]);

/**
 * Returns permission checks enforcing the Platform Operator delegated scope.
 * Operators handle day-to-day incidents, tickets, retries, drafts, and triage,
 * while Super Admin-only governance decisions remain locked unless explicitly granted.
 */
export function useOperatorPermissions() {
  const currentRole = useAuthStore((s) => s.currentRole);
  const can = (permission: OperatorPermission) => {
    if (currentRole === "SUPER_ADMIN") return true;
    if (currentRole !== "PLATFORM_OPERATOR") return false;
    return OPERATOR_ALLOWED_PERMISSIONS.has(permission);
  };
  return {
    currentRole,
    can,
    isOperatorScope: currentRole === "PLATFORM_OPERATOR",
  };
}
