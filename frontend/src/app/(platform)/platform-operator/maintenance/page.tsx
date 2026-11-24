"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flame,
  PlayCircle,
  Plus,
  Send,
  Wrench,
  XCircle,
} from "lucide-react";
import type { OpsMaintenanceWindow } from "@/types/admin-operations";
import {
  MaintenanceChecklistStep,
  MaintenanceExecutionNote,
  MaintenanceImpactLevel,
  MaintenanceScope,
  MaintenanceServiceArea,
  MaintenanceStatus,
} from "@/types/maintenance";
import { instantToLocalInput, localInputToInstant } from "@/components/super-admin/operations/shared";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  rowsOf,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
  OpInput,
  OpModal,
  OpSelect,
  OpTextarea,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
} from "../_components/OperatorPrimitives";

const SERVICE_AREAS: MaintenanceServiceArea[] = [
  "Core Web API",
  "Database & Storage",
  "Webhook Delivery & Ingestion",
  "GitHub Repository Sync",
  "Authentication & Single Sign-On",
  "Email Relay & Notifications",
  "Billing & Payment Gateway",
  "Background Worker Queues",
  "Reporting & Telemetry",
];

const IMPACT_LEVELS: MaintenanceImpactLevel[] = [
  "No Downtime",
  "Brief Slowdown",
  "Planned Downtime",
];

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney"];

/** Why the governance / notice fields are disabled: the maintenance record on the server has no such field. */
const NA_FIELD = "the maintenance record on the server has no such field";

function getMaintStatusTone(status: MaintenanceStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "IN_PROGRESS":
      return "danger";
    case "SCHEDULED":
    case "APPROVED":
      return "info";
    case "PENDING_APPROVAL":
      return "warning";
    case "COMPLETED":
      return "success";
    default:
      return "neutral";
  }
}

function getImpactTone(level: MaintenanceImpactLevel): "success" | "warning" | "danger" {
  switch (level) {
    case "No Downtime":
      return "success";
    case "Brief Slowdown":
      return "warning";
    default:
      return "danger";
  }
}

type MaintSortField = "trackingCode" | "title" | "scheduledStart" | "durationMinutes" | "status" | "progressPct";

/**
 * One maintenance window as the page shows it, read from GET /v1/operator/maintenance. Fields the server does not
 * store (scope, tenant, impact, services, emergency flag, approval, progress, checklist, notes) are null / empty and
 * rendered as "Not available yet".
 */
interface MaintRow {
  id: string;
  version: number | null | undefined;
  trackingCode: string;
  title: string;
  reason: string;
  departmentId: string | null;
  scope: MaintenanceScope | null;
  targetOrgName?: string;
  impactLevel: MaintenanceImpactLevel | null;
  affectedServices: MaintenanceServiceArea[];
  scheduledStart: string;
  scheduledEnd: string;
  /** Derived only from the real scheduled start / end. */
  durationMinutes: number | null;
  actualStart?: string;
  actualEnd?: string;
  status: MaintenanceStatus;
  isEmergency: boolean;
  reviewedBy?: string;
  progressPct: number | null;
  serviceRestorationChecks: MaintenanceChecklistStep[];
  executionNotes: MaintenanceExecutionNote[];
  completionReport?: { summary: string; verifiedBy: string; actualDowntimeMinutes: number; completedAt: string };
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function durationBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60000) : null;
}

