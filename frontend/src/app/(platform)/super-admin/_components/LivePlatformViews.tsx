"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Clock, Users } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { AdminDashboardDto, AdminOrganizationDto } from "@/types/api";
import { EmptyStateView, ErrorBanner, StatusBadge, SurfaceCard } from "./SuperAdminPrimitives";

/**
 * Super Admin pages on stored platform data only (organizations, members, projects from the database). Parts with
 * no stored data yet (revenue history, platform health, billing) say so instead of showing invented numbers.
 */

function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; data: T } | { kind: "error"; message: string }>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    load()
      .then((data) => { if (active) setState({ kind: "ready", data }); })
      .catch((error: unknown) => {
        if (!active) return;
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 0;
        setState({ kind: "error", message: status === 401 || status === 403
          ? "Only a platform Super Admin account can see this."
          : "Platform data could not be loaded." });
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return { state, retry: () => setAttempt((value) => value + 1) };
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
      <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <Icon className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </SurfaceCard>
  );
}

export function OrganizationTable({ organizations }: { organizations: AdminOrganizationDto[] }) {
  if (organizations.length === 0) {
    return <EmptyStateView icon={Building2} title="No organizations yet" description="No company has registered on the platform yet." />;
  }
  return (
    <SurfaceCard className="overflow-x-auto">
      <table className="w-full text-xs" data-testid="platform-organizations">
        <thead className="text-left text-[var(--color-text-muted)]">
          <tr>
            <th className="p-3 font-semibold">Organization</th>
            <th className="p-3 font-semibold">Owner</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold text-right">Members</th>
            <th className="p-3 font-semibold text-right">Projects</th>
            <th className="p-3 font-semibold">Time zone</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => (
            <tr key={org.id} className="border-t border-[var(--color-border)]">
              <td className="p-3"><p className="font-semibold">{org.name}</p><p className="text-[var(--color-text-muted)] font-mono">{org.slug}</p></td>
              <td className="p-3">{org.owner_email ?? <span className="text-[var(--color-text-muted)]">No owner</span>}</td>
              <td className="p-3"><StatusBadge label={(org.status ?? "ACTIVE").toLowerCase()} tone={org.status === "SUSPENDED" ? "danger" : "success"} /></td>
              <td className="p-3 text-right tabular-nums">{org.seats_used}</td>
              <td className="p-3 text-right tabular-nums">{org.projects_count}</td>
              <td className="p-3">{org.timezone ?? "Not set"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SurfaceCard>
  );
}

export function PlatformDashboardContent({ dashboard, organizations }: { dashboard: AdminDashboardDto; organizations: AdminOrganizationDto[] }) {
  const members = organizations.reduce((sum, org) => sum + org.seats_used, 0);
  const projects = organizations.reduce((sum, org) => sum + org.projects_count, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Organizations" value={dashboard.total_organizations} icon={Building2} />
        <Stat label="Active organizations" value={dashboard.active_organizations} icon={Building2} />
        <Stat label="Active members" value={members} icon={Users} />
        <Stat label="Projects" value={projects} icon={Building2} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Newest organizations</h2>
          <Link href="/super-admin/organizations" className="text-xs font-semibold text-[#1A73E8]">All organizations</Link>
        </div>
        <OrganizationTable organizations={[...organizations]
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 8)} />
      </div>
      <SurfaceCard className="p-4 text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
        <Clock className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
        <span>Revenue history, platform health and billing are not stored yet, so no numbers are shown for them (Later).</span>
      </SurfaceCard>
    </div>
  );
}

export function LivePlatformDashboard() {
  const { state, retry } = useLoad(async () => {
    const [dashboard, organizations] = await Promise.all([apiClient.adminDashboard(), apiClient.adminOrganizations()]);
    return { dashboard, organizations };
  });
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Header title="Platform overview" description="Stored organizations, members and projects across the platform." />
      {state.kind === "loading" && <SurfaceCard className="p-6 text-xs text-[var(--color-text-muted)]">Loading platform data…</SurfaceCard>}
      {state.kind === "error" && <ErrorBanner message={state.message} onRetry={retry} />}
      {state.kind === "ready" && <PlatformDashboardContent dashboard={state.data.dashboard} organizations={state.data.organizations} />}
    </div>
  );
}

export function LivePlatformOrganizations() {
  const { state, retry } = useLoad(() => apiClient.adminOrganizations());
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Header title="Organizations" description="Every registered organization, with its real member and project counts." />
      {state.kind === "loading" && <SurfaceCard className="p-6 text-xs text-[var(--color-text-muted)]">Loading organizations…</SurfaceCard>}
      {state.kind === "error" && <ErrorBanner message={state.message} onRetry={retry} />}
      {state.kind === "ready" && <OrganizationTable organizations={state.data} />}
    </div>
  );
}
