"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CreditCard,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, formatCurrency } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminSelect,
  KpiCard,
  PageHeader,
  SimulationNotice,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";
import {
  ComparisonBarChart,
  PlanDistributionChart,
  RevenueOverviewChart,
} from "../_components/SuperAdminCharts";

export default function ReportsAnalyticsPage() {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const payments = useSuperAdminStore((s) => s.payments);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const supportTickets = useSuperAdminStore((s) => s.supportTickets);

  const { can } = useAdminPermissions();
  const canExport = can("system.export");

  const [timeframe, setTimeframe] = useState<"30D" | "6M" | "YTD">("6M");

  const totalMrr = useMemo(
    () =>
      organizations
        .filter((o) => o.status !== "SUSPENDED")
        .reduce((sum, o) => sum + o.mrr, 0),
    [organizations]
  );

  const totalSeats = useMemo(
    () => organizations.reduce((sum, o) => sum + o.seatsUsed, 0),
    [organizations]
  );

  const collectedRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.status === "SUCCEEDED")
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const activeOrgsCount = useMemo(
    () => organizations.filter((o) => o.status === "ACTIVE").length,
    [organizations]
  );

  const revenueSeries = useMemo(() => {
    const base = Math.max(totalMrr, 12000);
    if (timeframe === "30D") {
      return [
        { period: "Week 1", mrr: Math.round(base * 0.94), collected: Math.round(base * 0.25), refunded: 0 },
        { period: "Week 2", mrr: Math.round(base * 0.96), collected: Math.round(base * 0.28), refunded: 120 },
        { period: "Week 3", mrr: Math.round(base * 0.98), collected: Math.round(base * 0.24), refunded: 0 },
        { period: "Week 4", mrr: base, collected: Math.round(collectedRevenue * 0.35), refunded: 99 },
      ];
    }
    if (timeframe === "YTD") {
      return [
        { period: "Q1", mrr: Math.round(base * 0.72), collected: Math.round(base * 2.1), refunded: 190 },
        { period: "Q2", mrr: Math.round(base * 0.84), collected: Math.round(base * 2.45), refunded: 140 },
        { period: "Q3", mrr: Math.round(base * 0.93), collected: Math.round(base * 2.75), refunded: 210 },
        { period: "Q4 (Curr)", mrr: base, collected: Math.round(collectedRevenue), refunded: 99 },
      ];
    }
    return [
      { period: "Jun", mrr: Math.round(base * 0.78), collected: Math.round(base * 0.74), refunded: 99 },
      { period: "Jul", mrr: Math.round(base * 0.83), collected: Math.round(base * 0.81), refunded: 0 },
      { period: "Aug", mrr: Math.round(base * 0.88), collected: Math.round(base * 0.86), refunded: 149 },
      { period: "Sep", mrr: Math.round(base * 0.92), collected: Math.round(base * 0.9), refunded: 0 },
      { period: "Oct", mrr: Math.round(base * 0.96), collected: Math.round(base * 0.94), refunded: 79 },
      { period: "Nov", mrr: base, collected: Math.round(collectedRevenue), refunded: 99 },
    ];
  }, [totalMrr, collectedRevenue, timeframe]);

  const orgGrowthSeries = useMemo(() => {
    const orgCount = organizations.length;
    const avgSeats = Math.max(totalSeats, 100);
    return [
      { label: "Jun", primary: Math.max(2, orgCount - 3), secondary: Math.round(avgSeats * 0.72) },
      { label: "Jul", primary: Math.max(3, orgCount - 2), secondary: Math.round(avgSeats * 0.79) },
      { label: "Aug", primary: Math.max(4, orgCount - 2), secondary: Math.round(avgSeats * 0.85) },
      { label: "Sep", primary: Math.max(5, orgCount - 1), secondary: Math.round(avgSeats * 0.91) },
      { label: "Oct", primary: orgCount, secondary: Math.round(avgSeats * 0.96) },
      { label: "Nov", primary: orgCount, secondary: avgSeats },
    ];
  }, [organizations.length, totalSeats]);

  const planSlices = useMemo(() => {
    const colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];
    return plans.map((plan, idx) => {
      const orgsOnPlan = organizations.filter((o) => o.planId === plan.id);
      return {
        name: plan.name,
        orgs: orgsOnPlan.length,
        mrr: orgsOnPlan.reduce((sum, o) => sum + o.mrr, 0),
        color: colors[idx % colors.length],
      };
    });
  }, [plans, organizations]);

  const handleDownloadReport = (type: "organizations" | "revenue" | "support") => {
    if (!canExport) {
      toast.error("Your role does not permit downloading platform reports.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (type === "organizations") {
      exportRowsToCsv(
        `prowise-organization-utilization-${today}.csv`,
        ["Organization", "Status", "Plan", "Seats Used", "Seats Limit", "Projects", "Storage (GB)", "MRR ($)"],
        organizations.map((o) => [
          o.name,
          o.status,
          plans.find((p) => p.id === o.planId)?.name || o.planId,
          o.seatsUsed,
          o.seatsLimit,
          o.projectsCount,
          o.storageUsedGb,
          o.mrr,
        ])
      );
      toast.success("Downloaded Organization Utilization report (CSV).");
      return;
    }

    if (type === "revenue") {
      exportRowsToCsv(
        `prowise-revenue-invoices-${today}.csv`,
        ["Invoice #", "Organization", "Issue Date", "Due Date", "Status", "Total ($)"],
        invoices.map((inv) => [
          inv.invoiceNumber,
          organizations.find((o) => o.id === inv.orgId)?.name || inv.orgId,
          inv.issueDate,
          inv.dueDate,
          inv.status,
          inv.total,
        ])
      );
      toast.success("Downloaded Revenue & Invoices report (CSV).");
      return;
    }

    exportRowsToCsv(
      `prowise-support-sla-${today}.csv`,
      ["Ticket #", "Organization", "Priority", "Status", "SLA Target (min)", "SLA State", "Updated"],
      supportTickets.map((t) => [
        t.ticketNumber,
        t.orgName,
        t.priority,
        t.status,
        t.slaTargetMinutes,
        t.slaState,
        t.updatedAt,
      ])
    );
    toast.success("Downloaded Support SLA Performance report (CSV).");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        badge={timeframe}
        simulationLabel="Client-Computed & CSV"
        description="Review platform revenue trends, customer seat utilization, plan adoption, and download executive CSV summaries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <AdminSelect
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as "30D" | "6M" | "YTD")}
                aria-label="Report timeframe"
                options={[
                  { label: "Last 30 Days", value: "30D" },
                  { label: "Last 6 Months", value: "6M" },
                  { label: "Year to Date", value: "YTD" },
                ]}
              />
            </div>
            <AdminButton
              variant="primary"
              size="sm"
              permissionLocked={!canExport}
              onClick={() => handleDownloadReport("organizations")}
            >
              <Download className="w-3.5 h-3.5" />
              Export Org Report
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Live Store Calculations + Historical Modeling"
        description="KPI totals and plan splits reflect live Super Admin state; multi-month trend lines combine live totals with seeded historical modeling."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Monthly Recurring Revenue"
          value={formatCurrency(totalMrr)}
          sublabel={`${formatCurrency(totalMrr * 12)} annualized run-rate`}
          icon={TrendingUp}
          tone="blue"
          trend={{ value: "+11.4%", positive: true }}
        />
        <KpiCard
          label="Active Customer Workspaces"
          value={activeOrgsCount}
          sublabel={`${organizations.length} total organizations onboarded`}
          icon={Building2}
          tone="emerald"
        />
        <KpiCard
          label="Licensed Seats Occupied"
          value={totalSeats.toLocaleString()}
          sublabel={`Across ${subscriptions.length} active/trial subscriptions`}
          icon={Users}
          tone="violet"
        />
        <KpiCard
          label="Collected Payments"
          value={formatCurrency(collectedRevenue)}
          sublabel={`${invoices.filter((i) => i.status === "OVERDUE").length} overdue invoice(s)`}
          icon={CreditCard}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-3 xl:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Revenue & Collection Trend ({timeframe})
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Tracks monthly recurring revenue run-rate alongside settled customer payments.
            </p>
          </div>
          <RevenueOverviewChart data={revenueSeries} height={270} />
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Organizations by Plan
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Distribution of workspaces and MRR contribution per subscription tier.
            </p>
          </div>
          <PlanDistributionChart data={planSlices} height={220} />
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Organization & Seat Growth
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Compares active customer organizations against total occupied workspace seats.
            </p>
          </div>
          <ComparisonBarChart
            data={orgGrowthSeries}
            primaryLabel="Organizations"
            secondaryLabel="Active Seats"
            primaryColor="#3B82F6"
            secondaryColor="#10B981"
            height={230}
          />
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Downloadable Executive Reports
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Export clean spreadsheet-ready CSV reports for finance, leadership, and compliance reviews.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              {
                key: "organizations" as const,
                title: "Organization Utilization & Seat Capacity",
                desc: "All customer workspaces, plan assignments, seat utilization, and MRR.",
                count: `${organizations.length} organizations`,
              },
              {
                key: "revenue" as const,
                title: "Billing Invoices & Settlement Ledger",
                desc: "Issued, paid, and overdue invoices ready for finance reconciliation.",
                count: `${invoices.length} invoices`,
              },
              {
                key: "support" as const,
                title: "Support Escalations & SLA Health",
                desc: "Customer escalation volume, assigned owners, and SLA compliance state.",
                count: `${supportTickets.length} tickets`,
              },
            ].map((rep) => (
              <div
                key={rep.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                    {rep.title}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{rep.desc}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{rep.count}</p>
                </div>
                <AdminButton
                  variant="outline"
                  size="xs"
                  permissionLocked={!canExport}
                  onClick={() => handleDownloadReport(rep.key)}
                  className="shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Download CSV
                </AdminButton>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
