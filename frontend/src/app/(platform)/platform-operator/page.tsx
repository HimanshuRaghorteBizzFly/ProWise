"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileWarning,
  History,
  KeyRound,
  LifeBuoy,
  Mail,
  MailPlus,
  MailWarning,
  Megaphone,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { formatDateTime } from "./_services/operator-service";
import { operatorApi } from "./_services/operator-api";
import {
  OPERATOR_DEPARTMENTS,
  OPERATOR_MODULE_CATALOG,
  OperatorDepartmentName,
  normalizeDepartmentName,
  resolveEffectivePermission,
} from "./_services/operator-permission-service";
import {
  KpiCard,
  OpButton,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "./_components/OperatorPrimitives";
import { QueueBarChart } from "./_components/OperatorCharts";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  formatMoney,
  humanizeCode,
  pageItemsOf,
  rowsOf,
  useOperatorMutation,
  useOperatorResource,
  type ResourceState,
} from "./_components/OperatorLive";

function getDepartmentBadgeClass(dept: string): string {
  const key = dept.toLowerCase();
  if (key.includes("operations")) return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (key.includes("site") || key.includes("reliability")) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  if (key.includes("message") || key.includes("messaging") || key.includes("lifecycle")) return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (key.includes("customer") || key.includes("support") || key.includes("communication")) return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (key.includes("finance") || key.includes("tax")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (key.includes("revenue") || key.includes("revops")) return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";
  if (key.includes("trust") || key.includes("compliance") || key.includes("security")) return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

/** Placeholder shown inside a kept card whose data source has no backend yet. Never sample values. */
function NotAvailablePanel({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-app-bg)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
      <p className="font-semibold text-[var(--color-text-muted)]">{NOT_AVAILABLE}</p>
      <p className="mt-1">{reason}</p>
    </div>
  );
}

/** Loading / error (Retry) / empty for a list card; renders `children` when the list has rows. */
function ListState<T>({
  state,
  rows,
  onRetry,
  emptyTitle,
  emptyDescription,
  children,
}: {
  state: ResourceState<T[]>;
  rows: T[];
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  if (state.status !== "ready" || rows.length === 0) {
    return (
      <OperatorResourceStatus
        state={state.status === "ready" ? { status: "ready", data: rows } : state}
        isEmpty={(data) => data.length === 0}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        rows={2}
      />
    );
  }
  return <>{children}</>;
}

/** A count from a loaded list: the real figure, or "—" while loading / after a failure. */
function countOf<T>(state: ResourceState<T[]>, predicate: (row: T) => boolean = () => true): number | string {
  return state.status === "ready" ? state.data.filter(predicate).length : "—";
}

/** A paged console resource seen as a plain list resource (its `items`), for ListState. */
function asListState<T>(state: ResourceState<{ items: T[] }>): ResourceState<T[]> {
  return state.status === "ready" ? { status: "ready", data: state.data.items ?? [] } : state;
}

const upper = (value: string | null | undefined) => (value ?? "").toUpperCase();
const NA_SUB = NOT_AVAILABLE;
const AUTO_REFRESH_MS = 60_000;

export default function PlatformOperatorDashboardPage() {
  /* ---------------------------------------------------------------- live reads (no demo store, no seed) */
  const me = useOperatorResource(() => operatorApi.me(), "me");
  const myPermissions = useOperatorResource(() => operatorApi.myPermissions(), "my-permissions");
  const summary = useOperatorResource(() => operatorApi.dashboard(), "dashboard");
  const stats = useOperatorResource(() => operatorApi.dashboardStats(), "dashboard-stats");
  const incidentsRes = useOperatorResource(() => operatorApi.incidents.list(), "incidents");
  const ticketsRes = useOperatorResource(() => operatorApi.tickets.list(), "tickets");
  const accessRes = useOperatorResource(() => operatorApi.accessRequests.list(), "access-requests");
  const alertsRes = useOperatorResource(() => operatorApi.alerts.list(), "alerts");
  const jobsRes = useOperatorResource(() => operatorApi.jobs(), "jobs");
  const webhooksRes = useOperatorResource(() => operatorApi.webhooks(), "webhooks");
  const maintenanceRes = useOperatorResource(() => operatorApi.maintenance.list(), "maintenance");
  const outboxRes = useOperatorResource(() => operatorApi.outbox.failed(), "outbox-failed");
  const emailRes = useOperatorResource(() => operatorApi.emailDelivery.list(), "email-delivery");
  const operatorsRes = useOperatorResource(() => operatorApi.operatorProfiles(), "operator-directory");
  // Operator console reads (paged, small pages; tiles use the server's `total`, never a page length).
  const [todayStartIso] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const orgsRes = useOperatorResource(() => operatorApi.organizations.list({ size: 6 }), "dash-orgs");
  const subsRes = useOperatorResource(() => operatorApi.subscriptions({ size: 5 }), "dash-subscriptions");
  const activeSubsRes = useOperatorResource(
    () => operatorApi.subscriptions({ status: "ACTIVE", size: 1 }),
    "dash-subscriptions-active"
  );
  const payFailRes = useOperatorResource(() => operatorApi.paymentFailures({ size: 5 }), "dash-payment-failures");
  const invoicesRes = useOperatorResource(() => operatorApi.invoiceDelivery({ size: 5 }), "dash-invoices");
  const invoicesFailedRes = useOperatorResource(
    () => operatorApi.invoiceDelivery({ delivery_status: "FAILED", size: 1 }),
    "dash-invoices-failed"
  );
  const invoicesNotSentRes = useOperatorResource(
    () => operatorApi.invoiceDelivery({ delivery_status: "NOT_SENT", size: 1 }),
    "dash-invoices-not-sent"
  );
  const apiSummaryRes = useOperatorResource(() => operatorApi.apiErrors.summary(), "dash-api-errors");
  const emailDraftsRes = useOperatorResource(() => operatorApi.emailDrafts.list({ size: 3 }), "dash-email-drafts");
  const emailDraftsSubmittedRes = useOperatorResource(
    () => operatorApi.emailDrafts.list({ status: "SUBMITTED", size: 1 }),
    "dash-email-drafts-submitted"
  );
  const annDraftsRes = useOperatorResource(
    () => operatorApi.announcementDrafts.list({ size: 3 }),
    "dash-announcement-drafts"
  );
  const annPendingRes = useOperatorResource(
    () => operatorApi.announcementDrafts.list({ status: "PENDING_REVIEW", size: 1 }),
    "dash-announcements-pending"
  );
  const annPublishedRes = useOperatorResource(
    () => operatorApi.announcementDrafts.list({ status: "PUBLISHED", size: 1 }),
    "dash-announcements-published"
  );
  const backupsRes = useOperatorResource(() => operatorApi.backups.list({ size: 5 }), "dash-backups");
  const activityRes = useOperatorResource(() => operatorApi.activityLogs({ size: 8 }), "dash-activity");
  const activityTodayRes = useOperatorResource(
    () => operatorApi.activityLogs({ from: todayStartIso, size: 1 }),
    `dash-activity-today:${todayStartIso}`
  );

  const reloaders = [
    orgsRes.reload,
    subsRes.reload,
    activeSubsRes.reload,
    payFailRes.reload,
    invoicesRes.reload,
    invoicesFailedRes.reload,
    invoicesNotSentRes.reload,
    apiSummaryRes.reload,
    emailDraftsRes.reload,
    emailDraftsSubmittedRes.reload,
    annDraftsRes.reload,
    annPendingRes.reload,
    annPublishedRes.reload,
    backupsRes.reload,
    activityRes.reload,
    activityTodayRes.reload,
    me.reload,
    myPermissions.reload,
    summary.reload,
    stats.reload,
    incidentsRes.reload,
    ticketsRes.reload,
    accessRes.reload,
    alertsRes.reload,
    jobsRes.reload,
    webhooksRes.reload,
    maintenanceRes.reload,
    outboxRes.reload,
    emailRes.reload,
    operatorsRes.reload,
  ];
  const reloadersRef = React.useRef(reloaders);
  reloadersRef.current = reloaders;
  const reloadAll = useCallback(() => {
    reloadersRef.current.forEach((reload) => void reload());
  }, []);

  const alertMutation = useOperatorMutation(alertsRes.reload);

  /* Real periodic re-read of the server lists (off by default); replaces the old simulated telemetry tick. */
  const [autoPulseEnabled, setAutoPulseEnabled] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [viewDepartment, setViewDepartment] = useState<OperatorDepartmentName | null>(null);

  useEffect(() => {
    if (!autoPulseEnabled) return;
    const id = setInterval(reloadAll, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoPulseEnabled, reloadAll]);

  // Assigned department comes from the server (operator profile, else the dashboard summary's department id).
  const profile = me.state.status === "ready" ? me.state.data : null;
  const assignedDepartmentId =
    profile?.department ?? (summary.state.status === "ready" ? summary.state.data.department : undefined);
  const assignedDepartment = normalizeDepartmentName(assignedDepartmentId ?? undefined);
  const activeDepartment: OperatorDepartmentName = viewDepartment ?? assignedDepartment;
  const canSwitchView =
    upper(profile?.access_level) === "MAIN_PLATFORM_OPERATOR" || assignedDepartment === "Platform Operations";

  const activeOperator = {
    name: profile?.name ?? (me.state.status === "loading" ? "Loading operator" : "Operator"),
    email: profile?.email ?? "—",
    mfaEnabled: profile?.mfa_enabled ?? false,
    onCall: profile?.on_call ?? false,
    shiftName: profile?.shift_name ?? null,
  };

  // Individual grants / denies recorded on the server for this operator.
  const permissionOverrides = useMemo(
    () =>
      myPermissions.state.status === "ready"
        ? myPermissions.state.data.permissions.filter((p) => upper(p.state) !== "DEPARTMENT_DEFAULT")
        : [],
    [myPermissions.state]
  );

  // Check if a specific module can be viewed under current department (department defaults, as before)
  const canViewModule = useCallback(
    (moduleKey: string) => resolveEffectivePermission(activeDepartment, moduleKey, "view").allowed,
    [activeDepartment]
  );

  // Count authorized operational modules
  const authorizedModulesCount = useMemo(() => {
    return OPERATOR_MODULE_CATALOG.filter((mod) => canViewModule(mod.key)).length;
  }, [canViewModule]);

  /* ---------------------------------------------------------------- derived real figures */
  const incidents = useMemo(() => rowsOf(incidentsRes.state), [incidentsRes.state]);
  const tickets = useMemo(() => rowsOf(ticketsRes.state), [ticketsRes.state]);
  const accessRequests = rowsOf(accessRes.state);
  const alerts = useMemo(() => rowsOf(alertsRes.state), [alertsRes.state]);
  const syncJobs = rowsOf(jobsRes.state);
  const maintenanceWindows = rowsOf(maintenanceRes.state);
  const emailDeliveries = useMemo(() => rowsOf(emailRes.state), [emailRes.state]);
  const operators = rowsOf(operatorsRes.state);

  const openIncidents = useMemo(() => incidents.filter((i) => upper(i.status) !== "RESOLVED"), [incidents]);
  const openTickets = useMemo(
    () => tickets.filter((t) => upper(t.status) !== "RESOLVED" && upper(t.status) !== "CLOSED"),
    [tickets]
  );
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);

  const isFailedWebhook = (status: string) => upper(status) === "FAILED" || upper(status) === "RETRYING";
  const failedWebhooksCount = countOf(webhooksRes.state, (w) => isFailedWebhook(w.status));
  const failedOutboxCount = countOf(outboxRes.state);
  const pendingSyncJobsCount = countOf(jobsRes.state, (j) => upper(j.status) !== "COMPLETED");
  const pendingAccessCount = countOf(accessRes.state, (r) => upper(r.status) === "PENDING_APPROVAL");
  const openIncidentsCount = countOf(incidentsRes.state, (i) => upper(i.status) !== "RESOLVED");
  const openTicketsCount = countOf(
    ticketsRes.state,
    (t) => upper(t.status) !== "RESOLVED" && upper(t.status) !== "CLOSED"
  );
  const activeAlertsCount = countOf(alertsRes.state, (a) => !a.acknowledged);
  const activeMaintenanceCount = countOf(
    maintenanceRes.state,
    (m) => upper(m.status) !== "COMPLETED" && upper(m.status) !== "CANCELLED"
  );
  const emailAcceptedCount = countOf(emailRes.state, (e) => upper(e.status) === "SMTP_ACCEPTED");
  const emailFailedCount = countOf(emailRes.state, (e) => upper(e.status) === "FAILED" || upper(e.status) === "NOT_SENT");
  const emailNotAcceptedCount = countOf(emailRes.state, (e) => upper(e.status) !== "SMTP_ACCEPTED");
  const isBillingDept = (dept: string | null) => dept === "revenue-operations" || dept === "finance-tax";
  const billingIncidentsCount = countOf(
    incidentsRes.state,
    (i) => upper(i.status) !== "RESOLVED" && isBillingDept(i.department_id)
  );
  const financeTicketsCount = countOf(ticketsRes.state, (t) => t.department_id === "finance-tax");
  const communicationAlertsCount = countOf(
    alertsRes.state,
    (a) => !a.acknowledged && (a.department_id === "lifecycle-messaging" || a.department_id === "customer-communications")
  );
  const securityAlertsCount = countOf(
    alertsRes.state,
    (a) => !a.acknowledged && (upper(a.severity) === "CRITICAL" || a.department_id === "trust-compliance")
  );
  const mfaCompliance =
    operatorsRes.state.status === "ready"
      ? `${operators.filter((o) => o.mfa_enabled).length} / ${operators.length}`
      : "—";
  // /dashboard/stats counters (real repository counts; its health score string is never shown).
  const statsData = stats.state.status === "ready" ? stats.state.data : null;
  const failedJobsStat = statsData?.failedJobs ?? "—";
  const retryingWebhooksStat = statsData?.pendingWebhooks ?? "—";
  const orgsByState = statsData?.organizationsByState ?? null;
  const activeOrgsCount: number | string = orgsByState ? orgsByState.ACTIVE ?? 0 : "—";
  const suspendedOrgsCount: number | string = orgsByState ? orgsByState.SUSPENDED ?? 0 : "—";

  // Console list totals (server `total`), "—" while loading or after a failure.
  const totalOf = (state: ResourceState<{ total: number }>): number | string =>
    state.status === "ready" ? state.data.total ?? 0 : "—";
  const orgRows = pageItemsOf(orgsRes.state);
  const totalOrgsCount = totalOf(orgsRes.state);
  const subscriptionRows = pageItemsOf(subsRes.state);
  const totalSubscriptionsCount = totalOf(subsRes.state);
  const activeSubscriptionsCount = totalOf(activeSubsRes.state);
  const paymentFailureRows = pageItemsOf(payFailRes.state);
  const paymentFailuresCount = totalOf(payFailRes.state);
  const invoiceRows = pageItemsOf(invoicesRes.state);
  const invoicesTrackedCount = totalOf(invoicesRes.state);
  const invoicesFailedCount = totalOf(invoicesFailedRes.state);
  const invoicesNotSentCount = totalOf(invoicesNotSentRes.state);
  const invoiceExceptionsCount =
    typeof invoicesFailedCount === "number" && typeof invoicesNotSentCount === "number"
      ? invoicesFailedCount + invoicesNotSentCount
      : "—";
  const apiSummary = apiSummaryRes.state.status === "ready" ? apiSummaryRes.state.data : null;
  const apiErrors24h: number | string = apiSummary ? apiSummary.total : "—";
  const apiServerErrors24h: number | string = apiSummary ? apiSummary.server_errors : "—";
  const emailDraftRows = pageItemsOf(emailDraftsRes.state);
  const emailDraftsCount = totalOf(emailDraftsRes.state);
  const emailDraftsSubmittedCount = totalOf(emailDraftsSubmittedRes.state);
  const announcementDraftRows = pageItemsOf(annDraftsRes.state);
  const announcementDraftsCount = totalOf(annDraftsRes.state);
  const announcementsPendingCount = totalOf(annPendingRes.state);
  const announcementsPublishedCount = totalOf(annPublishedRes.state);
  const pendingDraftsCount =
    typeof emailDraftsSubmittedCount === "number" && typeof announcementsPendingCount === "number"
      ? emailDraftsSubmittedCount + announcementsPendingCount
      : "—";
  const backupList = backupsRes.state.status === "ready" ? backupsRes.state.data : null;
  const latestBackup = backupList?.items?.[0] ?? null;
  const latestBackupLabel: string = !backupList
    ? "—"
    : !backupList.configured
    ? "Not configured"
    : latestBackup
    ? humanizeCode(latestBackup.status)
    : "No runs";
  const succeededBackupsShown: number | string = backupList
    ? backupList.items.filter((b) => upper(b.status) === "SUCCEEDED").length
    : "—";
  const activityRows = pageItemsOf(activityRes.state);
  const activityTodayCount = totalOf(activityTodayRes.state);

  const toneFor = (value: number | string, busy: "amber" | "rose" = "amber") =>
    typeof value === "number" && value > 0 ? busy : "emerald";

  // Email status breakdown from the real delivery log (count per status, attempts beyond the first as exceptions).
  const emailDeliveryBarSeries = useMemo(() => {
    const buckets = new Map<string, { processed: number; retries: number }>();
    emailDeliveries.forEach((e) => {
      const bucket = buckets.get(e.status) ?? { processed: 0, retries: 0 };
      bucket.processed += 1;
      bucket.retries += Math.max(0, e.attempts - 1);
      buckets.set(e.status, bucket);
    });
    return Array.from(buckets.entries()).map(([status, v]) => ({ label: humanizeCode(status), ...v }));
  }, [emailDeliveries]);

  const handleSwitchDepartment = (dept: OperatorDepartmentName) => {
    setViewDepartment(dept === assignedDepartment ? null : dept);
    setDeptPickerOpen(false);
    toast.success(
      dept === assignedDepartment
        ? `Showing your assigned department (${dept}).`
        : `Showing the ${dept} view. Your assigned department is ${assignedDepartment}.`
    );
  };

  const acknowledge = (alertId: string) =>
    void alertMutation.run(`ack-${alertId}`, () => operatorApi.alerts.acknowledge(alertId), "Alert acknowledged.");

  /* Recent rows of the read-only billing lists (shared by the Revenue Operations and Finance & Tax views). */
  const paymentFailureList = (
    <ListState
      state={asListState(payFailRes.state)}
      rows={paymentFailureRows}
      onRetry={() => void payFailRes.reload()}
      emptyTitle="No payment failures"
      emptyDescription="No failed payments are recorded."
    >
      <div className="space-y-2.5">
        {paymentFailureRows.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{p.org_name ?? p.org_id ?? "—"}</span>
              <span className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatMoney(p.amount, p.currency)}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
              {p.failure_reason ?? "No reason recorded"} · {p.invoice_number ?? "no invoice"}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {p.method ?? "—"}
              {p.method_last4 ? ` •••• ${p.method_last4}` : ""} · {p.failed_at ? formatDateTime(p.failed_at) : "—"}
            </p>
          </div>
        ))}
      </div>
    </ListState>
  );

  const subscriptionList = (
    <ListState
      state={asListState(subsRes.state)}
      rows={subscriptionRows}
      onRetry={() => void subsRes.reload()}
      emptyTitle="No subscriptions"
      emptyDescription="No organization has a subscription yet."
    >
      <div className="space-y-2.5">
        {subscriptionRows.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{s.org_name ?? s.org_id}</span>
              <StatusBadge label={humanizeCode(s.status)} tone={getStatusTone(s.status)} dot />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {s.plan_name ?? s.plan_code ?? "—"} · {humanizeCode(s.billing_cycle)} · {s.seats_used} / {s.seats} seats
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Renews: {s.current_period_end ? formatDateTime(s.current_period_end) : "—"}
              {s.cancel_at_period_end ? " · cancels at period end" : ""}
            </p>
          </div>
        ))}
      </div>
    </ListState>
  );

  /* Recent operator activity + audit entries (GET /v1/operator/activity-logs; the server applies the scope). */
  const activityList = (
    <ListState
      state={asListState(activityRes.state)}
      rows={activityRows}
      onRetry={() => void activityRes.reload()}
      emptyTitle="No operator activity"
      emptyDescription="No operator activity has been recorded yet."
    >
      {activityRows.map((a) => (
        <div key={`${a.source}-${a.id}`} className="py-2.5 text-xs space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[var(--color-text-primary)] truncate">{humanizeCode(a.action)}</span>
            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
              {a.occurred_at ? formatDateTime(a.occurred_at) : "—"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
            {a.operator_name ?? "System"} · {a.resource_type ?? a.module_key ?? "—"}
            {a.resource_id ? ` ${a.resource_id}` : ""} · {humanizeCode(a.source)}
          </p>
        </div>
      ))}
    </ListState>
  );

  const invoiceList = (
    <ListState
      state={asListState(invoicesRes.state)}
      rows={invoiceRows}
      onRetry={() => void invoicesRes.reload()}
      emptyTitle="No invoices"
      emptyDescription="No invoices have been issued yet."
    >
      <div className="space-y-2.5">
        {invoiceRows.map((inv) => (
          <div
            key={inv.invoice_id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)] truncate">
                {inv.invoice_number ?? inv.invoice_id} · {inv.org_name ?? "—"}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                {formatMoney(inv.total)} · due {inv.due_date ?? "—"} · {inv.recipient_email ?? "no recipient"}
              </p>
            </div>
            <StatusBadge label={humanizeCode(inv.delivery_status)} tone={getStatusTone(inv.delivery_status)} dot />
          </div>
        ))}
      </div>
    </ListState>
  );


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${activeDepartment} Operations Center`}
        badge={autoPulseEnabled ? "Auto-Refresh On" : "Manual Refresh"}
        liveData
        description={`Personalized operational console for ${activeDepartment}. Scoped by role permissions and Spring Boot deny-by-default access control.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Context Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setDeptPickerOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${getDepartmentBadgeClass(
                  activeDepartment
                )}`}
              >
                <span>Department: {activeDepartment}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {deptPickerOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1">
                    Switch Operator Department
                  </div>
                  {!canSwitchView && (
                    <p className="px-2.5 py-1 text-[10px] text-[var(--color-text-muted)]">
                      Your department is assigned by a Super Admin; other department views are for Main Platform Operators.
                    </p>
                  )}
                  {OPERATOR_DEPARTMENTS.map((dept) => {
                    const isSelected = dept === activeDepartment;
                    const locked = !canSwitchView && dept !== assignedDepartment;
                    return (
                      <button
                        key={dept}
                        onClick={() => handleSwitchDepartment(dept)}
                        disabled={locked}
                        title={locked ? "Only Main Platform Operators can view other departments" : undefined}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 font-semibold"
                            : "hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <span className="truncate">{dept}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <OpButton
              variant="outline"
              size="sm"
              onClick={() => setAutoPulseEnabled((v) => !v)}
              title="Re-reads the server lists every 60 seconds while on"
            >
              <Activity className="w-3.5 h-3.5" />
              {autoPulseEnabled ? "Pause Pulse" : "Resume Pulse"}
            </OpButton>
            <OpButton variant="primary" size="sm" onClick={reloadAll}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </OpButton>
          </div>
        }
      />

      {/* Operator Department Profile & Scope Banner */}
      <SurfaceCard className="p-4 sm:p-5 border-l-4 border-l-teal-500 bg-[var(--color-elevated)]/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0 border border-teal-500/30">
              {activeOperator.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                  {activeOperator.name}
                </span>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getDepartmentBadgeClass(activeDepartment)}`}>
                  {activeDepartment}
                </span>
                <StatusBadge
                  label={activeOperator.mfaEnabled ? "MFA Verified" : "MFA Required"}
                  tone={activeOperator.mfaEnabled ? "success" : "warning"}
                />
                {activeOperator.onCall && (
                  <StatusBadge label="On-Call Active" tone="violet" dot />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {activeOperator.email} · Shift:{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {activeOperator.shiftName || "Not set"}
                </span>
                {viewDepartment && (
                  <span className="ml-1 text-[var(--color-text-muted)]">
                    · Assigned department: {assignedDepartment}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-right">
              <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                Authorized Modules
              </p>
              <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                {authorizedModulesCount} of {OPERATOR_MODULE_CATALOG.length} Modules Active
              </p>
            </div>

            {permissionOverrides.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">
                  Overrides
                </p>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {permissionOverrides.length} Custom Rule(s)
                </p>
              </div>
            )}
          </div>
        </div>
        {me.state.status === "error" && (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">
            Could not load your operator profile: {me.state.message}{" "}
            <button className="underline font-medium" onClick={() => void me.reload()}>
              Retry
            </button>
          </p>
        )}
      </SurfaceCard>

      <MutationNotice
        notice={alertMutation.notice}
        onReload={() => void alertsRes.reload()}
        onDismiss={alertMutation.clearNotice}
      />

      {/* =========================================================================
          DEPARTMENT 1: SITE RELIABILITY
          ========================================================================= */}
      {activeDepartment === "Site Reliability" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="System Health"
              value="—"
              sublabel={`${NA_SUB}: no service health metrics endpoint`}
              icon={Server}
              tone="slate"
            />
            <KpiCard
              label="Failed Webhooks"
              value={failedWebhooksCount}
              sublabel={`Failed or retrying receipts · ${retryingWebhooksStat} retrying`}
              icon={RotateCcw}
              tone={toneFor(failedWebhooksCount)}
            />
            <KpiCard
              label="Pending Sync Jobs"
              value={pendingSyncJobsCount}
              sublabel={`${failedJobsStat} failed job(s) in background queue`}
              icon={Activity}
              tone="teal"
            />
            <KpiCard
              label="Active Incidents & Backups"
              value={openIncidentsCount}
              sublabel={`Open incidents · Latest backup: ${latestBackupLabel}`}
              icon={DatabaseBackup}
              tone={toneFor(openIncidentsCount, "rose")}
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Failed Webhooks",
                count: failedOutboxCount,
                href: "/platform-operator/failed-events",
                tone: toneFor(failedOutboxCount) !== "emerald" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: RotateCcw,
              },
              {
                label: "Sync Jobs & Queues",
                count: countOf(jobsRes.state),
                href: "/platform-operator/sync-jobs",
                tone: "text-teal-600 dark:text-teal-400",
                icon: Activity,
              },
              {
                label: "API Error Monitors",
                count: apiErrors24h,
                href: "/platform-operator/api-errors",
                tone: toneFor(apiServerErrors24h, "rose") !== "emerald" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
              {
                label: "Verified Backups",
                count: backupList && !backupList.configured ? latestBackupLabel : succeededBackupsShown,
                href: "/platform-operator/backups",
                tone: latestBackup && upper(latestBackup.status) === "FAILED" ? "text-rose-600 dark:text-rose-400" : "text-teal-600 dark:text-teal-400",
                icon: DatabaseBackup,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    API Response Time Trend
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Average endpoint latency over the past 60 minutes.
                  </p>
                </div>
                <Link href="/platform-operator/api-errors">
                  <OpButton variant="ghost" size="xs">
                    Inspect Latency <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              <NotAvailablePanel reason="The server does not record API latency over time yet." />
              {apiSummary && (
                <div className="space-y-1.5 text-xs">
                  <p className="text-[var(--color-text-secondary)]">
                    API errors in the last 24h: <span className="font-semibold text-[var(--color-text-primary)]">{apiSummary.total}</span>{" "}
                    ({apiSummary.server_errors} server · {apiSummary.client_errors} client)
                  </p>
                  {apiSummary.by_path.slice(0, 3).map((p) => (
                    <div
                      key={`${p.method} ${p.path}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[11px] truncate">
                        {p.method} {p.path}
                      </span>
                      <span className="tabular-nums text-[11px] text-[var(--color-text-muted)] shrink-0">
                        {p.count} ({p.server_errors} 5xx)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Background Queue Throughput & Retries
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Processed items vs. retry attempts across worker queues.
                  </p>
                </div>
                <Link href="/platform-operator/sync-jobs">
                  <OpButton variant="ghost" size="xs">
                    View Queues <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              <NotAvailablePanel reason="Background jobs report attempts but no processed-item counts yet." />
            </SurfaceCard>
          </div>

          {/* Active Incidents & Core Infrastructure Snapshot */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Platform Incidents ({openIncidents.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Sev-1 through Sev-3 incidents currently in investigation.
                  </p>
                </div>
                <Link href="/platform-operator/incidents">
                  <OpButton variant="outline" size="xs">
                    Incident Console
                  </OpButton>
                </Link>
              </div>

              {incidentsRes.state.status === "ready" && openIncidents.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  No open incidents.
                </div>
              ) : (
                <ListState
                  state={incidentsRes.state}
                  rows={openIncidents}
                  onRetry={() => void incidentsRes.reload()}
                  emptyTitle="No open incidents"
                  emptyDescription="No open incidents."
                >
                <div className="space-y-2.5">
                  {openIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge label={humanizeCode(inc.severity)} tone={getStatusTone(inc.severity)} />
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">
                            {inc.id}
                          </span>
                        </div>
                        <StatusBadge label={humanizeCode(inc.status)} tone={getStatusTone(inc.status)} dot />
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {inc.title}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {inc.department_name ?? "—"} · Assigned to {inc.assigned_operator_name ?? "Unassigned"}
                      </p>
                    </div>
                  ))}
                </div>
                </ListState>
              )}
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Core Infrastructure Snapshot
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Live CPU, memory, and latency metrics across monitored nodes.
                  </p>
                </div>
                <Link href="/platform-operator/monitoring">
                  <OpButton variant="outline" size="xs">
                    System Monitor
                  </OpButton>
                </Link>
              </div>

              <NotAvailablePanel reason="CPU, memory and latency metrics are not collected by the server yet." />
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 2: LIFECYCLE MESSAGING
          ========================================================================= */}
      {activeDepartment === "Lifecycle Messaging" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Emails Delivered"
              value={emailRes.state.status === "ready" ? `${emailAcceptedCount} / ${emailDeliveries.length}` : "—"}
              sublabel={`Accepted by SMTP server · inbox placement: ${NA_SUB}`}
              icon={Mail}
              tone="emerald"
            />
            <KpiCard
              label="Failed & Bounced"
              value={emailFailedCount}
              sublabel="Failed or not sent attempts"
              icon={MailWarning}
              tone={toneFor(emailFailedCount)}
            />
            <KpiCard
              label="SMTP Relay Status"
              value="—"
              sublabel={NA_SUB}
              icon={Radio}
              tone="slate"
            />
            <KpiCard
              label="Pending Drafts"
              value={pendingDraftsCount}
              sublabel={`Awaiting Super Admin review · ${emailDraftsSubmittedCount} email · ${announcementsPendingCount} announcement`}
              icon={MailPlus}
              tone={toneFor(pendingDraftsCount) === "emerald" ? "slate" : "blue"}
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Email Delivery & Logs",
                count: countOf(emailRes.state),
                href: "/platform-operator/email-delivery",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Mail,
              },
              {
                label: "Email Template Drafts",
                count: emailDraftsCount,
                href: "/platform-operator/email-drafts",
                tone: "text-blue-600 dark:text-blue-400",
                icon: MailPlus,
              },
              {
                label: "Announcement Drafts",
                count: announcementDraftsCount,
                href: "/platform-operator/announcement-drafts",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Megaphone,
              },
              {
                label: "Communication Alerts",
                count: communicationAlertsCount,
                href: "/platform-operator/alerts",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Main Grid: SMTP Health & Outbound Delivery Trend */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    SMTP Gateway & Delivery Health
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Live connection pool and sender domain authentication state.
                  </p>
                </div>
                <StatusBadge label={NOT_AVAILABLE} tone="neutral" dot />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Daily Outbound Sent</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)] mt-1">
                    <NotAvailableText />
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Inbox Placement</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    <NotAvailableText />
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <NotAvailablePanel reason="SMTP connection pool and sender domain checks are not exposed to operators yet." />
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Email Dispatch Volume Breakdown
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Deliveries, deferrals, and bounce metrics over recent dispatches.
                  </p>
                </div>
                <Link href="/platform-operator/email-delivery">
                  <OpButton variant="ghost" size="xs">
                    All Dispatches <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              {emailRes.state.status === "ready" && emailDeliveryBarSeries.length > 0 ? (
                <QueueBarChart
                  data={emailDeliveryBarSeries}
                  primaryKey="processed"
                  primaryLabel="Volume"
                  secondaryKey="retries"
                  secondaryLabel="Exceptions"
                  height={230}
                />
              ) : (
                <ListState
                  state={emailRes.state}
                  rows={emailDeliveries}
                  onRetry={() => void emailRes.reload()}
                  emptyTitle="No email delivery attempts"
                  emptyDescription="The delivery log is empty."
                >
                  {null}
                </ListState>
              )}
            </SurfaceCard>
          </div>

          {/* Email Deliveries Table & Drafts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Recent Outbound Deliveries
                </h3>
                <Link href="/platform-operator/email-delivery">
                  <OpButton variant="outline" size="xs">
                    Delivery Log
                  </OpButton>
                </Link>
              </div>
              <ListState
                state={emailRes.state}
                rows={emailDeliveries}
                onRetry={() => void emailRes.reload()}
                emptyTitle="No email delivery attempts"
                emptyDescription="The delivery log is empty."
              >
              <div className="space-y-2">
                {emailDeliveries.slice(0, 4).map((eml) => (
                  <div
                    key={eml.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          label={humanizeCode(eml.status)}
                          tone={
                            upper(eml.status) === "SMTP_ACCEPTED"
                              ? "success"
                              : upper(eml.status) === "FAILED" || upper(eml.status) === "NOT_SENT"
                              ? "danger"
                              : "warning"
                          }
                          dot
                        />
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">
                          {eml.recipient}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                        {eml.subject}
                      </p>
                    </div>
                    {upper(eml.status) !== "SMTP_ACCEPTED" && (
                      <NotAvailableButton
                        variant="subtle"
                        size="xs"
                        reason="logged emails cannot be re-sent (server returns EMAIL_RETRY_UNAVAILABLE)"
                      >
                        Resend
                      </NotAvailableButton>
                    )}
                  </div>
                ))}
              </div>
              </ListState>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Email & Announcement Drafts
                </h3>
                <Link href="/platform-operator/email-drafts">
                  <OpButton variant="outline" size="xs">
                    Author Draft
                  </OpButton>
                </Link>
              </div>
              <div className="space-y-2">
                <ListState
                  state={
                    emailDraftsRes.state.status === "ready" && annDraftsRes.state.status === "ready"
                      ? { status: "ready", data: [...emailDraftRows, ...announcementDraftRows] }
                      : emailDraftsRes.state.status === "error"
                      ? asListState(emailDraftsRes.state)
                      : annDraftsRes.state.status === "error"
                      ? asListState(annDraftsRes.state)
                      : { status: "loading" }
                  }
                  rows={[...emailDraftRows, ...announcementDraftRows]}
                  onRetry={() => {
                    void emailDraftsRes.reload();
                    void annDraftsRes.reload();
                  }}
                  emptyTitle="No drafts"
                  emptyDescription="No email or announcement drafts have been written yet."
                >
                  {emailDraftRows.map((d) => (
                    <div
                      key={`email-${d.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">{d.name}</p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">Email · {d.subject}</p>
                      </div>
                      <StatusBadge label={humanizeCode(d.status)} tone={getStatusTone(d.status)} dot />
                    </div>
                  ))}
                  {announcementDraftRows.map((d) => (
                    <div
                      key={`ann-${d.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">{d.title}</p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          Announcement · {humanizeCode(d.target_audience)}
                        </p>
                      </div>
                      <StatusBadge label={humanizeCode(d.status)} tone={getStatusTone(d.status)} dot />
                    </div>
                  ))}
                </ListState>
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 3: CUSTOMER COMMUNICATIONS
          ========================================================================= */}
      {activeDepartment === "Customer Communications" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Open Support Tickets"
              value={openTicketsCount}
              sublabel="Active tenant requests"
              icon={LifeBuoy}
              tone={toneFor(openTicketsCount)}
            />
            <KpiCard
              label="SLA At Risk / Breached"
              value="—"
              sublabel={`${NA_SUB}: tickets carry no SLA timers`}
              icon={AlertTriangle}
              tone="slate"
            />
            <KpiCard
              label="Support Access Requests"
              value={pendingAccessCount}
              sublabel="Pending break-glass approvals"
              icon={KeyRound}
              tone="teal"
            />
            <KpiCard
              label="Announcements Published"
              value={announcementsPublishedCount}
              sublabel={`Operator drafts published by a Super Admin · ${announcementsPendingCount} pending review`}
              icon={Megaphone}
              tone="blue"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Support Tickets Queue",
                count: openTicketsCount,
                href: "/platform-operator/support-tickets",
                tone: "text-amber-600 dark:text-amber-400",
                icon: LifeBuoy,
              },
              {
                label: "Break-Glass Access",
                count: pendingAccessCount,
                href: "/platform-operator/access-requests",
                tone: "text-blue-600 dark:text-blue-400",
                icon: KeyRound,
              },
              {
                label: "Customer Announcements",
                count: announcementDraftsCount,
                href: "/platform-operator/announcement-drafts",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Megaphone,
              },
              {
                label: "Email Delivery Status",
                count: emailNotAcceptedCount,
                href: "/platform-operator/email-delivery",
                tone: "text-rose-600 dark:text-rose-400",
                icon: MailWarning,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Support Ticket Queue & Access Requests */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Support Tickets ({openTickets.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Tenant inquiries categorized by SLA priority and response window.
                  </p>
                </div>
                <Link href="/platform-operator/support-tickets">
                  <OpButton variant="outline" size="xs">
                    All Tickets
                  </OpButton>
                </Link>
              </div>

              <ListState
                state={ticketsRes.state}
                rows={openTickets}
                onRetry={() => void ticketsRes.reload()}
                emptyTitle="No open tickets"
                emptyDescription="There are no open support tickets."
              >
              <div className="space-y-2.5">
                {openTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={humanizeCode(t.priority)} tone={getStatusTone(t.priority)} />
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {t.id}
                        </span>
                      </div>
                      <StatusBadge label={humanizeCode(t.status)} tone={getStatusTone(t.status)} dot />
                    </div>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {t.customer_name ?? "—"} · {t.customer_email ?? "—"} · SLA: {NOT_AVAILABLE}
                    </p>
                  </div>
                ))}
              </div>
              </ListState>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Tenant Support Access (Break-Glass)
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Temporary scoped tenant access requests awaiting Super Admin authorization.
                  </p>
                </div>
                <Link href="/platform-operator/access-requests">
                  <OpButton variant="outline" size="xs">
                    View Requests
                  </OpButton>
                </Link>
              </div>

              <ListState
                state={accessRes.state}
                rows={accessRequests}
                onRetry={() => void accessRes.reload()}
                emptyTitle="No access requests"
                emptyDescription="No tenant support access has been requested."
              >
              <div className="space-y-2.5">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {req.org_id ?? "—"}
                      </span>
                      <StatusBadge label={humanizeCode(req.status)} tone={getStatusTone(req.status)} dot />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason ?? "—"}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Scope: {NOT_AVAILABLE} · Expires: {req.expires_at ? formatDateTime(req.expires_at) : "—"}
                    </p>
                  </div>
                ))}
              </div>
              </ListState>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 4: REVENUE OPERATIONS
          ========================================================================= */}
      {activeDepartment === "Revenue Operations" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Active Subscriptions"
              value={activeSubscriptionsCount}
              sublabel={`Of ${totalSubscriptionsCount} subscription(s) on record`}
              icon={ShieldCheck}
              tone="blue"
            />
            <KpiCard
              label="Payment Failures"
              value={paymentFailuresCount}
              sublabel="Failed payments recorded (billing dormant: no retry)"
              icon={CreditCard}
              tone={toneFor(paymentFailuresCount, "rose")}
            />
            <KpiCard
              label="Bounced Invoices"
              value={invoicesFailedCount}
              sublabel={`Invoice emails that failed · ${invoicesNotSentCount} not sent`}
              icon={FileWarning}
              tone={toneFor(invoicesFailedCount)}
            />
            <KpiCard
              label="Billing Incidents"
              value={billingIncidentsCount}
              sublabel="Open Revenue Ops / Finance incidents"
              icon={AlertTriangle}
              tone="teal"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Subscription Status",
                count: totalSubscriptionsCount,
                href: "/platform-operator/subscription-status",
                tone: "text-blue-600 dark:text-blue-400",
                icon: ShieldCheck,
              },
              {
                label: "Payment Failures Queue",
                count: paymentFailuresCount,
                href: "/platform-operator/payment-failures",
                tone: toneFor(paymentFailuresCount, "rose") === "emerald" ? "text-emerald-600" : "text-rose-600 dark:text-rose-400",
                icon: CreditCard,
              },
              {
                label: "Invoice Delivery Receipts",
                count: invoicesTrackedCount,
                href: "/platform-operator/invoice-delivery",
                tone: "text-teal-600 dark:text-teal-400",
                icon: FileCheck2,
              },
              {
                label: "Billing Incidents",
                count: billingIncidentsCount,
                href: "/platform-operator/incidents",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Payment Failures Queue & Subscription Distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Payment Failures & Dunning Triage
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Declined customer charges awaiting automated or manual retry.
                  </p>
                </div>
                <Link href="/platform-operator/payment-failures">
                  <OpButton variant="outline" size="xs">
                    View Dunning
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {paymentFailureList}
                <div className="flex justify-end">
                  <NotAvailableButton variant="subtle" size="xs" reason="no payment retry endpoint">
                    Retry Charge
                  </NotAvailableButton>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Monitored Customer Subscriptions
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Active workspace plan tiers, renewals, and seat allocations.
                  </p>
                </div>
                <Link href="/platform-operator/subscription-status">
                  <OpButton variant="outline" size="xs">
                    All Plans
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {subscriptionList}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 5: FINANCE & TAX
          ========================================================================= */}
      {activeDepartment === "Finance & Tax" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Paid Subscriptions"
              value={activeSubscriptionsCount}
              sublabel="Subscriptions in ACTIVE status"
              icon={ShieldCheck}
              tone="blue"
            />
            <KpiCard
              label="Failed Gateway Charges"
              value={paymentFailuresCount}
              sublabel="Failed payments recorded (billing dormant: no retry)"
              icon={CreditCard}
              tone={toneFor(paymentFailuresCount, "rose")}
            />
            <KpiCard
              label="Invoice Delivery Exceptions"
              value={invoiceExceptionsCount}
              sublabel={`${invoicesFailedCount} failed · ${invoicesNotSentCount} not sent`}
              icon={MailWarning}
              tone={toneFor(invoiceExceptionsCount)}
            />
            <KpiCard
              label="Finance Support Tickets"
              value={financeTicketsCount}
              sublabel="Tickets routed to Finance & Tax"
              icon={LifeBuoy}
              tone="blue"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Subscription Status",
                count: totalSubscriptionsCount,
                href: "/platform-operator/subscription-status",
                tone: "text-blue-600 dark:text-blue-400",
                icon: ShieldCheck,
              },
              {
                label: "Payment Failures",
                count: paymentFailuresCount,
                href: "/platform-operator/payment-failures",
                tone: toneFor(paymentFailuresCount, "rose") === "emerald" ? "text-emerald-600" : "text-rose-600 dark:text-rose-400",
                icon: CreditCard,
              },
              {
                label: "Invoice Delivery Logs",
                count: invoicesTrackedCount,
                href: "/platform-operator/invoice-delivery",
                tone: "text-teal-600 dark:text-teal-400",
                icon: FileCheck2,
              },
              {
                label: "Financial Incidents",
                count: billingIncidentsCount,
                href: "/platform-operator/incidents",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Invoices List & Failed Charges */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Tax Invoices & PDF Delivery Status
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Monthly billing statements dispatched to tenant finance teams.
                  </p>
                </div>
                <Link href="/platform-operator/invoice-delivery">
                  <OpButton variant="outline" size="xs">
                    All Invoices
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {invoiceList}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Failed Gateway Settlements
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Card and direct debit rejections logged by the payment gateway.
                  </p>
                </div>
                <Link href="/platform-operator/payment-failures">
                  <OpButton variant="outline" size="xs">
                    Triage Queue
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {paymentFailureList}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 6: TRUST & COMPLIANCE
          ========================================================================= */}
      {activeDepartment === "Trust & Compliance" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Audit Events Today"
              value={activityTodayCount}
              sublabel="Operator activity and audit entries since local midnight"
              icon={History}
              tone="teal"
            />
            <KpiCard
              label="Security Alerts"
              value={securityAlertsCount}
              sublabel="Unacknowledged critical / Trust & Compliance alerts"
              icon={ShieldAlert}
              tone="amber"
            />
            <KpiCard
              label="Support Access Requests"
              value={pendingAccessCount}
              sublabel="Pending break-glass reviews"
              icon={KeyRound}
              tone="blue"
            />
            <KpiCard
              label="Operator MFA Compliance"
              value={mfaCompliance}
              sublabel="MFA verified operators"
              icon={ShieldCheck}
              tone="emerald"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Operational Activity Logs",
                count: totalOf(activityRes.state),
                href: "/platform-operator/activity-logs",
                tone: "text-teal-600 dark:text-teal-400",
                icon: History,
              },
              {
                label: "Break-Glass Access Reviews",
                count: pendingAccessCount,
                href: "/platform-operator/access-requests",
                tone: "text-blue-600 dark:text-blue-400",
                icon: KeyRound,
              },
              {
                label: "Security Anomaly Signals",
                count: activeAlertsCount,
                href: "/platform-operator/alerts",
                tone: "text-amber-600 dark:text-amber-400",
                icon: ShieldAlert,
              },
              {
                label: "Compliance Incidents",
                count: openIncidentsCount,
                href: "/platform-operator/incidents",
                tone: "text-rose-600 dark:text-rose-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Audit Log Stream & Operator Security Overview */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Real-Time Security & Compliance Audit Log
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Cryptographic audit trail of all administrative and operator actions.
                  </p>
                </div>
                <Link href="/platform-operator/activity-logs">
                  <OpButton variant="outline" size="xs">
                    Full Ledger
                  </OpButton>
                </Link>
              </div>

              <div className="divide-y divide-[var(--color-border)]">{activityList}</div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Break-Glass Support Access Reviews
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Audited customer workspace access authorizations and scopes.
                  </p>
                </div>
                <Link href="/platform-operator/access-requests">
                  <OpButton variant="outline" size="xs">
                    Audit Requests
                  </OpButton>
                </Link>
              </div>

              <ListState
                state={accessRes.state}
                rows={accessRequests}
                onRetry={() => void accessRes.reload()}
                emptyTitle="No access requests"
                emptyDescription="No tenant support access has been requested."
              >
              <div className="space-y-2.5">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {req.org_id ?? "—"}
                      </span>
                      <StatusBadge label={humanizeCode(req.status)} tone={getStatusTone(req.status)} dot />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason ?? "—"}</p>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Scope: {NOT_AVAILABLE}</span>
                      <span>Reviewer: {req.approved_by || "Pending Review"}</span>
                    </div>
                  </div>
                ))}
              </div>
              </ListState>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 7: PLATFORM OPERATIONS
          ========================================================================= */}
      {activeDepartment === "Platform Operations" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Workspaces Healthy"
              value={activeOrgsCount}
              sublabel={`Active organizations · ${suspendedOrgsCount} suspended · service health: ${NA_SUB}`}
              icon={Building2}
              tone="blue"
            />
            <KpiCard
              label="Open Platform Incidents"
              value={openIncidentsCount}
              sublabel="Sev-1 to Sev-4 tracked issues"
              icon={AlertTriangle}
              tone={toneFor(openIncidentsCount, "rose")}
            />
            <KpiCard
              label="Average API Response"
              value="—"
              sublabel={NA_SUB}
              icon={Server}
              tone="slate"
            />
            <KpiCard
              label="Active Maintenance & Alerts"
              value={`${activeMaintenanceCount} / ${activeAlertsCount}`}
              sublabel="Scheduled maintenance & alarms"
              icon={Wrench}
              tone="teal"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Workspace Service Health",
                count: totalOrgsCount,
                href: "/platform-operator/organization-status",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Building2,
              },
              {
                label: "System Monitoring",
                count: <NotAvailableText />,
                href: "/platform-operator/monitoring",
                tone: "text-[var(--color-text-muted)]",
                icon: Server,
              },
              {
                label: "Incident Management",
                count: openIncidentsCount,
                href: "/platform-operator/incidents",
                tone: openIncidents.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: AlertTriangle,
              },
              {
                label: "Operational Alerts",
                count: activeAlertsCount,
                href: "/platform-operator/alerts",
                tone: activeAlerts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600",
                icon: Activity,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Org Service Status & Operational Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Workspace Availability Grid
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Multi-tenant customer workspace health and latency.
                  </p>
                </div>
                <Link href="/platform-operator/organization-status">
                  <OpButton variant="outline" size="xs">
                    All Workspaces
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                <NotAvailablePanel reason="Workspace availability and latency are not measured by the server yet." />
                <ListState
                  state={asListState(orgsRes.state)}
                  rows={orgRows}
                  onRetry={() => void orgsRes.reload()}
                  emptyTitle="No organizations"
                  emptyDescription="No customer organizations exist yet."
                >
                  {orgRows.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">{o.name}</p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          {o.plan_name ?? "No plan"} · {o.member_count} member(s) · {o.project_count} project(s)
                        </p>
                      </div>
                      <StatusBadge label={humanizeCode(o.state)} tone={getStatusTone(o.state)} dot />
                    </div>
                  ))}
                </ListState>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Operational Alerts ({activeAlerts.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Alarms triggered by system metric anomaly thresholds.
                  </p>
                </div>
                <Link href="/platform-operator/alerts">
                  <OpButton variant="outline" size="xs">
                    Alert Policies
                  </OpButton>
                </Link>
              </div>

              <ListState
                state={alertsRes.state}
                rows={activeAlerts}
                onRetry={() => void alertsRes.reload()}
                emptyTitle="No active alerts"
                emptyDescription="Every operational alert has been acknowledged."
              >
              <div className="space-y-2.5">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={humanizeCode(alert.severity)} tone={getStatusTone(alert.severity)} />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Target: {alert.source_module ?? "—"} · {alert.created_at ? formatDateTime(alert.created_at) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!alert.acknowledged && (
                        <OpButton
                          variant="outline"
                          size="xs"
                          isLoading={alertMutation.busy === `ack-${alert.id}`}
                          disabled={alertMutation.busy !== null}
                          onClick={() => acknowledge(alert.id)}
                        >
                          Acknowledge
                        </OpButton>
                      )}
                      <NotAvailableButton
                        variant="subtle"
                        size="xs"
                        reason="alerts cannot be linked to incidents yet; declare it from Incidents"
                      >
                        Open Incident
                      </NotAvailableButton>
                    </div>
                  </div>
                ))}
              </div>
              </ListState>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          COMMON FOOTER: QUICK WORKFLOWS & FILTERED RECENT ACTIVITY
          ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Department-Authorized Quick Workflows */}
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Authorized {activeDepartment} Workflows
          </h3>
          <div className="space-y-2">
            {activeDepartment === "Site Reliability" && [
              {
                label: "Retry Failed Webhook Deliveries",
                desc: `${failedOutboxCount} failed event(s) awaiting retry`,
                href: "/platform-operator/failed-events",
                icon: RotateCcw,
              },
              {
                label: "Monitor Background Queue Depths",
                desc: `${countOf(jobsRes.state)} background job(s)`,
                href: "/platform-operator/sync-jobs",
                icon: Activity,
              },
              {
                label: "Verify Database Backup Snapshots",
                desc: `Latest backup: ${latestBackupLabel}`,
                href: "/platform-operator/backups",
                icon: DatabaseBackup,
              },
              {
                label: "Investigate API Error Spikes",
                desc: `${apiErrors24h} API error(s) in 24h · ${apiServerErrors24h} server`,
                href: "/platform-operator/api-errors",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Lifecycle Messaging" && [
              {
                label: "Draft System Email Template",
                desc: `${emailDraftsCount} email draft(s) · ${emailDraftsSubmittedCount} awaiting review`,
                href: "/platform-operator/email-drafts",
                icon: MailPlus,
              },
              {
                label: "Author Broadcast Announcement",
                desc: `${announcementDraftsCount} announcement draft(s) · ${announcementsPendingCount} pending review`,
                href: "/platform-operator/announcement-drafts",
                icon: Megaphone,
              },
              {
                label: "Inspect SMTP Gateway Health",
                desc: `SMTP health: ${NOT_AVAILABLE}`,
                href: "/platform-operator/email-delivery",
                icon: Radio,
              },
              {
                label: "Resend Bounced Notifications",
                desc: `${emailFailedCount} failed email(s) · resend: ${NOT_AVAILABLE}`,
                href: "/platform-operator/email-delivery",
                icon: MailWarning,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Customer Communications" && [
              {
                label: "Triage Urgent Support Tickets",
                desc: `${openTicketsCount} active ticket(s)`,
                href: "/platform-operator/support-tickets",
                icon: LifeBuoy,
              },
              {
                label: "Review Break-Glass Access Requests",
                desc: `${pendingAccessCount} pending authorization(s)`,
                href: "/platform-operator/access-requests",
                icon: KeyRound,
              },
              {
                label: "Draft Tenant Maintenance Notice",
                desc: `${announcementDraftsCount} draft notice(s) · ${announcementsPendingCount} pending review`,
                href: "/platform-operator/announcement-drafts",
                icon: Megaphone,
              },
              {
                label: "Inspect Email Delivery Status",
                desc: `${countOf(emailRes.state)} tracked deliveries`,
                href: "/platform-operator/email-delivery",
                icon: Mail,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Revenue Operations" && [
              {
                label: "Triage Payment Failures",
                desc: `${paymentFailuresCount} failed payment(s) · retry: ${NOT_AVAILABLE}`,
                href: "/platform-operator/payment-failures",
                icon: CreditCard,
              },
              {
                label: "Inspect Subscription Tiers",
                desc: `${totalSubscriptionsCount} subscription(s) · ${activeSubscriptionsCount} active`,
                href: "/platform-operator/subscription-status",
                icon: ShieldCheck,
              },
              {
                label: "Resend Bounced Invoices",
                desc: `${invoicesFailedCount} failed · ${invoicesNotSentCount} not sent`,
                href: "/platform-operator/invoice-delivery",
                icon: FileWarning,
              },
              {
                label: "Track Billing Incidents",
                desc: `${billingIncidentsCount} billing incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Finance & Tax" && [
              {
                label: "Review Payment Exceptions",
                desc: `${paymentFailuresCount} failed charge(s)`,
                href: "/platform-operator/payment-failures",
                icon: CreditCard,
              },
              {
                label: "Inspect Delivered Invoices",
                desc: `${invoicesTrackedCount} invoice(s) · ${invoiceExceptionsCount} delivery exception(s)`,
                href: "/platform-operator/invoice-delivery",
                icon: FileCheck2,
              },
              {
                label: "Audit Subscription Renewals",
                desc: `${totalSubscriptionsCount} subscription(s) · ${activeSubscriptionsCount} active`,
                href: "/platform-operator/subscription-status",
                icon: ShieldCheck,
              },
              {
                label: "View Billing Incidents",
                desc: `${billingIncidentsCount} billing incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Trust & Compliance" && [
              {
                label: "Inspect Operational Audit Logs",
                desc: `${activityTodayCount} event(s) today`,
                href: "/platform-operator/activity-logs",
                icon: History,
              },
              {
                label: "Review Break-Glass Access Records",
                desc: `${pendingAccessCount} access review(s) pending`,
                href: "/platform-operator/access-requests",
                icon: KeyRound,
              },
              {
                label: "Audit Security Anomaly Alerts",
                desc: `${activeAlertsCount} alarm signals`,
                href: "/platform-operator/alerts",
                icon: ShieldAlert,
              },
              {
                label: "Verify Infrastructure Status",
                desc: `Infrastructure metrics: ${NOT_AVAILABLE}`,
                href: "/platform-operator/monitoring",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Platform Operations" && [
              {
                label: "Review Workspace Availabilities",
                desc: `${activeOrgsCount} active workspace(s) · health: ${NOT_AVAILABLE}`,
                href: "/platform-operator/organization-status",
                icon: Building2,
              },
              {
                label: "Declare Platform Incident",
                desc: `${openIncidentsCount} active incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
              {
                label: "Schedule Maintenance Window",
                desc: `${countOf(maintenanceRes.state)} planned maintenance item(s)`,
                href: "/platform-operator/maintenance",
                icon: Wrench,
              },
              {
                label: "Triage System Monitoring",
                desc: `${activeAlertsCount} unacknowledged alert(s) · service metrics: ${NOT_AVAILABLE}`,
                href: "/platform-operator/monitoring",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Filtered Recent Operational Activity */}
        <SurfaceCard className="p-4 sm:p-5 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Recent Operational Activity ({activeDepartment})
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Authorized audit events filtered to {activeDepartment} scope.
              </p>
            </div>
            {canViewModule("audit.activity_logs") && (
              <Link href="/platform-operator/activity-logs">
                <OpButton variant="ghost" size="xs">
                  Full Log <ArrowRight className="w-3 h-3" />
                </OpButton>
              </Link>
            )}
          </div>

          <div className="divide-y divide-[var(--color-border)]">{activityList}</div>
        </SurfaceCard>
      </div>
    </div>
  );
}
