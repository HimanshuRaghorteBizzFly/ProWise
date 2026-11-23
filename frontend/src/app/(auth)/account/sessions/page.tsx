"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Laptop, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiClient, type SessionView } from "@/lib/api";
import { AdminButton, EmptyStateView, ErrorBanner, PageSkeleton, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { getRoleDashboardPath, useAuthStore } from "@/store/auth-store";
import { deviceLabel } from "@/components/account/device-label";

function when(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "My sessions": every device signed in to this account, with sign-out for one or all others. */
export default function MySessionsPage() {
  const client = useQueryClient();
  const { currentRole, currentOrg } = useAuthStore();
  const sessions = useQuery({ queryKey: ["me", "sessions"], queryFn: () => apiClient.mySessions(), retry: false });
  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.revokeSession(id),
    onSuccess: () => toast.success("That device was signed out."),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "The device could not be signed out."),
    onSettled: () => client.invalidateQueries({ queryKey: ["me", "sessions"] }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => apiClient.revokeOtherSessions(),
    onSuccess: (r) => toast.success(r.revoked === 1 ? "1 other device was signed out." : `${r.revoked} other devices were signed out.`),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Other devices could not be signed out."),
    onSettled: () => client.invalidateQueries({ queryKey: ["me", "sessions"] }),
  });
  const home = getRoleDashboardPath(currentRole, currentOrg.id);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={home} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>
        <h1 className="text-xl font-bold tracking-tight">My sessions</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Devices signed in to your account. Sign out any you do not recognise, then change your password.
        </p>
        {sessions.isPending && <PageSkeleton variant="list" />}
        {sessions.error && (
          <ErrorBanner
            message={sessions.error instanceof ApiError && sessions.error.status === 401
              ? "Your session has ended. Sign in again." : "Your sessions could not be loaded."}
            onRetry={() => void sessions.refetch()}
          />
        )}
        {sessions.data && (
          <Panel
            title="Signed-in devices"
            icon={ShieldCheck}
            action={sessions.data.length > 1 ? (
              <AdminButton size="xs" variant="outline" isLoading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
                <LogOut className="w-3 h-3" /> Sign out all others
              </AdminButton>
            ) : undefined}
          >
            {sessions.data.length === 0 ? (
              <EmptyStateView icon={Laptop} title="No open sessions" description="Sign in again to start one." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {sessions.data.map((s: SessionView) => (
                  <li key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Laptop className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden />
                        {deviceLabel(s.user_agent)}
                        {s.current && <StatusBadge label="This device" tone="success" />}
                      </span>
                      <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {s.ip_address ?? "Unknown address"} · signed in {when(s.created_at)} · last active {when(s.last_used_at)}
                        {s.organization_name ? ` · ${s.organization_name}` : ""}
                      </span>
                    </span>
                    {!s.current && (
                      <AdminButton size="xs" variant="ghost" isLoading={revoke.isPending && revoke.variables === s.id}
                        onClick={() => revoke.mutate(s.id)}>
                        Sign out
                      </AdminButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
