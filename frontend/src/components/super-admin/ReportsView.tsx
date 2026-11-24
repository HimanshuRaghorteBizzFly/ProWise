"use client";

import React from "react";
import { Building2, CreditCard, Download, FileSpreadsheet, RefreshCw, TrendingUp, Users } from "lucide-react";
import type { ReportsOverview } from "@/types/admin-platform";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  ErrorBanner,
  KpiCard,
  PageHeader,
  PaginationBar,
  SurfaceCard,
  TableSkeleton,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ComparisonBarChart, type MonthlyBarPoint } from "@/app/(platform)/super-admin/_components/SuperAdminCharts";
import { humanize, type ResourceState } from "./admin-resource";
import { downloadRowsCsv } from "./platform-shared";
import { usePagedRows } from "./use-paged-rows";

export type ReportPreset = "30D" | "90D" | "6M" | "YTD" | "CUSTOM";

export interface ReportRange {
  preset: ReportPreset;
  /** yyyy-MM-dd, inclusive */
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Calendar-date range for a preset, ending on `today` (local calendar date; no 24h arithmetic across DST). */
export function presetRange(preset: Exclude<ReportPreset, "CUSTOM">, today = new Date()): ReportRange {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (preset === "30D") start.setDate(start.getDate() - 29);
  else if (preset === "90D") start.setDate(start.getDate() - 89);
  else if (preset === "6M") start.setMonth(start.getMonth() - 6, 1);
  else start.setMonth(0, 1);
  return { preset, from: isoDate(start), to: isoDate(end) };
}

export function rangeError(range: ReportRange): string | null {
  if (!range.from || !range.to) return "Choose both a start and an end date.";
  if (range.from > range.to) return "The start date must be on or before the end date.";
  return null;
}

/**
 * Joins the two monthly series the server sent. A month that only one series contains gets 0 in the other (the
 * server reports no created records for it); months neither series contains are not added.
 */
export function mergeMonthly(primary: { month: string; count: number }[], secondary: { month: string; count: number }[]): MonthlyBarPoint[] {
  const months = Array.from(new Set([...primary.map((p) => p.month), ...secondary.map((s) => s.month)])).sort();
  const a = new Map(primary.map((p) => [p.month, p.count]));
  const b = new Map(secondary.map((s) => [s.month, s.count]));
  return months.map((m) => ({ label: m, primary: a.get(m) ?? 0, secondary: b.get(m) ?? 0 }));
}

export function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "-" : Number(n).toLocaleString());

function SectionHeader({ title, description, onCsv }: { title: string; description: string; onCsv?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
      </div>
      {onCsv && (
        <AdminButton variant="outline" size="xs" onClick={onCsv} className="shrink-0">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Download CSV
        </AdminButton>
      )}
    </div>
  );
}

function NoData() {
  return <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-muted)]">No data in this range.</p>;
}

function DataTable({ label, headers, rows }: { label: string; headers: string[]; rows: (string | number)[][] }) {
  const { pageRows, barProps } = usePagedRows(rows);
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-left text-xs border-collapse" aria-label={label}>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {pageRows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${j === 0 ? "text-[var(--color-text-primary)]" : "tabular-nums text-[var(--color-text-secondary)]"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 0 && <PaginationBar {...barProps} />}
    </div>
  );
}

