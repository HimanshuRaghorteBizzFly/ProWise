"use client";

import React from "react";
import Link from "next/link";
import { KeyRound, Lock, LogIn, MonitorSmartphone, ShieldAlert, ShieldCheck, UserCog, UserX } from "lucide-react";
import type { SecurityOverview } from "@/types/admin-operations";
import { KpiCard, PageHeader, PaginationBar, SurfaceCard } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { usePagedRows } from "../use-paged-rows";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "../admin-resource";
import { InfoNote } from "./IntegrationViews";

const NO_FAILURES: SecurityOverview["recent_failed_logins"] = [];

const LINKS = [
  { href: "/super-admin/users", label: "Users", description: "Manage platform user accounts" },
  { href: "/super-admin/operators", label: "Operators", description: "Manage Platform Operator accounts" },
  { href: "/super-admin/access-approvals", label: "Support Access Approvals", description: "Review temporary workspace access" },
  { href: "/super-admin/audit", label: "Audit Logs", description: "Every administrative change, searchable" },
  { href: "/super-admin/account", label: "My Account", description: "Your password and your own sessions" },
];

export function SecurityCenterView({ overview, onRetry }: { overview: ResourceState<SecurityOverview>; onRetry: () => void }) {
  const data = overview.status === "ready" ? overview.data : null;
  const v = (pick: (d: SecurityOverview) => number) => (data ? pick(data) : "-");
  const failures = usePagedRows(data?.recent_failed_logins ?? NO_FAILURES, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        badge="Governance"
        description="Sign-in failures, locked accounts and active sessions across the platform, read from the server."
      />

      <InfoNote title="Multi-factor authentication">
        MFA is not part of this release, so there are no MFA controls or coverage figures here.
      </InfoNote>

      {data && typeof data.published_seed_credential_accounts === "number" && data.published_seed_credential_accounts > 0 && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
          <p className="font-semibold">Accounts still use published seed credentials</p>
          <p className="mt-0.5">
            {data.published_seed_credential_accounts} account(s) can still sign in with a password published in the seed data. Reset those
            passwords from Users or Operators.
          </p>
        </div>
      )}

      {overview.status !== "ready" && (
        <SurfaceCard>
          <ResourceStatus
            state={overview}
            isEmpty={() => false}
            onRetry={onRetry}
            emptyTitle=""
            emptyDescription=""
          />
        </SurfaceCard>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="Failed Sign-ins (24h)" value={v((d) => d.failed_logins_24h)} sublabel={`${v((d) => d.failed_logins_7d)} in the last 7 days`} icon={ShieldAlert} tone={data.failed_logins_24h > 0 ? "amber" : "emerald"} />
            <KpiCard label="Locked Accounts" value={v((d) => d.locked_accounts)} sublabel="Users locked after failed sign-ins" icon={Lock} tone={data.locked_accounts > 0 ? "rose" : "emerald"} />
            <KpiCard
              label="Active Sessions"
              value={data.active_user_sessions + data.active_operator_sessions}
              sublabel={`${data.active_user_sessions} user · ${data.active_operator_sessions} operator`}
              icon={MonitorSmartphone}
              tone="blue"
            />
            <KpiCard label="Super Admins" value={v((d) => d.super_admin_count)} sublabel="Accounts with full platform authority" icon={ShieldCheck} tone="violet" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard label="Must Change Password" value={v((d) => d.users_must_change_password)} sublabel="Users with a temporary password" icon={KeyRound} tone="amber" />
            <KpiCard label="Operators Locked" value={v((d) => d.operators_locked)} sublabel="Platform Operators locked out" icon={UserX} tone={data.operators_locked > 0 ? "rose" : "slate"} />
          </div>

          <SurfaceCard className="overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent failed sign-ins</h3>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Email addresses are masked by the server.</p>
            </div>
            {data.recent_failed_logins.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <LogIn className="w-6 h-6 text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">No failed sign-ins</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">No failed sign-in attempts have been recorded recently.</p>
              </div>
            ) : (
              <AdminTable label="Recent failed sign-ins" headers={["Account", "IP address", "Reason", "When"]}>
                {failures.pageRows.map((f, idx) => (
                  <tr key={`${f.at}-${idx}`}>
                    <td className={`${cellClass} font-medium`}>{f.email_masked}</td>
                    <td className={mutedCellClass}>{f.ip_address || "-"}</td>
                    <td className={mutedCellClass}>{humanize(f.reason)}</td>
                    <td className={mutedCellClass}>{formatInstant(f.at)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
            {data.recent_failed_logins.length > 0 && <PaginationBar {...failures.barProps} />}
          </SurfaceCard>
        </>
      )}

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Where to act</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 hover:border-blue-500/40">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">{l.label}</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{l.description}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