function toMaintRow(m: OpsMaintenanceWindow): MaintRow {
  return {
    id: m.id,
    version: m.version,
    trackingCode: m.id,
    title: m.title,
    reason: m.description ?? "",
    departmentId: m.department_id,
    scope: null,
    impactLevel: null,
    affectedServices: [],
    scheduledStart: m.scheduled_start ?? "",
    scheduledEnd: m.scheduled_end ?? "",
    durationMinutes: durationBetween(m.scheduled_start, m.scheduled_end),
    actualStart: m.actual_start ?? undefined,
    actualEnd: m.actual_end ?? undefined,
    status: (m.status as MaintenanceStatus) ?? "SCHEDULED",
    isEmergency: false,
    progressPct: null,
    serviceRestorationChecks: [],
    executionNotes: [],
    createdBy: m.created_by,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

function inHours(hours: number): string {
  return instantToLocalInput(new Date(Date.now() + hours * 3600_000).toISOString());
}

export default function OperatorMaintenancePage() {
  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  const { state: windowsState, reload } = useOperatorResource(() => operatorApi.maintenance.list(), "maintenance");
  const maintenanceWindows = useMemo(() => rowsOf(windowsState).map(toMaintRow), [windowsState]);
  const isReady = windowsState.status === "ready";
  const { busy, notice, clearNotice, run } = useOperatorMutation(reload);

  // Filter & Search State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState("ALL");
  const [sortField, setSortField] = useState<MaintSortField>("scheduledStart");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Request Maintenance Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqScope, setReqScope] = useState<MaintenanceScope>("PLATFORM_WIDE");
  const [reqImpact, setReqImpact] = useState<MaintenanceImpactLevel>("Brief Slowdown");
  const [reqServices, setReqServices] = useState<MaintenanceServiceArea[]>([
    "Core Web API",
    "Webhook Delivery & Ingestion",
  ]);
  const [reqStart, setReqStart] = useState(() => inHours(2));
  const [reqEnd, setReqEnd] = useState(() => inHours(2.5));
  const [reqTimezone, setReqTimezone] = useState("UTC");
  const [reqCustomerNotice, setReqCustomerNotice] = useState(
    "ProWise is conducting scheduled infrastructure maintenance. Services will resume shortly."
  );
  const [reqRestorationTime, setReqRestorationTime] = useState("Within 30-minute window");
  const [reqNotifyCustomers, setReqNotifyCustomers] = useState(true);
  const reqIsEmergency = false;

  // Execution Note Input (for Active Window)
  const [activeNoteText, setActiveNoteText] = useState("");

  // Start Window Confirmation Modal
  const [startConfirmTarget, setStartConfirmTarget] = useState<MaintRow | null>(null);

  // Complete Report Modal
  const [completeTarget, setCompleteTarget] = useState<MaintRow | null>(null);
  const [completionSummary, setCompletionSummary] = useState("");

  // Cancel Request Modal
  const [cancelTarget, setCancelTarget] = useState<MaintRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Inspect Details Modal
  const [inspectTarget, setInspectTarget] = useState<MaintRow | null>(null);

  // KPIs
  const activeWindows = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "IN_PROGRESS"),
    [maintenanceWindows]
  );
  const scheduledCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "SCHEDULED" || m.status === "APPROVED").length,
    [maintenanceWindows]
  );
  const completedCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "COMPLETED").length,
    [maintenanceWindows]
  );

  // Handle Sort
  const handleSort = (field: MaintSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = maintenanceWindows.filter((m) => {
      const matchesQ =
        !q ||
        m.trackingCode.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (m.departmentId ?? "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
      const matchesScope = scopeFilter === "ALL" || m.scope === scopeFilter;
      const matchesImpact = impactFilter === "ALL" || m.impactLevel === impactFilter;

      return matchesQ && matchesStatus && matchesScope && matchesImpact;
    });

    return [...list].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === "string" || typeof vb === "string") {
        const sa = String(va ?? "");
        const sb = String(vb ?? "");
        return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
      }
      const na = (va as number | null) ?? 0;
      const nb = (vb as number | null) ?? 0;
      return sortDir === "asc" ? na - nb : nb - na;
    });
  }, [maintenanceWindows, search, statusFilter, scopeFilter, impactFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  /** PATCH /v1/operator/maintenance/{id} with the version the page read (409 STALE_VERSION shows Reload). */
  const changeStatus = (win: MaintRow, status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED", success: string) =>
    run(`status:${win.id}`, () => operatorApi.maintenance.update(win.id, { status }, win.version), success);

  // Request Submission Handler: POST /v1/operator/maintenance (creates a SCHEDULED window; no version needed)
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error("Your role does not permit submitting maintenance requests.");
      return;
    }
    if (reqTitle.trim().length < 5) {
      toast.error("Please enter a descriptive maintenance title (at least 5 characters).");
      return;
    }
    if (reqReason.trim().length < 10) {
      toast.error("Please provide a technical reason and justification.");
      return;
    }
    const start = localInputToInstant(reqStart);
    const end = localInputToInstant(reqEnd);
    if (!start || !end) {
      toast.error("Please choose a scheduled start and end.");
      return;
    }
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      toast.error("The scheduled end must be after the scheduled start.");
      return;
    }

    const ok = await run(
      "create",
      () =>
        operatorApi.maintenance.create({
          title: reqTitle.trim(),
          description: reqReason.trim(),
          scheduled_start: start,
          scheduled_end: end,
        }),
      "Maintenance window scheduled."
    );
    if (ok) setRequestModalOpen(false);
  };

  // Start Window Handler: PATCH status IN_PROGRESS
  const handleConfirmStart = async () => {
    if (!startConfirmTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit starting maintenance.");
      return;
    }
    const target = startConfirmTarget;
    setStartConfirmTarget(null);
    await changeStatus(target, "IN_PROGRESS", `Maintenance window ${target.trackingCode} started.`);
  };

  // Complete Maintenance Handler: PATCH status COMPLETED
  const handleCompleteSubmit = async () => {
    if (!completeTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit completing maintenance.");
      return;
    }
    const target = completeTarget;
    setCompleteTarget(null);
    await changeStatus(target, "COMPLETED", `Maintenance window ${target.trackingCode} marked COMPLETED.`);
  };

  // Cancel Handler: PATCH status CANCELLED
  const handleCancelSubmit = async () => {
    if (!cancelTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit cancelling maintenance.");
      return;
    }
    const target = cancelTarget;
    setCancelTarget(null);
    await changeStatus(target, "CANCELLED", `Maintenance window ${target.trackingCode} cancelled.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Maintenance Operations"
        badge="System Operations"
        liveData
        description="Author and submit infrastructure maintenance requests for Super Admin approval, execute authorized windows, monitor service restoration checks, and log completion reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpButton
              variant="primary"
              size="sm"
              disabled={!canManage}
              onClick={() => {
                setReqTitle("");
                setReqReason("");
                setReqStart(inHours(2));
                setReqEnd(inHours(2.5));
                setRequestModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Request Maintenance
            </OpButton>

            <NotAvailableButton variant="danger" size="sm" reason="the server has no emergency maintenance flag or expedited approval">
              <Flame className="w-4 h-4" />
              Emergency Request
            </NotAvailableButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Multi-Tenant Maintenance Governance Workflow"
        description="Operator requests require Super Admin approval prior to activation. Active maintenance publishes live customer notices across targeted tenant workspaces while preserving full operator diagnostics access."
      />

      <MutationNotice notice={notice} onReload={reload} onDismiss={clearNotice} />

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Windows"
          value={isReady ? activeWindows.length : "-"}
          sublabel="Currently in progress"
          icon={Flame}
          tone={activeWindows.length > 0 ? "rose" : "slate"}
        />
        <KpiCard
          label="Pending Review"
          value="—"
          sublabel="Not available yet"
          icon={Clock}
          tone="slate"
        />
        <KpiCard
          label="Approved & Scheduled"
          value={isReady ? scheduledCount : "-"}
          sublabel="Authorized for execution"
          icon={Calendar}
          tone="blue"
        />
        <KpiCard
          label="Completed & Restored"
          value={isReady ? completedCount : "-"}
          sublabel="Verified operational history"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* LIVE ACTIVE EXECUTION MONITOR (Requirement 2 & 3) */}
      {activeWindows.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Live Maintenance Execution Monitor</span>
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
              {activeWindows.length} Active Window{activeWindows.length > 1 ? "s" : ""}
            </span>
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {activeWindows.map((win) => {
              return (
                <SurfaceCard
                  key={win.id}
                  className="border-l-4 border-l-rose-500 p-4 sm:p-5 space-y-4 bg-rose-500/[0.02]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {win.trackingCode}
                        </span>
                        <StatusBadge label={win.status.replace("_", " ")} tone="danger" dot />
                        <StatusBadge
                          label={win.departmentId ? humanizeCode(win.departmentId) : "Scope: Not available yet"}
                          tone="info"
                        />
                        {win.impactLevel ? (
                          <StatusBadge label={win.impactLevel} tone={getImpactTone(win.impactLevel)} />
                        ) : (
                          <StatusBadge label="Impact: Not available yet" tone="neutral" />
                        )}
                        {win.isEmergency && (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            EMERGENCY LOCK
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {win.title}
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Started: {win.actualStart ? formatDateTime(win.actualStart) : "—"} · Target Duration:{" "}
                        {win.durationMinutes ?? "—"} min
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <OpButton
                        variant="primary"
                        size="sm"
                        disabled={!canManage || busy !== null}
                        onClick={() => {
                          setCompleteTarget(win);
                          setCompletionSummary("");
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Restore Services &amp; Complete
                      </OpButton>

                      <OpButton
                        variant="outline"
                        size="sm"
                        disabled={!canManage || busy !== null}
                        onClick={() => {
                          setCancelTarget(win);
                          setCancelReason("");
                        }}
                      >
                        <XCircle className="w-4 h-4 text-rose-500" />
                        Abort Maintenance
                      </OpButton>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        Service Restoration Checklist Progress
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {win.progressPct === null ? <NotAvailableText reason={NA_FIELD} /> : `${win.progressPct}% Complete`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${win.progressPct ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Dual Grid: Left = Checklist, Right = Execution Notes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs pt-1">
                    {/* Left: Service Checklist */}
                    <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3.5 bg-[var(--color-surface)]">
                      <div className="flex items-center justify-between pb-1 border-b border-[var(--color-border)]">
                        <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                          Restoration Checklist Steps
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          Click step to toggle verified status
                        </span>
                      </div>

                      {win.serviceRestorationChecks.length === 0 ? (
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          No verification steps defined. <NotAvailableText reason="restoration checklists are not stored on the server" />
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {win.serviceRestorationChecks.map((chk) => (
                            <label
                              key={chk.id}
                              title={NOT_AVAILABLE}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-not-allowed transition-colors ${
                                chk.completed
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-text-primary)]"
                                  : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={chk.completed}
                                disabled
                                readOnly
                                className="h-4 w-4 rounded border-[var(--color-border)] text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className={`text-[11px] ${chk.completed ? "font-medium" : ""}`}>
                                {chk.label}
                              </span>
                              {chk.checkedBy && (
                                <span className="ml-auto text-[9px] text-[var(--color-text-muted)] shrink-0">
                                  ✓ {chk.checkedBy}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Real-time Notes */}
                    <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3.5 bg-[var(--color-surface)] flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 pb-1 border-b border-[var(--color-border)]">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          Live Execution Notes &amp; Activity
                        </span>

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {win.executionNotes.length === 0 && (
                            <p className="text-[11px]">
                              <NotAvailableText reason="execution notes are not stored on the server" />
                            </p>
                          )}
                          {win.executionNotes.map((nt) => (
                            <div
                              key={nt.id}
                              className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] text-[11px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)]">
                                <span className="font-semibold text-[var(--color-text-primary)]">{nt.author} ({nt.role})</span>
                                <span>{formatDateTime(nt.timestamp)}</span>
                              </div>
                              <p className="text-[var(--color-text-secondary)]">{nt.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Add Note Input */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-border)]">
                        <input
                          type="text"
                          value={activeNoteText}
                          onChange={(e) => setActiveNoteText(e.target.value)}
                          placeholder="Log diagnostic note or progress update..."
                          disabled
                          title={NOT_AVAILABLE}
                          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] disabled:opacity-50"
                        />
                        <NotAvailableButton variant="subtle" size="xs" hideLabel reason="execution notes are not stored on the server">
                          <Send className="w-3 h-3" />
                          Log
                        </NotAvailableButton>
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Maintenance Table & Filter Section */}
      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search maintenance windows, services, reasons, or organizations..."
          hasActiveFilters={Boolean(
            search || statusFilter !== "ALL" || scopeFilter !== "ALL" || impactFilter !== "ALL"
          )}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setScopeFilter("ALL");
            setImpactFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "In Progress", value: "IN_PROGRESS" },
                    { label: "Pending Approval", value: "PENDING_APPROVAL" },
                    { label: "Scheduled", value: "SCHEDULED" },
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Cancelled", value: "CANCELLED" },
                    { label: "Rejected", value: "REJECTED" },
                  ]}
                />
              </div>

              <div className="w-36" title={`${NOT_AVAILABLE}: ${NA_FIELD}`}>
                <OpSelect
                  value={scopeFilter}
                  disabled
                  aria-label="Filter scope (not available yet)"
                  onChange={(e) => {
                    setScopeFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Scopes", value: "ALL" },
                    { label: "Platform-Wide", value: "PLATFORM_WIDE" },
                    { label: "Org-Specific", value: "ORGANIZATION_SPECIFIC" },
                  ]}
                />
              </div>

              <div className="w-36" title={`${NOT_AVAILABLE}: ${NA_FIELD}`}>
                <OpSelect
                  value={impactFilter}
                  disabled
                  aria-label="Filter impact (not available yet)"
                  onChange={(e) => {
                    setImpactFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Impacts", value: "ALL" },
                    { label: "No Downtime", value: "No Downtime" },
                    { label: "Brief Slowdown", value: "Brief Slowdown" },
                    { label: "Planned Downtime", value: "Planned Downtime" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {!isReady || maintenanceWindows.length === 0 ? (
          <OperatorResourceStatus
            state={windowsState}
            isEmpty={(d) => d.length === 0}
            onRetry={reload}
            emptyIcon={Wrench}
            emptyTitle="No maintenance records found"
            emptyDescription="The server has no maintenance windows yet. Use Request Maintenance to schedule one."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No maintenance records found"
            description="No maintenance requests or operations match your current search and filter settings."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    <SortableHeader
                      label="Tracking #"
                      active={sortField === "trackingCode"}
                      direction={sortDir}
                      onSort={() => handleSort("trackingCode")}
                    />
                  </th>
                  <th className="py-3 px-3.5 min-w-[200px]">Title &amp; Reason</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Scope</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Affected Services</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Impact</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    <SortableHeader
                      label="Scheduled Window"
                      active={sortField === "scheduledStart"}
                      direction={sortDir}
                      onSort={() => handleSort("scheduledStart")}
                    />
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">
                    <SortableHeader
                      label="Status"
                      active={sortField === "status"}
                      direction={sortDir}
                      onSort={() => handleSort("status")}
                    />
                  </th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((win) => {
                  const isApproved = win.status === "SCHEDULED" || win.status === "APPROVED";
                  const isPending = win.status === "PENDING_APPROVAL";
                  const rowBusy = busy === `status:${win.id}`;

                  return (
                    <tr key={win.id} className="hover:bg-[var(--color-hover)] transition-colors">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {win.trackingCode}
                          </span>
                          {win.isEmergency && (
                            <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-600 dark:text-rose-300">
                              EMERGENCY
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 min-w-[200px]">
                        <p className="font-semibold text-[var(--color-text-primary)] line-clamp-1">
                          {win.title}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
                          {win.reason || "—"}
                        </p>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {win.scope === "PLATFORM_WIDE" ? (
                          <StatusBadge label="Platform-Wide" tone="neutral" />
                        ) : win.scope === "ORGANIZATION_SPECIFIC" ? (
                          <StatusBadge label={win.targetOrgName || "Tenant Specific"} tone="info" />
                        ) : (
                          <NotAvailableText reason={NA_FIELD} />
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                          {win.affectedServices.length === 0 && <NotAvailableText reason={NA_FIELD} />}
                          {win.affectedServices.slice(0, 2).map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-[var(--color-elevated)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] truncate"
                            >
                              {s}
                            </span>
                          ))}
                          {win.affectedServices.length > 2 && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              +{win.affectedServices.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {win.impactLevel ? (
                          <StatusBadge label={win.impactLevel} tone={getImpactTone(win.impactLevel)} />
                        ) : (
                          <NotAvailableText reason={NA_FIELD} />
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {formatDateTime(win.scheduledStart)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          Duration: {win.durationMinutes ?? "—"} min (your local time)
                        </p>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge
                          label={win.status.replace("_", " ")}
                          tone={getMaintStatusTone(win.status)}
                          dot
                        />
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <OpButton
                            variant="outline"
                            size="xs"
                            onClick={() => setInspectTarget(win)}
                            title="Inspect full details, checklist and audit history"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </OpButton>

                          {/* If Approved, show Start Button */}
                          {isApproved && (
                            <OpButton
                              variant="primary"
                              size="xs"
                              disabled={!canManage || busy !== null}
                              isLoading={rowBusy}
                              onClick={() => setStartConfirmTarget(win)}
                              title="Start this approved maintenance window"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              Start
                            </OpButton>
                          )}

                          {/* If In Progress, show Complete Button */}
                          {win.status === "IN_PROGRESS" && (
                            <OpButton
                              variant="subtle"
                              size="xs"
                              disabled={!canManage || busy !== null}
                              isLoading={rowBusy}
                              onClick={() => {
                                setCompleteTarget(win);
                                setCompletionSummary("");
                              }}
                              title="Restore services and complete window"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Complete
                            </OpButton>
                          )}

                          {/* Pending or scheduled windows can be cancelled (PATCH status CANCELLED) */}
                          {(isPending || isApproved) && (
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage || busy !== null}
                              onClick={() => {
                                setCancelTarget(win);
                                setCancelReason("");
                              }}
                              title="Cancel this maintenance window"
                            >
                              Cancel
                            </OpButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* =========================================================================
       * MODALS
       * ========================================================================= */}

      {/* REQUEST MAINTENANCE MODAL */}
      <OpModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title={reqIsEmergency ? "🚨 Emergency Maintenance Request" : "Request Maintenance Window"}
        description={
          reqIsEmergency
            ? "Submit an urgent emergency maintenance request to Super Admin for expedited authorization."
            : "Plan an infrastructure maintenance window and submit for Super Admin approval before activation."
        }
        maxWidth="lg"
      >
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          {reqIsEmergency && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200">
              <strong>Emergency Notice:</strong> This request will be flagged with high priority on Super Admin dashboards.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" title={`${NOT_AVAILABLE}: ${NA_FIELD}`}>
            <OpSelect
              label="Maintenance Scope"
              value={reqScope}
              disabled
              title={NOT_AVAILABLE}
              onChange={(e) => setReqScope(e.target.value as MaintenanceScope)}
              options={[
                { label: "Platform-Wide (All Workspaces)", value: "PLATFORM_WIDE" },
                { label: "Organization-Specific (Tenant Workspace)", value: "ORGANIZATION_SPECIFIC" },
              ]}
            />

            {reqScope === "ORGANIZATION_SPECIFIC" ? (
              <OpSelect
                label="Target Tenant Organization"
                value=""
                disabled
                options={[{ label: NOT_AVAILABLE, value: "" }]}
              />
            ) : (
              <OpSelect
                label="Impact Level"
                value={reqImpact}
                disabled
                onChange={(e) => setReqImpact(e.target.value as MaintenanceImpactLevel)}
                options={IMPACT_LEVELS.map((lvl) => ({ label: lvl, value: lvl }))}
              />
            )}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">
            Scope and impact level: {NOT_AVAILABLE}
          </p>

          <OpInput
            label="Maintenance Title"
            value={reqTitle}
            onChange={(e) => setReqTitle(e.target.value)}
            placeholder="e.g. EU Webhook Ingress Redis Pod Migration"
          />

          <OpTextarea
            label="Technical Reason & Scope of Work"
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            placeholder="Explain why maintenance is required, affected components, and rollback strategy..."
            rows={2}
          />

          {/* Affected Services Selection */}
          <div className="space-y-1.5" title={`${NOT_AVAILABLE}: ${NA_FIELD}`}>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block">
              Affected Service Areas <span className="font-normal text-[10px] text-[var(--color-text-muted)]">({NOT_AVAILABLE})</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SERVICE_AREAS.map((svc) => {
                const isChecked = reqServices.includes(svc);
                return (
                  <label
                    key={svc}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-not-allowed opacity-60 transition-colors ${
                      isChecked
                        ? "border-blue-500 bg-blue-500/10 text-[var(--color-text-primary)] font-medium"
                        : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled
                      onChange={() => {
                        if (isChecked) {
                          setReqServices(reqServices.filter((s) => s !== svc));
                        } else {
                          setReqServices([...reqServices, svc]);
                        }
                      }}
                      className="rounded border-[var(--color-border)]"
                    />
                    <span className="truncate">{svc}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <OpInput
              label="Scheduled Start"
              type="datetime-local"
              value={reqStart}
              onChange={(e) => setReqStart(e.target.value)}
              helperText="Your local time"
            />
            <OpInput
              label="Scheduled End"
              type="datetime-local"
              value={reqEnd}
              onChange={(e) => setReqEnd(e.target.value)}
              helperText="Your local time"
            />
            <div title={`${NOT_AVAILABLE}: times are entered in your local time and stored in UTC`}>
              <OpSelect
                label="Timezone"
                value={reqTimezone}
                disabled
                title={NOT_AVAILABLE}
                onChange={(e) => setReqTimezone(e.target.value)}
                options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
              />
              <p className="text-[11px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</p>
            </div>
          </div>

          <div title={`${NOT_AVAILABLE}: customer notice banners are not published by the server`}>
            <OpTextarea
              label="Customer Notice Banner Message"
              value={reqCustomerNotice}
              disabled
              helperText={NOT_AVAILABLE}
              onChange={(e) => setReqCustomerNotice(e.target.value)}
              rows={2}
            />
          </div>

          <div title={`${NOT_AVAILABLE}: ${NA_FIELD}`}>
            <OpInput
              label="Estimated Restoration Time"
              value={reqRestorationTime}
              disabled
              helperText={NOT_AVAILABLE}
              onChange={(e) => setReqRestorationTime(e.target.value)}
              placeholder="e.g. 03:30 UTC"
            />
          </div>

          <p className="text-[11px] text-[var(--color-text-muted)]">
            The server schedules the window right away (status Scheduled). Super Admin approval of maintenance requests is{" "}
            {NOT_AVAILABLE.toLowerCase()}.
          </p>

          <div className="flex items-center justify-between pt-2">
            <label
              className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-not-allowed"
              title={`${NOT_AVAILABLE}: customer notice banners are not published by the server`}
            >
              <input
                type="checkbox"
                checked={reqNotifyCustomers}
                disabled
                onChange={(e) => setReqNotifyCustomers(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span>Publish notice banner to customer workspaces during window ({NOT_AVAILABLE})</span>
            </label>

            <div className="flex items-center gap-2">
              <OpButton type="button" variant="outline" size="sm" onClick={() => setRequestModalOpen(false)}>
                Cancel
              </OpButton>
              <OpButton
                type="submit"
                variant={reqIsEmergency ? "danger" : "primary"}
                size="sm"
                disabled={!canManage || busy !== null}
                isLoading={busy === "create"}
              >
                Submit for Super Admin Approval
              </OpButton>
            </div>
          </div>
        </form>
      </OpModal>

      {/* START CONFIRMATION MODAL (Approval Enforcement) */}
      <ConfirmModal
        isOpen={Boolean(startConfirmTarget)}
        onClose={() => setStartConfirmTarget(null)}
        title={`Commence Maintenance: ${startConfirmTarget?.trackingCode}`}
        description={
          startConfirmTarget?.reviewedBy
            ? `This window was authorized by ${startConfirmTarget.reviewedBy}. Starting will transition status to IN_PROGRESS and broadcast live customer notices.`
            : "Starting this window will transition status to IN_PROGRESS. Please ensure all team operators are on standby."
        }
        confirmLabel="Start Maintenance Now"
        variant="primary"
        onConfirm={() => void handleConfirmStart()}
      />

      {/* COMPLETION REPORT MODAL */}
      <OpModal
        isOpen={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title={`Complete Maintenance: ${completeTarget?.trackingCode}`}
        description="Verify service restoration and submit completion report to close out this window."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs bg-[var(--color-app-bg)] space-y-1">
            <p className="font-semibold text-[var(--color-text-primary)]">{completeTarget?.title}</p>
            <p className="text-[var(--color-text-secondary)]">
              Affected:{" "}
              {completeTarget && completeTarget.affectedServices.length > 0 ? (
                completeTarget.affectedServices.join(", ")
              ) : (
                <NotAvailableText reason={NA_FIELD} />
              )}
            </p>
          </div>

          <div title={`${NOT_AVAILABLE}: completion reports are not stored on the server`}>
            <OpTextarea
              label="Completion Report & Verification Summary"
              value={completionSummary}
              disabled
              helperText={`${NOT_AVAILABLE}. Submitting marks the window Completed.`}
              onChange={(e) => setCompletionSummary(e.target.value)}
              placeholder="Summarize verification outcome, health check results, and confirmation of normal traffic routing..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <OpButton variant="outline" size="sm" onClick={() => setCompleteTarget(null)}>
              Cancel
            </OpButton>
            <OpButton variant="primary" size="sm" disabled={busy !== null} onClick={() => void handleCompleteSubmit()}>
              Submit Completion Report
            </OpButton>
          </div>
        </div>
      </OpModal>

      {/* CANCEL MODAL */}
      <OpModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel Maintenance: ${cancelTarget?.trackingCode}`}
        description="Provide a cancellation reason to update the governance audit trail."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div title={`${NOT_AVAILABLE}: cancellation reasons are not stored on the server`}>
            <OpTextarea
              label="Cancellation Reason"
              value={cancelReason}
              disabled
              helperText={`${NOT_AVAILABLE}. Confirming marks the window Cancelled.`}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this window being cancelled?..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <OpButton variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Back
            </OpButton>
            <OpButton variant="danger" size="sm" disabled={busy !== null} onClick={() => void handleCancelSubmit()}>
              Confirm Cancellation
            </OpButton>
          </div>
        </div>
      </OpModal>

      {/* INSPECT DETAILS MODAL */}
      <OpModal
        isOpen={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        title={inspectTarget ? `${inspectTarget.trackingCode} — Maintenance Details` : "Details"}
        description={inspectTarget?.title || ""}
        maxWidth="lg"
      >
        {inspectTarget && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Status</span>
                <p className="font-semibold text-[var(--color-text-primary)]">{inspectTarget.status.replace("_", " ")}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {inspectTarget.reviewedBy ? `Approved by ${inspectTarget.reviewedBy}` : `Approval: ${NOT_AVAILABLE}`}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Scope &amp; Impact</span>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {inspectTarget.departmentId ? humanizeCode(inspectTarget.departmentId) : <NotAvailableText reason={NA_FIELD} />}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {inspectTarget.impactLevel ?? `Impact: ${NOT_AVAILABLE}`}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
              <span className="font-semibold text-[var(--color-text-primary)]">Reason:</span>
              <p className="text-[var(--color-text-secondary)]">{inspectTarget.reason || "—"}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Window: {formatDateTime(inspectTarget.scheduledStart)} – {formatDateTime(inspectTarget.scheduledEnd)}
                {inspectTarget.actualStart ? ` · Started ${formatDateTime(inspectTarget.actualStart)}` : ""}
                {inspectTarget.actualEnd ? ` · Ended ${formatDateTime(inspectTarget.actualEnd)}` : ""}
                {inspectTarget.createdBy ? ` · Created by ${inspectTarget.createdBy}` : ""}
              </p>
            </div>

            {/* Checklist */}
            {inspectTarget.serviceRestorationChecks.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold text-[var(--color-text-primary)]">Service Restoration Checks:</span>
                <div className="space-y-1">
                  {inspectTarget.serviceRestorationChecks.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${c.completed ? "text-emerald-500" : "text-slate-400"}`} />
                      <span className={c.completed ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}>
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completion Report if completed (the server stores none yet, so this only shows once it does) */}
            {inspectTarget.completionReport && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1 text-emerald-950 dark:text-emerald-100">
                <div className="flex items-center justify-between font-bold">
                  <span>Completion Report</span>
                  <span className="text-[10px]">{formatDateTime(inspectTarget.completionReport.completedAt)}</span>
                </div>
                <p>{inspectTarget.completionReport.summary}</p>
                <p className="text-[10px] opacity-80">Verified by: {inspectTarget.completionReport.verifiedBy} · Actual Downtime: {inspectTarget.completionReport.actualDowntimeMinutes}m</p>
              </div>
            )}

            {/* Audit History */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
              <span className="font-semibold text-[var(--color-text-primary)]">Audit Logs:</span>
              <div className="relative pl-4 space-y-2 border-l border-[var(--color-border)] ml-1 max-h-40 overflow-y-auto">
                <NotAvailableText reason="per-window audit history is not exposed by the server" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <OpButton variant="outline" size="sm" onClick={() => setInspectTarget(null)}>
                Close
              </OpButton>
            </div>
          </div>
        )}
      </OpModal>
    </div>
  );
}
