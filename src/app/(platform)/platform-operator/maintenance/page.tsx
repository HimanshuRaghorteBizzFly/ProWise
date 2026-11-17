"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Flame,
  History,
  LayoutGrid,
  List,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { useSuperAdminStore } from "../../super-admin/_store/useSuperAdminStore";
import { useMaintenanceStore } from "@/store/maintenance-store";
import {
  MaintenanceChecklistStep,
  MaintenanceImpactLevel,
  MaintenanceScope,
  MaintenanceServiceArea,
  MaintenanceStatus,
  MaintenanceWindowItem,
} from "@/types/maintenance";
import { formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
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
  getStatusTone,
  useTableSelection,
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

const DEFAULT_ORGS = [
  { id: "org-acme", name: "Acme Health Technologies" },
  { id: "org-cloudpulse", name: "CloudPulse Commerce" },
  { id: "org-nova", name: "Nova FinTech Global" },
  { id: "org-vanguard", name: "Vanguard MedSystems" },
  { id: "org-starlight", name: "Starlight Dynamics" },
  { id: "org-apex", name: "Apex BioTech Systems" },
  { id: "org-aether", name: "Aether Robotics AI" },
  { id: "org-meridian", name: "Meridian Logistics Cloud" },
  { id: "org-kinetix", name: "Kinetix BioLabs" },
];

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

export default function OperatorMaintenancePage() {
  const accountSettings = usePlatformOperatorStore((s) => s.accountSettings);
  const operatorName = accountSettings.name || "Alex Rivera";

  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  // Shared Maintenance Store
  const maintenanceWindows = useMaintenanceStore((s) => s.maintenanceWindows);
  const platformWideMaintenanceActive = useMaintenanceStore((s) => s.platformWideMaintenanceActive);
  const requestMaintenance = useMaintenanceStore((s) => s.requestMaintenance);
  const startMaintenance = useMaintenanceStore((s) => s.startMaintenance);
  const toggleServiceCheck = useMaintenanceStore((s) => s.toggleServiceCheck);
  const addExecutionNote = useMaintenanceStore((s) => s.addExecutionNote);
  const completeMaintenance = useMaintenanceStore((s) => s.completeMaintenance);
  const cancelMaintenance = useMaintenanceStore((s) => s.cancelMaintenance);
  const emergencyStop = useMaintenanceStore((s) => s.emergencyStop);

  // Tenant Organizations list
  const organizations = useMemo(() => {
    try {
      const saOrgs = useSuperAdminStore.getState().organizations;
      if (saOrgs && saOrgs.length > 0) return saOrgs;
    } catch {}
    return DEFAULT_ORGS;
  }, []);

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
  const [reqOrgId, setReqOrgId] = useState(organizations[0]?.id || "org-acme");
  const [reqImpact, setReqImpact] = useState<MaintenanceImpactLevel>("Brief Slowdown");
  const [reqServices, setReqServices] = useState<MaintenanceServiceArea[]>([
    "Core Web API",
    "Webhook Delivery & Ingestion",
  ]);
  const [reqStart, setReqStart] = useState("2026-11-15T03:00");
  const [reqEnd, setReqEnd] = useState("2026-11-15T03:30");
  const [reqTimezone, setReqTimezone] = useState("UTC");
  const [reqCustomerNotice, setReqCustomerNotice] = useState(
    "ProWise is conducting scheduled infrastructure maintenance. Services will resume shortly."
  );
  const [reqRestorationTime, setReqRestorationTime] = useState("Within 30-minute window");
  const [reqNotifyCustomers, setReqNotifyCustomers] = useState(true);
  const [reqIsEmergency, setReqIsEmergency] = useState(false);

  // Execution Note Input (for Active Window)
  const [activeNoteText, setActiveNoteText] = useState("");

  // Start Window Confirmation Modal
  const [startConfirmTarget, setStartConfirmTarget] = useState<MaintenanceWindowItem | null>(null);

  // Complete Report Modal
  const [completeTarget, setCompleteTarget] = useState<MaintenanceWindowItem | null>(null);
  const [completionSummary, setCompletionSummary] = useState("");

  // Cancel Request Modal
  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindowItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Inspect Details Modal
  const [inspectTarget, setInspectTarget] = useState<MaintenanceWindowItem | null>(null);

  // KPIs
  const activeWindows = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "IN_PROGRESS"),
    [maintenanceWindows]
  );
  const pendingCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "PENDING_APPROVAL").length,
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
        (m.targetOrgName && m.targetOrgName.toLowerCase().includes(q)) ||
        m.affectedServices.some((s) => s.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
      const matchesScope = scopeFilter === "ALL" || m.scope === scopeFilter;
      const matchesImpact = impactFilter === "ALL" || m.impactLevel === impactFilter;

      return matchesQ && matchesStatus && matchesScope && matchesImpact;
    });

    return [...list].sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va ?? 0) - (vb ?? 0) : (vb ?? 0) - (va ?? 0);
    });
  }, [maintenanceWindows, search, statusFilter, scopeFilter, impactFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Request Submission Handler
  const handleRequestSubmit = (e: React.FormEvent) => {
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
    if (reqServices.length === 0) {
      toast.error("Please choose at least one affected service area.");
      return;
    }

    const targetOrg = organizations.find((o) => o.id === reqOrgId);

    const created = requestMaintenance({
      title: reqTitle.trim(),
      reason: reqReason.trim(),
      scope: reqScope,
      targetOrgId: reqScope === "ORGANIZATION_SPECIFIC" ? reqOrgId : undefined,
      targetOrgName: reqScope === "ORGANIZATION_SPECIFIC" ? (targetOrg?.name || reqOrgId) : undefined,
      impactLevel: reqImpact,
      affectedServices: reqServices,
      scheduledStart: new Date(reqStart).toISOString(),
      scheduledEnd: new Date(reqEnd).toISOString(),
      timezone: reqTimezone,
      customerNoticeMessage: reqCustomerNotice.trim(),
      estimatedRestorationTime: reqRestorationTime.trim(),
      notifyCustomers: reqNotifyCustomers,
      isEmergency: reqIsEmergency,
      requestedBy: operatorName,
      requestedByEmail: accountSettings.email,
    });

    toast.success(
      reqIsEmergency
        ? `EMERGENCY maintenance request ${created.trackingCode} submitted for expedited Super Admin sign-off!`
        : `Maintenance request ${created.trackingCode} submitted for Super Admin review.`
    );

    setRequestModalOpen(false);
  };

  // Start Window Handler (Requires Super Admin Approval Check)
  const handleConfirmStart = () => {
    if (!startConfirmTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit starting maintenance.");
      return;
    }
    const res = startMaintenance(startConfirmTarget.id, operatorName);
    if (res.ok) {
      toast.warning(`Maintenance window ${startConfirmTarget.trackingCode} started! Status is now IN_PROGRESS.`);
      setStartConfirmTarget(null);
    } else {
      toast.error(res.error || "Cannot start maintenance.");
    }
  };

  // Complete Maintenance Handler
  const handleCompleteSubmit = () => {
    if (!completeTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit completing maintenance.");
      return;
    }
    if (!completionSummary.trim()) {
      toast.error("Please provide a summary of service restoration checks.");
      return;
    }
    const res = completeMaintenance(completeTarget.id, {
      summary: completionSummary.trim(),
      verifiedBy: operatorName,
    });
    if (res.ok) {
      toast.success(`Maintenance window ${completeTarget.trackingCode} marked COMPLETED. Normal routing restored.`);
      setCompleteTarget(null);
    } else {
      toast.error(res.error || "Completion failed.");
    }
  };

  // Cancel Handler
  const handleCancelSubmit = () => {
    if (!cancelTarget) return;
    if (!canManage) {
      toast.error("Your role does not permit cancelling maintenance.");
      return;
    }
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancelling this window.");
      return;
    }
    const res = cancelMaintenance(cancelTarget.id, operatorName, cancelReason.trim());
    if (res.ok) {
      toast.info(`Maintenance window ${cancelTarget.trackingCode} cancelled.`);
      setCancelTarget(null);
    } else {
      toast.error(res.error || "Cancellation failed.");
    }
  };

  // Add Note to Active Window
  const handleAddActiveNote = (windowId: string) => {
    if (!activeNoteText.trim()) return;
    addExecutionNote(windowId, activeNoteText.trim(), operatorName, "Platform Operator");
    toast.success("Execution note recorded.");
    setActiveNoteText("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Maintenance Operations"
        badge="System Operations"
        description="Author and submit infrastructure maintenance requests for Super Admin approval, execute authorized windows, monitor service restoration checks, and log completion reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpButton
              variant="primary"
              size="sm"
              disabled={!canManage}
              onClick={() => {
                setReqIsEmergency(false);
                setReqTitle("");
                setReqReason("");
                setRequestModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Request Maintenance
            </OpButton>

            <OpButton
              variant="danger"
              size="sm"
              disabled={!canManage}
              onClick={() => {
                setReqIsEmergency(true);
                setReqTitle("EMERGENCY: Hotfix Service Patch");
                setReqReason("Urgent production hotfix required to mitigate active tenant service disruption.");
                setRequestModalOpen(true);
              }}
            >
              <Flame className="w-4 h-4" />
              Emergency Request
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Multi-Tenant Maintenance Governance Workflow"
        description="Operator requests require Super Admin approval prior to activation. Active maintenance publishes live customer notices across targeted tenant workspaces while preserving full operator diagnostics access."
      />

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Windows"
          value={activeWindows.length}
          sublabel="Currently in progress"
          icon={Flame}
          tone={activeWindows.length > 0 ? "rose" : "slate"}
        />
        <KpiCard
          label="Pending Review"
          value={pendingCount}
          sublabel="Awaiting Super Admin approval"
          icon={Clock}
          tone={pendingCount > 0 ? "amber" : "slate"}
        />
        <KpiCard
          label="Approved & Scheduled"
          value={scheduledCount}
          sublabel="Authorized for execution"
          icon={Calendar}
          tone="blue"
        />
        <KpiCard
          label="Completed & Restored"
          value={completedCount}
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
              const isPlatform = win.scope === "PLATFORM_WIDE";

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
                          label={isPlatform ? "Platform-Wide" : `Tenant: ${win.targetOrgName}`}
                          tone="info"
                        />
                        <StatusBadge label={win.impactLevel} tone={getImpactTone(win.impactLevel)} />
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
                        Started: {win.actualStart ? formatDateTime(win.actualStart) : "Just now"} · Target Duration: {win.durationMinutes} min
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <OpButton
                        variant="primary"
                        size="sm"
                        disabled={!canManage}
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
                        disabled={!canManage}
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
                        {win.progressPct}% Complete
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${win.progressPct}%` }}
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
                        <p className="text-[11px] text-[var(--color-text-muted)]">No verification steps defined.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {win.serviceRestorationChecks.map((chk) => (
                            <label
                              key={chk.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                chk.completed
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-text-primary)]"
                                  : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={chk.completed}
                                disabled={!canManage}
                                onChange={() => toggleServiceCheck(win.id, chk.id, operatorName)}
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
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddActiveNote(win.id);
                            }
                          }}
                          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]"
                        />
                        <OpButton
                          variant="subtle"
                          size="xs"
                          onClick={() => handleAddActiveNote(win.id)}
                        >
                          <Send className="w-3 h-3" />
                          Log
                        </OpButton>
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

              <div className="w-36">
                <OpSelect
                  value={scopeFilter}
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

              <div className="w-36">
                <OpSelect
                  value={impactFilter}
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

        {paginated.length === 0 ? (
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
                  const isPlatform = win.scope === "PLATFORM_WIDE";
                  const isApproved = win.status === "SCHEDULED" || win.status === "APPROVED";
                  const isPending = win.status === "PENDING_APPROVAL";

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
                          {win.reason}
                        </p>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isPlatform ? (
                          <StatusBadge label="Platform-Wide" tone="neutral" />
                        ) : (
                          <StatusBadge label={win.targetOrgName || "Tenant Specific"} tone="info" />
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
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
                        <StatusBadge label={win.impactLevel} tone={getImpactTone(win.impactLevel)} />
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {formatDateTime(win.scheduledStart)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          Duration: {win.durationMinutes} min ({win.timezone})
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
                              disabled={!canManage}
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
                              disabled={!canManage}
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

                          {/* If Pending Approval, show badge or allow cancelling */}
                          {isPending && (
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => {
                                setCancelTarget(win);
                                setCancelReason("");
                              }}
                              title="Cancel pending request"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Maintenance Scope"
              value={reqScope}
              onChange={(e) => setReqScope(e.target.value as MaintenanceScope)}
              options={[
                { label: "Platform-Wide (All Workspaces)", value: "PLATFORM_WIDE" },
                { label: "Organization-Specific (Tenant Workspace)", value: "ORGANIZATION_SPECIFIC" },
              ]}
            />

            {reqScope === "ORGANIZATION_SPECIFIC" ? (
              <OpSelect
                label="Target Tenant Organization"
                value={reqOrgId}
                onChange={(e) => setReqOrgId(e.target.value)}
                options={organizations.map((o) => ({ label: o.name, value: o.id }))}
              />
            ) : (
              <OpSelect
                label="Impact Level"
                value={reqImpact}
                onChange={(e) => setReqImpact(e.target.value as MaintenanceImpactLevel)}
                options={IMPACT_LEVELS.map((lvl) => ({ label: lvl, value: lvl }))}
              />
            )}
          </div>

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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block">
              Affected Service Areas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SERVICE_AREAS.map((svc) => {
                const isChecked = reqServices.includes(svc);
                return (
                  <label
                    key={svc}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "border-blue-500 bg-blue-500/10 text-[var(--color-text-primary)] font-medium"
                        : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
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
            />
            <OpInput
              label="Scheduled End"
              type="datetime-local"
              value={reqEnd}
              onChange={(e) => setReqEnd(e.target.value)}
            />
            <OpSelect
              label="Timezone"
              value={reqTimezone}
              onChange={(e) => setReqTimezone(e.target.value)}
              options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
            />
          </div>

          <OpTextarea
            label="Customer Notice Banner Message"
            value={reqCustomerNotice}
            onChange={(e) => setReqCustomerNotice(e.target.value)}
            rows={2}
          />

          <OpInput
            label="Estimated Restoration Time"
            value={reqRestorationTime}
            onChange={(e) => setReqRestorationTime(e.target.value)}
            placeholder="e.g. 03:30 UTC"
          />

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={reqNotifyCustomers}
                onChange={(e) => setReqNotifyCustomers(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span>Publish notice banner to customer workspaces during window</span>
            </label>

            <div className="flex items-center gap-2">
              <OpButton type="button" variant="outline" size="sm" onClick={() => setRequestModalOpen(false)}>
                Cancel
              </OpButton>
              <OpButton type="submit" variant={reqIsEmergency ? "danger" : "primary"} size="sm">
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
        onConfirm={handleConfirmStart}
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
            <p className="text-[var(--color-text-secondary)]">Affected: {completeTarget?.affectedServices.join(", ")}</p>
          </div>

          <OpTextarea
            label="Completion Report & Verification Summary"
            value={completionSummary}
            onChange={(e) => setCompletionSummary(e.target.value)}
            placeholder="Summarize verification outcome, health check results, and confirmation of normal traffic routing..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <OpButton variant="outline" size="sm" onClick={() => setCompleteTarget(null)}>
              Cancel
            </OpButton>
            <OpButton variant="primary" size="sm" onClick={handleCompleteSubmit}>
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
          <OpTextarea
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this window being cancelled?..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <OpButton variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Back
            </OpButton>
            <OpButton variant="danger" size="sm" onClick={handleCancelSubmit}>
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
                  {inspectTarget.reviewedBy ? `Approved by ${inspectTarget.reviewedBy}` : "Pending Review"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Scope &amp; Impact</span>
                <p className="font-semibold text-[var(--color-text-primary)]">{inspectTarget.scope === "PLATFORM_WIDE" ? "Platform-Wide" : inspectTarget.targetOrgName}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{inspectTarget.impactLevel}</p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
              <span className="font-semibold text-[var(--color-text-primary)]">Reason:</span>
              <p className="text-[var(--color-text-secondary)]">{inspectTarget.reason}</p>
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

            {/* Completion Report if completed */}
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
                {inspectTarget.auditLogs.map((log) => (
                  <div key={log.id} className="space-y-0.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--color-text-primary)]">{log.action}</span>
                      <span className="text-[9px] text-[var(--color-text-muted)]">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">By {log.actor}</p>
                    {log.details && <p className="text-[10px] text-[var(--color-text-muted)] italic">&quot;{log.details}&quot;</p>}
                  </div>
                ))}
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
