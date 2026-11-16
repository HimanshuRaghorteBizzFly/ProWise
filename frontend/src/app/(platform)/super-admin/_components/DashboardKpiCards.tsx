"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import { formatCurrency } from "../_services/super-admin-service";
import { SurfaceCard } from "./SuperAdminPrimitives";

export function DashboardKpiCards() {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const operators = useSuperAdminStore((s) => s.operators);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const payments = useSuperAdminStore((s) => s.payments);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const securityAlerts = useSuperAdminStore((s) => s.securityAlerts);
  const incidents = useSuperAdminStore((s) => s.incidents);

  const kpis = useMemo(() => {
    // 1. Total Organizations
    const totalOrgs = organizations.length;
    const activeOrgs = organizations.filter((o) => o.status === "ACTIVE").length;
    const trialOrgs = organizations.filter((o) => o.status === "TRIAL").length;
    const suspendedOrgs = organizations.filter((o) => o.status === "SUSPENDED").length;

    // 2. Platform Users & Operators
    const totalSeatUsers = organizations.reduce((sum, o) => sum + o.seatsUsed, 0);
    const activeOperators = operators.filter((o) => o.status === "ACTIVE").length;
    const onCallOperators = operators.filter((o) => o.status === "ACTIVE" && o.onCall).length;

    // 3. MRR & ARR
    const totalMrr = organizations.reduce((sum, o) => sum + o.mrr, 0);
    const arr = totalMrr * 12;

    // 4. Active Subscriptions
    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const trialSubs = subscriptions.filter((s) => s.status === "TRIALING").length;
    const pastDueSubs = subscriptions.filter((s) => s.status === "PAST_DUE").length;
    const cancelledSubs = subscriptions.filter((s) => s.status === "CANCELLED").length;

    // 5. Net Collected Revenue & Failed Payments
    const settledPayments = payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
      .reduce((sum, p) => sum + (p.amount - p.refundedAmount), 0);
    const failedPaymentsList = payments.filter((p) => p.status === "FAILED");
    const failedCount = failedPaymentsList.length;
    const failedAmount = failedPaymentsList.reduce((sum, p) => sum + p.amount, 0);

    // 6. Pending Invoices & Critical Alerts
    const pendingInvoices = invoices.filter(
      (i) => i.status === "OPEN" || i.status === "OVERDUE"
    );
    const pendingBalance = pendingInvoices.reduce((sum, i) => sum + i.total, 0);
    const overdueInvoicesCount = invoices.filter((i) => i.status === "OVERDUE").length;

    const criticalSecurity = securityAlerts.filter(
      (a) => a.severity === "High" && a.status !== "Resolved"
    ).length;
    const criticalIncidents = incidents.filter(
      (inc) => inc.severity === "Critical" && inc.status !== "Resolved"
    ).length;
    const totalCriticalAlerts = criticalSecurity + criticalIncidents;

    return {
      totalOrgs,
      activeOrgs,
      trialOrgs,
      suspendedOrgs,
      totalSeatUsers,
      activeOperators,
      onCallOperators,
      totalMrr,
      arr,
      activeSubs,
      trialSubs,
      pastDueSubs,
      cancelledSubs,
      settledPayments,
      failedCount,
      failedAmount,
      pendingInvoicesCount: pendingInvoices.length,
      pendingBalance,
      overdueInvoicesCount,
      totalCriticalAlerts,
    };
  }, [organizations, operators, subscriptions, payments, invoices, securityAlerts, incidents]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 min-w-0">
      {/* 1. Total Organizations Card */}
      <Link
        href="/super-admin/organizations"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              Total Organizations
            </span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/12 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {kpis.totalOrgs}
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                +16.7% MoM
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {kpis.activeOrgs} Active
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {kpis.trialOrgs} Trial
              </span>
              {kpis.suspendedOrgs > 0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {kpis.suspendedOrgs} Suspended
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            <span>Manage Directory</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>

      {/* 2. Platform Users & Operators Card */}
      <Link
        href="/super-admin/operators"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-cyan-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              Platform Users
            </span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {kpis.totalSeatUsers.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                +18.4%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] flex-wrap">
              <span>{kpis.totalSeatUsers} Active Users</span>
              <span>•</span>
              <span className="text-[var(--color-text-secondary)] font-medium">
                {kpis.activeOperators} Operators ({kpis.onCallOperators} on-call)
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
            <span>Operator Roster</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>

      {/* 3. Monthly Recurring Revenue (MRR) & ARR Card */}
      <Link
        href="/super-admin/subscriptions"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              MRR Run-Rate
            </span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {formatCurrency(kpis.totalMrr)}
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                +14.2%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] truncate">
              <span>ARR Run-rate: {formatCurrency(kpis.arr)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Revenue Trajectory</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>

      {/* 4. Active Subscriptions Card */}
      <Link
        href="/super-admin/subscriptions"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-violet-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              Active Subscriptions
            </span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/12 text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {kpis.activeSubs} Active
              </span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                  kpis.pastDueSubs > 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {kpis.pastDueSubs > 0 ? `${kpis.pastDueSubs} Past Due` : "Healthy"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] flex-wrap">
              <span>{kpis.trialSubs} Trial</span>
              <span>•</span>
              <span className={kpis.pastDueSubs > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                {kpis.pastDueSubs} Expired/Due
              </span>
              <span>•</span>
              <span>{kpis.cancelledSubs} Cancelled</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-violet-600 dark:text-violet-400 font-medium">
            <span>Billing Cycles</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>

      {/* 5. Net Collected Revenue & Failed Payments Card */}
      <Link
        href="/super-admin/payments"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              Net Collected
            </span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {formatCurrency(kpis.settledPayments)}
              </span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                  kpis.failedCount > 0
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {kpis.failedCount > 0 ? `${kpis.failedCount} Failed` : "100% Settled"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] truncate">
              {kpis.failedCount > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  {kpis.failedCount} failed ({formatCurrency(kpis.failedAmount)}) needs retry
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Zero payment failures
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Payment Log</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>

      {/* 6. Pending Invoices and Critical Alerts Card */}
      <Link
        href="/super-admin/invoices"
        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <SurfaceCard className="h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500/50 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
              Pending Invoices &amp; Alerts
            </span>
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                kpis.totalCriticalAlerts > 0
                  ? "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/12 text-amber-600 dark:text-amber-400"
              } group-hover:scale-105 transition-transform`}
            >
              {kpis.totalCriticalAlerts > 0 ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                {formatCurrency(kpis.pendingBalance)}
              </span>
              {kpis.totalCriticalAlerts > 0 ? (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-pulse">
                  {kpis.totalCriticalAlerts} Critical
                </span>
              ) : kpis.overdueInvoicesCount > 0 ? (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {kpis.overdueInvoicesCount} Overdue
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  {kpis.pendingInvoicesCount} Open
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] flex-wrap">
              <span>{kpis.pendingInvoicesCount} open</span>
              <span>•</span>
              <span className={kpis.overdueInvoicesCount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                {kpis.overdueInvoicesCount} overdue
              </span>
              <span>•</span>
              <span className={kpis.totalCriticalAlerts > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
                {kpis.totalCriticalAlerts} alert{kpis.totalCriticalAlerts === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <span>Invoices &amp; Governance</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </SurfaceCard>
      </Link>
    </div>
  );
}
