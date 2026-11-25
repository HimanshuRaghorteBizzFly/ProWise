"use client";

import React from "react";
import Link from "next/link";
import { Activity, Building2, CreditCard, DollarSign, Layers, PauseCircle, ShieldCheck, Timer, Users } from "lucide-react";
import type { AdminDashboard } from "@/types/admin";
import { BillingDormantNotice, formatInstant, formatMoney, humanize } from "@/components/super-admin/admin-resource";
import {
  EmptyStateView,
  KpiCard,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";

/** The Super Admin overview body: renders exactly the figures of GET /v1/admin/dashboard. */
export function DashboardBody({ data }: { data: AdminDashboard }) {
  const plans = data.plan_distribution ?? [];
  const activity = data.recent_activity ?? [];

  return (
    <>
      <section aria-label="Tenants and operators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Organizations" value={String(data.total_organizations)} sublabel={`${data.active_organizations} active`} icon={Building2} tone="blue" />
        <KpiCard label="On trial" value={String(data.trial_organizations)} icon={Timer} tone="amber" />
        <KpiCard label="Suspended" value={String(data.suspended_organizations)} icon={PauseCircle} tone="rose" />
        <KpiCard label="Active platform operators" value={String(data.active_operators)} icon={ShieldCheck} tone="emerald" />
      </section>

      <section aria-label="Billing" className="space-y-3">
        <BillingDormantNotice />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Monthly recurring revenue" value={formatMoney(data.total_mrr, "USD")} sublabel="From active subscriptions" icon={DollarSign} tone="violet" />
          <KpiCard label="Annual run rate" value={formatMoney(data.total_arr, "USD")} icon={DollarSign} tone="violet" />
          <KpiCard label="Active subscriptions" value={String(data.active_subscriptions)} icon={CreditCard} tone="slate" />
          <KpiCard label="Allocated seats" value={String(data.total_seats_allocated)} icon={Users} tone="slate" />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SurfaceCard className="xl:col-span-5 p-4 sm:p-5 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Layers className="w-4 h-4 text-blue-500" /> Organizations by plan
          </h3>
          {plans.length === 0 ? (
            <EmptyStateView icon={Layers} title="No plans" description="No subscription plans are stored on the server." />
          ) : (
            <ul className="space-y-2.5">
              {plans.map((plan) => (
                <li key={plan.plan_name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-text-primary)]">{plan.plan_name}</span>
                    <span className="tabular-nums text-[var(--color-text-secondary)]">
                      {plan.count} ({Number(plan.percentage).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Number(plan.percentage))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard className="xl:col-span-7 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Activity className="w-4 h-4 text-blue-500" /> Recent activity
            </h3>
            <Link href="/super-admin/audit" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              Open audit log
            </Link>
          </div>
          {activity.length === 0 ? (
            <EmptyStateView icon={Activity} title="No activity yet" description="Super Admin actions appear here once they are recorded." />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {activity.map((entry) => (
                <li key={entry.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)] truncate">{entry.summary || humanize(entry.action)}</p>
                    <p className="text-[var(--color-text-muted)] truncate">
                      {[entry.actor_name || entry.actor_email, humanize(entry.category)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge label={humanize(entry.severity)} tone={getStatusTone(entry.severity)} />
                    <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{formatInstant(entry.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </>
  );
}