/** Horizontal share bars for a categorical breakdown; widths are each row's share of the listed total. */
function ShareBars({ rows, label }: { rows: { name: string; count: number }[]; label: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.name} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-primary)]">{r.name}</span>
            <span className="tabular-nums font-semibold text-[var(--color-text-primary)]">{fmt(r.count)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface ReportsViewProps {
  state: ResourceState<ReportsOverview> | { status: "invalid"; message: string };
  range: ReportRange;
  onRangeChange: (next: ReportRange) => void;
  onRetry: () => void;
}

export function ReportsView({ state, range, onRangeChange, onRetry }: ReportsViewProps) {
  const data = state.status === "ready" ? state.data : null;
  const stamp = `${range.from}_${range.to}`;
  const csv = (name: string, headers: string[], rows: (string | number)[][]) => () =>
    downloadRowsCsv(`prowise-${name}-${stamp}.csv`, headers, rows);

  const growth = data ? mergeMonthly(data.organizations.created_by_month, data.users.created_by_month) : [];
  const logins: MonthlyBarPoint[] = data ? data.logins.by_day.map((d) => ({ label: d.date, primary: d.succeeded, secondary: d.failed })) : [];
  const auditDays: MonthlyBarPoint[] = data ? data.audit.by_day.map((d) => ({ label: d.date, primary: d.count })) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        badge={`${range.from} to ${range.to}`}
        description="Platform totals and activity for the chosen date range, computed by the server. Charts plot only the points the server returns."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <AdminSelect
                aria-label="Report range"
                value={range.preset}
                onChange={(e) => {
                  const p = e.target.value as ReportPreset;
                  onRangeChange(p === "CUSTOM" ? { ...range, preset: p } : presetRange(p));
                }}
                options={[
                  { label: "Last 30 days", value: "30D" },
                  { label: "Last 90 days", value: "90D" },
                  { label: "Last 6 months", value: "6M" },
                  { label: "Year to date", value: "YTD" },
                  { label: "Custom range", value: "CUSTOM" },
                ]}
              />
            </div>
            <div className="w-36">
              <AdminInput type="date" aria-label="From date" value={range.from} onChange={(e) => onRangeChange({ ...range, preset: "CUSTOM", from: e.target.value })} />
            </div>
            <div className="w-36">
              <AdminInput type="date" aria-label="To date" value={range.to} onChange={(e) => onRangeChange({ ...range, preset: "CUSTOM", to: e.target.value })} />
            </div>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
          </div>
        }
      />

      {state.status === "invalid" && (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          {state.message}
        </p>
      )}
      {state.status === "loading" && (
        <div role="status" aria-label="Loading">
          <TableSkeleton rows={6} />
        </div>
      )}
      {state.status === "error" && <ErrorBanner message={state.message} onRetry={onRetry} />}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Organizations"
              value={fmt(data.organizations.total)}
              sublabel={`${fmt(data.organizations.active)} active, ${fmt(data.organizations.trial)} trial, ${fmt(data.organizations.suspended)} suspended`}
              icon={Building2}
              tone="emerald"
            />
            <KpiCard
              label="Users"
              value={fmt(data.users.total)}
              sublabel={`${fmt(data.users.active)} active, ${fmt(data.users.pending)} pending, ${fmt(data.users.disabled)} disabled`}
              icon={Users}
              tone="violet"
            />
            <KpiCard label="Monthly recurring revenue" value={formatAmount(data.subscriptions.mrr)} sublabel={`${formatAmount(data.subscriptions.arr)} annual run-rate`} icon={TrendingUp} tone="blue" />
            <KpiCard
              label="Outstanding invoices"
              value={formatAmount(data.invoices.outstanding_total)}
              sublabel={`${formatAmount(data.invoices.paid_total)} paid of ${formatAmount(data.invoices.billed_total)} billed`}
              icon={CreditCard}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Organizations & users created by month"
                description="New organizations and new user accounts per month in the range."
                onCsv={csv("growth-by-month", ["Month", "Organizations created", "Users created"], growth.map((g) => [g.label, g.primary, g.secondary ?? 0]))}
              />
              {growth.length === 0 ? (
                <NoData />
              ) : (
                <>
                  <ComparisonBarChart data={growth} primaryLabel="Organizations" secondaryLabel="Users" primaryColor="#3B82F6" secondaryColor="#10B981" height={230} />
                  <DataTable label="Created by month" headers={["Month", "Organizations", "Users"]} rows={growth.map((g) => [g.label, g.primary, g.secondary ?? 0])} />
                </>
              )}
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Sign-ins by day"
                description="Successful and failed sign-ins recorded per day."
                onCsv={csv("logins-by-day", ["Date", "Succeeded", "Failed"], data.logins.by_day.map((d) => [d.date, d.succeeded, d.failed]))}
              />
              {logins.length === 0 ? (
                <NoData />
              ) : (
                <>
                  <ComparisonBarChart data={logins} primaryLabel="Succeeded" secondaryLabel="Failed" primaryColor="#10B981" secondaryColor="#F43F5E" height={230} />
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[var(--color-text-secondary)]">Show daily values ({logins.length} days)</summary>
                    <div className="mt-2">
                      <DataTable label="Sign-ins by day" headers={["Date", "Succeeded", "Failed"]} rows={data.logins.by_day.map((d) => [d.date, d.succeeded, d.failed])} />
                    </div>
                  </details>
                </>
              )}
            </SurfaceCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Subscriptions by status"
                description="Subscription records per status."
                onCsv={csv("subscriptions-by-status", ["Status", "Count"], data.subscriptions.by_status.map((s) => [s.status, s.count]))}
              />
              {data.subscriptions.by_status.length === 0 ? (
                <NoData />
              ) : (
                <ShareBars label="Subscriptions by status" rows={data.subscriptions.by_status.map((s) => ({ name: humanize(s.status), count: s.count }))} />
              )}
            </SurfaceCard>
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Subscriptions by plan"
                description="Subscription records per plan."
                onCsv={csv("subscriptions-by-plan", ["Plan ID", "Plan", "Count"], data.subscriptions.by_plan.map((p) => [p.plan_id, p.plan_name, p.count]))}
              />
              {data.subscriptions.by_plan.length === 0 ? (
                <NoData />
              ) : (
                <ShareBars label="Subscriptions by plan" rows={data.subscriptions.by_plan.map((p) => ({ name: p.plan_name || p.plan_id, count: p.count }))} />
              )}
            </SurfaceCard>
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Audit events by category"
                description="Administrative events recorded per category."
                onCsv={csv("audit-by-category", ["Category", "Count"], data.audit.by_category.map((c) => [c.category, c.count]))}
              />
              {data.audit.by_category.length === 0 ? (
                <NoData />
              ) : (
                <ShareBars label="Audit events by category" rows={data.audit.by_category.map((c) => ({ name: humanize(c.category), count: c.count }))} />
              )}
            </SurfaceCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Invoices & payments"
                description="Billing is dormant in V1; these are the records stored on the server."
                onCsv={csv("invoices-by-status", ["Status", "Count", "Total"], data.invoices.by_status.map((s) => [s.status, s.count, s.total]))}
              />
              {data.invoices.by_status.length === 0 ? (
                <NoData />
              ) : (
                <DataTable label="Invoices by status" headers={["Status", "Invoices", "Total"]} rows={data.invoices.by_status.map((s) => [humanize(s.status), fmt(s.count), formatAmount(s.total)])} />
              )}
              <DataTable
                label="Payments"
                headers={["Payments", "Value"]}
                rows={[
                  ["Succeeded total", formatAmount(data.payments.succeeded_total)],
                  ["Refunded total", formatAmount(data.payments.refunded_total)],
                  ["Failed payments", fmt(data.payments.failed_count)],
                ]}
              />
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <SectionHeader
                title="Audit events by day"
                description="Administrative events recorded per day."
                onCsv={csv("audit-by-day", ["Date", "Events"], data.audit.by_day.map((d) => [d.date, d.count]))}
              />
              {auditDays.length === 0 ? (
                <NoData />
              ) : (
                <>
                  <ComparisonBarChart data={auditDays} primaryLabel="Events" primaryColor="#8B5CF6" height={210} />
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[var(--color-text-secondary)]">Show daily values ({auditDays.length} days)</summary>
                    <div className="mt-2">
                      <DataTable label="Audit events by day" headers={["Date", "Events"]} rows={data.audit.by_day.map((d) => [d.date, d.count])} />
                    </div>
                  </details>
                </>
              )}
            </SurfaceCard>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Download className="w-3 h-3" />
            CSV downloads contain exactly the values shown, for {data.range.from} to {data.range.to}.
          </p>
        </>
      )}
    </div>
  );
}
