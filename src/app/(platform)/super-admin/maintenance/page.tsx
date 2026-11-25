"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Flame,
  Globe,
  History,
  Layers,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  ToggleLeft,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { useMaintenanceStore } from "@/store/maintenance-store";
import {
  MaintenanceImpactLevel,
  MaintenanceScope,
  MaintenanceServiceArea,
  MaintenanceStatus,
  MaintenanceWindowItem,
} from "@/types/maintenance";
import { exportRowsToCsv, formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

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

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function getMaintStatusTone(
  status: MaintenanceStatus
): "success" | "warning" | "danger" | "info" | "neutral" {
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

function getImpactTone(
  level: MaintenanceImpactLevel
): "success" | "warning" | "danger" {
  switch (level) {
    case "No Downtime":
      return "success";
    case "Brief Slowdown":
      return "warning";
    default:
      return "danger";
  }
}

export default function SuperAdminMaintenancePage() {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const accountProfile = useSuperAdminStore((s) => s.accountProfile);
  const logActivity = useSuperAdminStore((s) => s.logActivity);

  // Maintenance Store
  const maintenanceWindows = useMaintenanceStore((s) => s.maintenanceWindows);
  const platformWideMaintenanceActive = useMaintenanceStore(
    (s) => s.platformWideMaintenanceActive
  );
  const activeOrgMaintenanceIds = useMaintenanceStore(
    (s) => s.activeOrgMaintenanceIds
  );
  const approveMaintenance = useMaintenanceStore((s) => s.approveMaintenance);
  const rejectMaintenance = useMaintenanceStore((s) => s.rejectMaintenance);
  const cancelMaintenance = useMaintenanceStore((s) => s.cancelMaintenance);
  const emergencyOverrideActivate = useMaintenanceStore(
    (s) => s.emergencyOverrideActivate
  );
  const emergencyStop = useMaintenanceStore((s) => s.emergencyStop);
  const updateCustomerNotice = useMaintenanceStore((s) => s.updateCustomerNotice);
  const togglePlatformWideMaintenance = useMaintenanceStore(
    (s) => s.togglePlatformWideMaintenance
  );
  const toggleOrgMaintenance = useMaintenanceStore((s) => s.toggleOrgMaintenance);
  const requestMaintenance = useMaintenanceStore((s) => s.requestMaintenance);
  const toggleServiceCheck = useMaintenanceStore((s) => s.toggleServiceCheck);
  const addExecutionNote = useMaintenanceStore((s) => s.addExecutionNote);
  const completeMaintenance = useMaintenanceStore((s) => s.completeMaintenance);

  const { can } = useAdminPermissions();
  const canConfigure = can("config.manage");

  const adminName = accountProfile.name || "Arthur Pendelton";

  // Filter & Search State
  const [maintSearch, setMaintSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Target Organization for tenant isolation switcher
  const [selectedOrgIdForToggle, setSelectedOrgIdForToggle] = useState(
    organizations[0]?.id || "org-1"
  );

  // Modal Targets
  const [selectedMaintWindow, setSelectedMaintWindow] =
    useState<MaintenanceWindowItem | null>(null);

  // Schedule Maintenance Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedReason, setSchedReason] = useState("");
  const [schedScope, setSchedScope] = useState<MaintenanceScope>("PLATFORM_WIDE");
  const [schedOrgId, setSchedOrgId] = useState(organizations[0]?.id || "");
  const [schedImpact, setSchedImpact] =
    useState<MaintenanceImpactLevel>("Brief Slowdown");
  const [schedServices, setSchedServices] = useState<MaintenanceServiceArea[]>([
    "Core Web API",
    "Webhook Delivery & Ingestion",
  ]);
  const [schedStart, setSchedStart] = useState("2026-11-20T02:00");
  const [schedEnd, setSchedEnd] = useState("2026-11-20T02:45");
  const [schedTimezone, setSchedTimezone] = useState("UTC");
  const [schedNoticeMsg, setSchedNoticeMsg] = useState(
    "ProWise will undergo scheduled maintenance during this window. Workspaces may experience brief transit latency."
  );
  const [schedRestorationTime, setSchedRestorationTime] = useState(
    "Within scheduled 45-minute window"
  );
  const [schedNotify, setSchedNotify] = useState(true);

  // Emergency Override Modal State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emTitle, setEmTitle] = useState("Critical Infrastructure Hotfix Deployment");
  const [emReason, setEmReason] = useState(
    "Urgent zero-downtime database cache and webhook consumer failover."
  );
  const [emScope, setEmScope] = useState<MaintenanceScope>("PLATFORM_WIDE");
  const [emOrgId, setEmOrgId] = useState(organizations[0]?.id || "");
  const [emImpact, setEmImpact] =
    useState<MaintenanceImpactLevel>("Brief Slowdown");
  const [emServices, setEmServices] = useState<MaintenanceServiceArea[]>([
    "Core Web API",
    "Database & Storage",
    "Webhook Delivery & Ingestion",
  ]);
  const [emNoticeMsg, setEmNoticeMsg] = useState(
    "ProWise is applying an urgent zero-downtime performance patch. All workspace data remains safe."
  );
  const [emRestorationTime, setEmRestorationTime] = useState("Estimated 20-30 minutes");
  const [emDuration, setEmDuration] = useState(30);

  // Action Modals State
  const [approveTarget, setApproveTarget] = useState<MaintenanceWindowItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  const [rejectTarget, setRejectTarget] = useState<MaintenanceWindowItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindowItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const [emergencyStopTarget, setEmergencyStopTarget] =
    useState<MaintenanceWindowItem | null>(null);
  const [stopReason, setStopReason] = useState("");

  const [editNoticeTarget, setEditNoticeTarget] =
    useState<MaintenanceWindowItem | null>(null);
  const [editNoticeMsg, setEditNoticeMsg] = useState("");
  const [editNoticeTime, setEditNoticeTime] = useState("");

  // Inspect Modal Live Note Input
  const [newExecutionNote, setNewExecutionNote] = useState("");

  // Master Platform Toggle Confirmation
  const [confirmMasterToggleOpen, setConfirmMasterToggleOpen] = useState(false);
  const [targetMasterToggleValue, setTargetMasterToggleValue] = useState(false);

  // KPIs
  const activeCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "IN_PROGRESS").length,
    [maintenanceWindows]
  );
  const pendingCount = useMemo(
    () =>
      maintenanceWindows.filter((m) => m.status === "PENDING_APPROVAL").length,
    [maintenanceWindows]
  );
  const scheduledCount = useMemo(
    () =>
      maintenanceWindows.filter(
        (m) => m.status === "SCHEDULED" || m.status === "APPROVED"
      ).length,
    [maintenanceWindows]
  );
  const completedCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "COMPLETED").length,
    [maintenanceWindows]
  );

  // Pending Operator Requests
  const pendingOperatorRequests = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "PENDING_APPROVAL"),
    [maintenanceWindows]
  );

  // Filtered maintenance items
  const filteredWindows = useMemo(() => {
    const q = maintSearch.trim().toLowerCase();
    return maintenanceWindows.filter((m) => {
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
  }, [maintenanceWindows, maintSearch, statusFilter, scopeFilter, impactFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWindows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedWindows = filteredWindows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Handlers
  const handleApproveSubmit = () => {
    if (!approveTarget) return;
    if (!canConfigure) {
      toast.error("Your role does not permit approving maintenance windows.");
      return;
    }
    const res = approveMaintenance(
      approveTarget.id,
      adminName,
      approvalNotes.trim()
    );
    if (res.ok) {
      logActivity(
        "PLATFORM",
        "MAINTENANCE_APPROVED",
        `Approved maintenance window ${approveTarget.trackingCode}`,
        "INFO",
        approveTarget.trackingCode
      );
      toast.success(
        `Maintenance window ${approveTarget.trackingCode} approved for execution.`
      );
      setApproveTarget(null);
    } else {
      toast.error(res.error || "Approval failed.");
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectTarget) return;
    if (!canConfigure) {
      toast.error("Your role does not permit rejecting maintenance requests.");
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting the operator request.");
      return;
    }
    const res = rejectMaintenance(
      rejectTarget.id,
      adminName,
      rejectionReason.trim()
    );
    if (res.ok) {
      logActivity(
        "PLATFORM",
        "MAINTENANCE_REJECTED",
        `Rejected maintenance window ${rejectTarget.trackingCode}`,
        "WARNING",
        rejectTarget.trackingCode
      );
      toast.warning(`Maintenance request ${rejectTarget.trackingCode} rejected.`);
      setRejectTarget(null);
    } else {
      toast.error(res.error || "Rejection failed.");
    }
  };

  const handleCancelSubmit = () => {
    if (!cancelTarget) return;
    if (!canConfigure) {
      toast.error("Your role does not permit cancelling maintenance windows.");
      return;
    }
    if (!cancellationReason.trim()) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    const res = cancelMaintenance(
      cancelTarget.id,
      adminName,
      cancellationReason.trim()
    );
    if (res.ok) {
      logActivity(
        "PLATFORM",
        "MAINTENANCE_CANCELLED",
        `Cancelled maintenance schedule ${cancelTarget.trackingCode}`,
        "INFO",
        cancelTarget.trackingCode
      );
      toast.info(`Maintenance schedule ${cancelTarget.trackingCode} cancelled.`);
      setCancelTarget(null);
    } else {
      toast.error(res.error || "Cancellation failed.");
    }
  };

  const handleEmergencyStopSubmit = () => {
    if (!emergencyStopTarget) return;
    if (!canConfigure) {
      toast.error("Your role does not permit halting maintenance.");
      return;
    }
    const res = emergencyStop(
      emergencyStopTarget.id,
      adminName,
      stopReason.trim() || "Super Admin emergency stop triggered."
    );
    if (res.ok) {
      logActivity(
        "PLATFORM",
        "EMERGENCY_STOP_TRIGGERED",
        `Emergency stop executed on ${emergencyStopTarget.trackingCode}`,
        "CRITICAL",
        emergencyStopTarget.trackingCode
      );
      toast.success(
        `Emergency stop triggered for ${emergencyStopTarget.trackingCode}. Normal platform operations restored.`
      );
      setEmergencyStopTarget(null);
    } else {
      toast.error(res.error || "Emergency stop failed.");
    }
  };

  const handleEditNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNoticeTarget) return;
    if (!editNoticeMsg.trim()) {
      toast.error("Notice message cannot be empty.");
      return;
    }
    updateCustomerNotice(
      editNoticeTarget.id,
      editNoticeMsg.trim(),
      editNoticeTime.trim()
    );
    logActivity(
      "PLATFORM",
      "CUSTOMER_NOTICE_UPDATED",
      `Updated customer notice on ${editNoticeTarget.trackingCode}`,
      "INFO",
      editNoticeTarget.trackingCode
    );
    toast.success(
      `Customer maintenance message updated for ${editNoticeTarget.trackingCode}.`
    );
    setEditNoticeTarget(null);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit scheduling maintenance.");
      return;
    }
    if (schedTitle.trim().length < 5) {
      toast.error("Please provide a descriptive title (at least 5 characters).");
      return;
    }
    if (schedReason.trim().length < 10) {
      toast.error("Please provide a clear maintenance reason.");
      return;
    }
    if (schedServices.length === 0) {
      toast.error("Please select at least one affected service area.");
      return;
    }

    const targetOrg = organizations.find((o) => o.id === schedOrgId);

    const created = requestMaintenance({
      title: schedTitle.trim(),
      reason: schedReason.trim(),
      scope: schedScope,
      targetOrgId:
        schedScope === "ORGANIZATION_SPECIFIC" ? schedOrgId : undefined,
      targetOrgName:
        schedScope === "ORGANIZATION_SPECIFIC"
          ? targetOrg?.name || schedOrgId
          : undefined,
      impactLevel: schedImpact,
      affectedServices: schedServices,
      scheduledStart: new Date(schedStart).toISOString(),
      scheduledEnd: new Date(schedEnd).toISOString(),
      timezone: schedTimezone,
      customerNoticeMessage: schedNoticeMsg.trim(),
      estimatedRestorationTime: schedRestorationTime.trim(),
      notifyCustomers: schedNotify,
      isEmergency: false,
      requestedBy: adminName,
      requestedByEmail: accountProfile.email,
    });

    approveMaintenance(
      created.id,
      adminName,
      "Directly scheduled and authorized by Super Administrator."
    );

    logActivity(
      "PLATFORM",
      "MAINTENANCE_SCHEDULED",
      `Scheduled new maintenance window ${created.trackingCode}: ${created.title}`,
      "INFO",
      created.trackingCode
    );

    toast.success(
      `Scheduled maintenance window ${created.trackingCode} approved and confirmed.`
    );
    setScheduleModalOpen(false);
  };

  const handleEmergencyOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit triggering emergency override.");
      return;
    }
    if (emTitle.trim().length < 5) {
      toast.error("Please enter an emergency title.");
      return;
    }
    if (emReason.trim().length < 10) {
      toast.error("Please provide an emergency justification.");
      return;
    }

    const targetOrg = organizations.find((o) => o.id === emOrgId);

    const created = emergencyOverrideActivate({
      title: emTitle.trim(),
      reason: emReason.trim(),
      scope: emScope,
      targetOrgId: emScope === "ORGANIZATION_SPECIFIC" ? emOrgId : undefined,
      targetOrgName:
        emScope === "ORGANIZATION_SPECIFIC"
          ? targetOrg?.name || emOrgId
          : undefined,
      impactLevel: emImpact,
      affectedServices: emServices,
      customerNoticeMessage: emNoticeMsg.trim(),
      estimatedRestorationTime: emRestorationTime.trim(),
      durationMinutes: emDuration,
      adminName,
    });

    logActivity(
      "PLATFORM",
      "EMERGENCY_OVERRIDE_ACTIVATED",
      `Activated emergency maintenance override ${created.trackingCode}`,
      "CRITICAL",
      created.trackingCode
    );

    toast.warning(
      `EMERGENCY OVERRIDE ACTIVATED: ${created.trackingCode} is active. Customer banner is now live.`
    );
    setEmergencyModalOpen(false);
  };

  const handleAddNoteToActive = (windowId: string) => {
    if (!newExecutionNote.trim()) {
      toast.error("Please enter note text.");
      return;
    }
    addExecutionNote(
      windowId,
      newExecutionNote.trim(),
      adminName,
      "Super Administrator"
    );
    toast.success("Execution note added.");
    setNewExecutionNote("");
    const updated = maintenanceWindows.find((m) => m.id === windowId);
    if (updated) setSelectedMaintWindow(updated);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-maintenance-windows-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Tracking Code",
        "Title",
        "Scope",
        "Target Org",
        "Impact Level",
        "Status",
        "Emergency",
        "Scheduled Start",
        "Scheduled End",
        "Affected Services",
        "Requested By",
      ],
      filteredWindows.map((m) => [
        m.trackingCode,
        m.title,
        m.scope,
        m.targetOrgName || "All Organizations",
        m.impactLevel,
        m.status,
        m.isEmergency ? "YES" : "NO",
        m.scheduledStart,
        m.scheduledEnd,
        m.affectedServices.join("; "),
        m.requestedBy,
      ])
    );
    toast.success("Maintenance records exported to CSV.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Indicator */}
      <PageHeader
        title="Maintenance Mode & Operational Governance"
        badge="Platform Authority"
        simulationLabel="Multi-Tenant Maintenance Engine"
        description="Govern platform-wide and organization-specific maintenance windows, approve operator scheduling requests, activate emergency overrides, and manage live customer service restoration banners."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
            >
              <Download className="w-4 h-4 text-blue-600" />
              Export Records
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              permissionLocked={!canConfigure}
              onClick={() => setScheduleModalOpen(true)}
            >
              <Calendar className="w-4 h-4" />
              Schedule Maintenance
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              permissionLocked={!canConfigure}
              onClick={() => setEmergencyModalOpen(true)}
            >
              <Flame className="w-4 h-4 text-white" />
              Emergency Override
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Live Multi-Tenant Maintenance Engine"
        description="All maintenance schedules, emergency overrides, and tenant locks synchronize in real-time across Platform Operator consoles. Customer banners display customized restoration notices without blocking internal Super Admin operations."
      />

      {/* 2. Master Emergency & Org Control Surface Card */}
      <SurfaceCard className="p-4 sm:p-5 space-y-4 border-l-4 border-l-blue-600">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                Master Platform Authority &amp; Access Controls
              </h3>
              {platformWideMaintenanceActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  <Flame className="w-3 h-3 animate-pulse" />
                  Platform-Wide Maintenance Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  All Platform Systems Operational
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Toggle global platform-wide maintenance locks or isolate specific customer workspaces. Broadcasts restoration notices to customers while preserving internal administrative authority.
            </p>
          </div>

          {/* Master Global Platform-Wide Toggle */}
          <div className="flex items-center gap-3 bg-[var(--color-app-bg)] p-3 rounded-xl border border-[var(--color-border)] shrink-0">
            <div className="space-y-0.5 text-right">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                Global Platform Lock
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] block">
                {platformWideMaintenanceActive ? "Notice Banner Active" : "Normal Operation"}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={platformWideMaintenanceActive}
              disabled={!canConfigure}
              onClick={() => {
                setTargetMasterToggleValue(!platformWideMaintenanceActive);
                setConfirmMasterToggleOpen(true);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                platformWideMaintenanceActive
                  ? "bg-rose-600"
                  : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  platformWideMaintenanceActive
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live Customer Notice Banner Simulation (When Active) */}
        {platformWideMaintenanceActive && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-rose-800 dark:text-rose-200">
                  Live Customer Notice Banner (Active Across All Workspaces)
                </span>
                <span className="font-mono text-[10px] text-rose-700 dark:text-rose-300">
                  Broadcasting live
                </span>
              </div>
              <p className="text-rose-700 dark:text-rose-200/90 mt-1">
                &ldquo;ProWise is currently operating under authorized maintenance. Systems may experience latency. Your data remains fully secure.&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Organization-Specific Workspace Isolation Switcher */}
        <div className="pt-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-semibold text-[var(--color-text-primary)]">
              Workspace Isolation:
            </span>
            <div className="w-64">
              <AdminSelect
                value={selectedOrgIdForToggle}
                onChange={(e) => setSelectedOrgIdForToggle(e.target.value)}
                options={organizations.map((o) => ({
                  label: `${o.name} (${
                    activeOrgMaintenanceIds.includes(o.id)
                      ? "ISOLATED"
                      : "NORMAL"
                  })`,
                  value: o.id,
                }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeOrgMaintenanceIds.includes(selectedOrgIdForToggle) ? (
              <AdminButton
                variant="danger"
                size="xs"
                permissionLocked={!canConfigure}
                onClick={() => {
                  const org = organizations.find(
                    (o) => o.id === selectedOrgIdForToggle
                  );
                  toggleOrgMaintenance(
                    selectedOrgIdForToggle,
                    org?.name || selectedOrgIdForToggle,
                    false,
                    adminName
                  );
                  toast.info(
                    `Ended workspace isolation for ${
                      org?.name || selectedOrgIdForToggle
                    }.`
                  );
                }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Disable Workspace Maintenance
              </AdminButton>
            ) : (
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canConfigure}
                onClick={() => {
                  const org = organizations.find(
                    (o) => o.id === selectedOrgIdForToggle
                  );
                  toggleOrgMaintenance(
                    selectedOrgIdForToggle,
                    org?.name || selectedOrgIdForToggle,
                    true,
                    adminName
                  );
                  toast.warning(
                    `Activated isolated maintenance for ${
                      org?.name || selectedOrgIdForToggle
                    }.`
                  );
                }}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                Isolate Workspace for Maintenance
              </AdminButton>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* 3. Four Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Maintenance"
          value={activeCount}
          sublabel="In progress with live banner"
          icon={Flame}
          tone={activeCount > 0 ? "rose" : "slate"}
        />
        <KpiCard
          label="Pending Operator Requests"
          value={pendingCount}
          sublabel="Awaiting Super Admin approval"
          icon={Clock}
          tone={pendingCount > 0 ? "amber" : "slate"}
        />
        <KpiCard
          label="Approved & Scheduled"
          value={scheduledCount}
          sublabel="Authorized planned windows"
          icon={Calendar}
          tone="blue"
        />
        <KpiCard
          label="Completed & Restored"
          value={completedCount}
          sublabel="Historical maintenance logs"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* 4. Pending Operator Requests Queue (Awaiting Sign-off) */}
      {pendingOperatorRequests.length > 0 && (
        <SurfaceCard className="border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Operator Maintenance Requests Awaiting Approval
                </h3>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Review proposed infrastructure windows, evaluate customer impact, and authorize execution.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
              {pendingOperatorRequests.length} Pending Sign-Off
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {pendingOperatorRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-[var(--color-surface)] p-4 text-xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {req.trackingCode}
                    </span>
                    <StatusBadge label={req.status} tone="warning" dot />
                    <StatusBadge
                      label={
                        req.scope === "PLATFORM_WIDE"
                          ? "Platform-Wide"
                          : `Tenant: ${req.targetOrgName}`
                      }
                      tone="info"
                    />
                    <StatusBadge
                      label={req.impactLevel}
                      tone={getImpactTone(req.impactLevel)}
                    />
                    {req.isEmergency && (
                      <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                        🚨 EMERGENCY
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {req.title}
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    {req.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[var(--color-text-muted)]">
                    <span>
                      Submitted by:{" "}
                      <strong className="text-[var(--color-text-primary)]">
                        {req.requestedBy}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Start: <strong>{formatDateTime(req.scheduledStart)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Duration: <strong>{req.durationMinutes} min</strong>
                    </span>
                    <span>·</span>
                    <span>Affected: {req.affectedServices.join(", ")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--color-border)]">
                  <AdminButton
                    variant="primary"
                    size="xs"
                    permissionLocked={!canConfigure}
                    onClick={() => {
                      setApproveTarget(req);
                      setApprovalNotes("");
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve Schedule
                  </AdminButton>

                  <AdminButton
                    variant="outline"
                    size="xs"
                    permissionLocked={!canConfigure}
                    onClick={() => {
                      setRejectTarget(req);
                      setRejectionReason("");
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    Reject Request
                  </AdminButton>

                  <AdminButton
                    variant="subtle"
                    size="xs"
                    onClick={() => setSelectedMaintWindow(req)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </AdminButton>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* 5. Maintenance Windows & History Table */}
      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={maintSearch}
          onSearchChange={(v) => {
            setMaintSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search tracking code, title, reason, affected services, or organization..."
          hasActiveFilters={Boolean(
            maintSearch ||
              statusFilter !== "ALL" ||
              scopeFilter !== "ALL" ||
              impactFilter !== "ALL"
          )}
          onResetFilters={() => {
            setMaintSearch("");
            setStatusFilter("ALL");
            setScopeFilter("ALL");
            setImpactFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <AdminSelect
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
                <AdminSelect
                  value={scopeFilter}
                  onChange={(e) => {
                    setScopeFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Scopes", value: "ALL" },
                    { label: "Platform-Wide", value: "PLATFORM_WIDE" },
                    {
                      label: "Organization-Specific",
                      value: "ORGANIZATION_SPECIFIC",
                    },
                  ]}
                />
              </div>

              <div className="w-36">
                <AdminSelect
                  value={impactFilter}
                  onChange={(e) => {
                    setImpactFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Impact Levels", value: "ALL" },
                    { label: "No Downtime", value: "No Downtime" },
                    { label: "Brief Slowdown", value: "Brief Slowdown" },
                    { label: "Planned Downtime", value: "Planned Downtime" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {filteredWindows.length === 0 ? (
          <EmptyStateView
            icon={Wrench}
            title="No maintenance windows found"
            description="No scheduled or active maintenance matches your current search criteria."
            actionLabel="Schedule Maintenance Window"
            onAction={() => setScheduleModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-app-bg)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3.5 py-3 w-12 text-center">Sr.</th>
                  <th className="px-3.5 py-3 w-28">Tracking Code</th>
                  <th className="px-3.5 py-3">Title &amp; Justification</th>
                  <th className="px-3.5 py-3 hidden md:table-cell">Scope / Target</th>
                  <th className="px-3.5 py-3 hidden lg:table-cell">Impact</th>
                  <th className="px-3.5 py-3 hidden sm:table-cell">Scheduled Window</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginatedWindows.map((item, idx) => {
                  const serialNum = (safePage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-[var(--color-hover)]"
                    >
                      <td className="px-3.5 py-3 text-center text-[var(--color-text-muted)] font-mono text-[11px]">
                        {serialNum}
                      </td>
                      <td className="px-3.5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {item.trackingCode}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-[var(--color-text-primary)]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] line-clamp-1 max-w-sm">
                          {item.reason}
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                          {item.affectedServices.slice(0, 2).join(", ")}
                          {item.affectedServices.length > 2 &&
                            ` +${item.affectedServices.length - 2} more`}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 hidden md:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-text-primary)]">
                          {item.scope === "PLATFORM_WIDE" ? (
                            <>
                              <Globe className="w-3.5 h-3.5 text-blue-500" />
                              Platform-Wide
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-purple-500" />
                              {item.targetOrgName || "Tenant Workspace"}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 hidden lg:table-cell whitespace-nowrap">
                        <StatusBadge
                          label={item.impactLevel}
                          tone={getImpactTone(item.impactLevel)}
                        />
                      </td>
                      <td className="px-3.5 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
                        <div>{formatDateTime(item.scheduledStart)}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {item.durationMinutes} min ({item.timezone})
                        </div>
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <StatusBadge
                          label={item.status.replace("_", " ")}
                          tone={getMaintStatusTone(item.status)}
                          dot
                        />
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <AdminButton
                            variant="subtle"
                            size="xs"
                            onClick={() => setSelectedMaintWindow(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect
                          </AdminButton>

                          {item.status === "IN_PROGRESS" && (
                            <>
                              <AdminButton
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setEditNoticeTarget(item);
                                  setEditNoticeMsg(item.customerNoticeMessage);
                                  setEditNoticeTime(
                                    item.estimatedRestorationTime
                                  );
                                }}
                              >
                                Edit Notice
                              </AdminButton>

                              <AdminButton
                                variant="danger"
                                size="xs"
                                permissionLocked={!canConfigure}
                                onClick={() => {
                                  setEmergencyStopTarget(item);
                                  setStopReason("");
                                }}
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                Stop
                              </AdminButton>
                            </>
                          )}

                          {item.status === "PENDING_APPROVAL" && (
                            <AdminButton
                              variant="primary"
                              size="xs"
                              permissionLocked={!canConfigure}
                              onClick={() => {
                                setApproveTarget(item);
                                setApprovalNotes("");
                              }}
                            >
                              Approve
                            </AdminButton>
                          )}

                          {(item.status === "SCHEDULED" ||
                            item.status === "APPROVED") && (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              permissionLocked={!canConfigure}
                              onClick={() => {
                                setCancelTarget(item);
                                setCancellationReason("");
                              }}
                            >
                              Cancel
                            </AdminButton>
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
          pageSize={pageSize}
          totalItems={filteredWindows.length}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* =========================================================================
       * MODALS
       * ========================================================================= */}

      {/* 1. INSPECT / DETAILS MODAL */}
      <AdminModal
        isOpen={Boolean(selectedMaintWindow)}
        onClose={() => setSelectedMaintWindow(null)}
        title={
          selectedMaintWindow
            ? `Maintenance Window ${selectedMaintWindow.trackingCode}`
            : "Maintenance Window Details"
        }
        maxWidth="lg"
      >
        {selectedMaintWindow && (
          <div className="space-y-4 text-xs">
            {/* Summary Grid */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-sm text-[var(--color-text-primary)]">
                  {selectedMaintWindow.title}
                </span>
                <StatusBadge
                  label={selectedMaintWindow.status}
                  tone={getMaintStatusTone(selectedMaintWindow.status)}
                  dot
                />
              </div>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {selectedMaintWindow.reason}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--color-border)] text-[11px]">
                <div>
                  <span className="text-[var(--color-text-muted)] block">Scope:</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {selectedMaintWindow.scope === "PLATFORM_WIDE"
                      ? "Platform-Wide"
                      : `Tenant: ${selectedMaintWindow.targetOrgName}`}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block">Impact:</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {selectedMaintWindow.impactLevel}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block">Scheduled Window:</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {formatDateTime(selectedMaintWindow.scheduledStart)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block">Duration:</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {selectedMaintWindow.durationMinutes} min ({selectedMaintWindow.timezone})
                  </span>
                </div>
              </div>
            </div>

            {/* Affected Services */}
            <div>
              <span className="font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Affected Service Areas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedMaintWindow.affectedServices.map((svc) => (
                  <span
                    key={svc}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-secondary)]"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            </div>

            {/* Customer Notice & Estimated Restoration */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3.5 space-y-1.5">
              <span className="font-semibold text-blue-700 dark:text-blue-300 block">
                Live Customer Notice Message:
              </span>
              <p className="text-[var(--color-text-secondary)] leading-relaxed italic">
                &ldquo;{selectedMaintWindow.customerNoticeMessage}&rdquo;
              </p>
              <div className="text-[11px] text-[var(--color-text-muted)] pt-1">
                Estimated Restoration:{" "}
                <strong className="text-[var(--color-text-primary)]">
                  {selectedMaintWindow.estimatedRestorationTime}
                </strong>
              </div>
            </div>

            {/* Service Restoration Checklist */}
            {selectedMaintWindow.serviceRestorationChecks.length > 0 && (
              <div className="space-y-2">
                <span className="font-semibold text-[var(--color-text-primary)] block">
                  Service Restoration Verification Checklist:
                </span>
                <div className="space-y-1.5">
                  {selectedMaintWindow.serviceRestorationChecks.map((chk) => (
                    <label
                      key={chk.id}
                      className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 cursor-pointer hover:bg-[var(--color-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={chk.completed}
                        disabled={!canConfigure}
                        onChange={() => {
                          toggleServiceCheck(
                            selectedMaintWindow.id,
                            chk.id,
                            adminName
                          );
                          toast.success(`Checklist step updated.`);
                          const updated = maintenanceWindows.find(
                            (m) => m.id === selectedMaintWindow.id
                          );
                          if (updated) setSelectedMaintWindow(updated);
                        }}
                        className="mt-0.5 rounded border-[var(--color-border)] text-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className={`block font-medium ${
                            chk.completed
                              ? "line-through text-[var(--color-text-muted)]"
                              : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          {chk.label}
                        </span>
                        {chk.completed && chk.checkedBy && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Verified by {chk.checkedBy} at{" "}
                            {chk.checkedAt ? formatDateTime(chk.checkedAt) : ""}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Notes */}
            <div className="space-y-2">
              <span className="font-semibold text-[var(--color-text-primary)] block">
                Live Execution Notes &amp; Updates:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selectedMaintWindow.executionNotes.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-text-muted)] italic">
                    No execution notes recorded yet.
                  </p>
                ) : (
                  selectedMaintWindow.executionNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {note.author} ({note.role})
                        </span>
                        <span>{formatDateTime(note.timestamp)}</span>
                      </div>
                      <p className="text-[var(--color-text-secondary)] mt-1">
                        {note.note}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {canConfigure && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newExecutionNote}
                    onChange={(e) => setNewExecutionNote(e.target.value)}
                    placeholder="Add an operational note or status update..."
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-1.5 text-xs text-[var(--color-text-primary)]"
                  />
                  <AdminButton
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      handleAddNoteToActive(selectedMaintWindow.id)
                    }
                  >
                    Post Note
                  </AdminButton>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              {selectedMaintWindow.status === "IN_PROGRESS" && canConfigure && (
                <AdminButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const res = completeMaintenance(selectedMaintWindow.id, {
                      summary: "Maintenance window completed successfully.",
                      verifiedBy: adminName,
                    });
                    if (res.ok) {
                      toast.success(
                        `Maintenance window ${selectedMaintWindow.trackingCode} marked as COMPLETED.`
                      );
                      setSelectedMaintWindow(null);
                    }
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete Maintenance Window
                </AdminButton>
              )}
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedMaintWindow(null)}
              >
                Close
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* 2. SCHEDULE MAINTENANCE MODAL */}
      <AdminModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Planned Maintenance Window"
        description="Configure infrastructure upgrade or database maintenance windows with customer notices and service impact controls."
        maxWidth="lg"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
          <AdminInput
            label="Maintenance Title"
            value={schedTitle}
            onChange={(e) => setSchedTitle(e.target.value)}
            placeholder="e.g. Core Database Cluster Partitioning & Sharding"
            helperText="Clear operational title visible to operators and customers."
          />

          <AdminTextarea
            label="Technical Justification & Scope"
            value={schedReason}
            onChange={(e) => setSchedReason(e.target.value)}
            rows={2}
            placeholder="Describe the operational goals, reason for maintenance, and why this window was selected..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Scope of Impact"
              value={schedScope}
              onChange={(e) =>
                setSchedScope(e.target.value as MaintenanceScope)
              }
              options={[
                { label: "Platform-Wide (All Tenants)", value: "PLATFORM_WIDE" },
                {
                  label: "Organization-Specific (Isolated)",
                  value: "ORGANIZATION_SPECIFIC",
                },
              ]}
            />

            {schedScope === "ORGANIZATION_SPECIFIC" ? (
              <AdminSelect
                label="Target Tenant Organization"
                value={schedOrgId}
                onChange={(e) => setSchedOrgId(e.target.value)}
                options={organizations.map((o) => ({
                  label: o.name,
                  value: o.id,
                }))}
              />
            ) : (
              <AdminSelect
                label="Impact Level"
                value={schedImpact}
                onChange={(e) =>
                  setSchedImpact(e.target.value as MaintenanceImpactLevel)
                }
                options={IMPACT_LEVELS.map((lvl) => ({
                  label: lvl,
                  value: lvl,
                }))}
              />
            )}
          </div>

          {/* Affected Services Checklist */}
          <div>
            <label className="font-semibold text-[var(--color-text-primary)] block mb-1.5">
              Affected Service Areas:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SERVICE_AREAS.map((svc) => (
                <label
                  key={svc}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 cursor-pointer hover:bg-[var(--color-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={schedServices.includes(svc)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSchedServices([...schedServices, svc]);
                      } else {
                        setSchedServices(
                          schedServices.filter((s) => s !== svc)
                        );
                      }
                    }}
                    className="rounded border-[var(--color-border)] text-blue-600"
                  />
                  <span className="text-[11px] text-[var(--color-text-primary)]">
                    {svc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminInput
              label="Scheduled Start"
              type="datetime-local"
              value={schedStart}
              onChange={(e) => setSchedStart(e.target.value)}
            />
            <AdminInput
              label="Scheduled End"
              type="datetime-local"
              value={schedEnd}
              onChange={(e) => setSchedEnd(e.target.value)}
            />
            <AdminSelect
              label="Timezone"
              value={schedTimezone}
              onChange={(e) => setSchedTimezone(e.target.value)}
              options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
            />
          </div>

          <AdminInput
            label="Estimated Restoration Time Notice"
            value={schedRestorationTime}
            onChange={(e) => setSchedRestorationTime(e.target.value)}
            placeholder="e.g. Within scheduled 45-minute window"
          />

          <AdminTextarea
            label="Customer Notice Message (Banner text)"
            value={schedNoticeMsg}
            onChange={(e) => setSchedNoticeMsg(e.target.value)}
            rows={2}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScheduleModalOpen(false)}
            >
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              <Calendar className="w-3.5 h-3.5" />
              Schedule &amp; Authorize Window
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* 3. EMERGENCY OVERRIDE MODAL */}
      <AdminModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title="Trigger Emergency Maintenance Override"
        description="Deploy an urgent zero-downtime hotfix. Broadcasts immediate customer alert banner without requiring operator pre-approval."
        maxWidth="lg"
      >
        <form onSubmit={handleEmergencyOverrideSubmit} className="space-y-4 text-xs">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-800 dark:text-rose-200">
            <span className="font-bold block">🚨 High-Priority Override Notice</span>
            Activating emergency override puts the maintenance window into <strong>IN_PROGRESS</strong> immediately and starts broadcasting the live customer banner across tenant workspaces.
          </div>

          <AdminInput
            label="Emergency Title"
            value={emTitle}
            onChange={(e) => setEmTitle(e.target.value)}
          />

          <AdminTextarea
            label="Urgent Justification & Incident Reference"
            value={emReason}
            onChange={(e) => setEmReason(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Scope"
              value={emScope}
              onChange={(e) => setEmScope(e.target.value as MaintenanceScope)}
              options={[
                { label: "Platform-Wide", value: "PLATFORM_WIDE" },
                {
                  label: "Organization-Specific",
                  value: "ORGANIZATION_SPECIFIC",
                },
              ]}
            />
            <AdminSelect
              label="Impact Level"
              value={emImpact}
              onChange={(e) =>
                setEmImpact(e.target.value as MaintenanceImpactLevel)
              }
              options={IMPACT_LEVELS.map((lvl) => ({
                label: lvl,
                value: lvl,
              }))}
            />
            <AdminInput
              label="Estimated Duration (Minutes)"
              type="number"
              value={emDuration}
              onChange={(e) => setEmDuration(Number(e.target.value))}
            />
          </div>

          <AdminTextarea
            label="Live Customer Notice Message"
            value={emNoticeMsg}
            onChange={(e) => setEmNoticeMsg(e.target.value)}
            rows={2}
          />

          <AdminInput
            label="Estimated Restoration Time"
            value={emRestorationTime}
            onChange={(e) => setEmRestorationTime(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEmergencyModalOpen(false)}
            >
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="danger" size="sm">
              <Flame className="w-3.5 h-3.5" />
              Activate Emergency Override Now
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* 4. APPROVE OPERATOR REQUEST MODAL */}
      <AdminModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={
          approveTarget
            ? `Approve Maintenance Window ${approveTarget.trackingCode}`
            : "Approve Maintenance Request"
        }
        maxWidth="md"
      >
        {approveTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              You are authorizing <strong>{approveTarget.requestedBy}</strong> to execute &ldquo;{approveTarget.title}&rdquo; on {formatDateTime(approveTarget.scheduledStart)}.
            </p>

            <AdminTextarea
              label="Super Admin Authorization Notes (Optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Approved. Customer success leads notified; monitoring Redis cluster latency."
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setApproveTarget(null)}
              >
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleApproveSubmit}
              >
                Confirm Approval &amp; Schedule
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* 5. REJECT OPERATOR REQUEST MODAL */}
      <AdminModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={
          rejectTarget
            ? `Reject Operator Request ${rejectTarget.trackingCode}`
            : "Reject Maintenance Request"
        }
        maxWidth="md"
      >
        {rejectTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-text-secondary)]">
              Please specify why this maintenance request is being rejected so the submitting operator can make necessary adjustments.
            </p>

            <AdminTextarea
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="e.g. Collides with European end-of-quarter billing cycle; please reschedule to Sunday 02:00 UTC."
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setRejectTarget(null)}
              >
                Back
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                onClick={handleRejectSubmit}
              >
                Reject Request
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* 6. EMERGENCY STOP MODAL */}
      <AdminModal
        isOpen={Boolean(emergencyStopTarget)}
        onClose={() => setEmergencyStopTarget(null)}
        title={
          emergencyStopTarget
            ? `Emergency Halt on ${emergencyStopTarget.trackingCode}`
            : "Emergency Stop"
        }
        maxWidth="md"
      >
        {emergencyStopTarget && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-800 dark:text-rose-200">
              <span className="font-bold block">Immediate Service Restoration</span>
              This action aborts the active maintenance window immediately and clears the customer notice banner.
            </div>

            <AdminTextarea
              label="Reason for Emergency Halt"
              value={stopReason}
              onChange={(e) => setStopReason(e.target.value)}
              rows={3}
              placeholder="e.g. Unforeseen database lock escalation; rolling back to prior container build."
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setEmergencyStopTarget(null)}
              >
                Cancel
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                onClick={handleEmergencyStopSubmit}
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Halt Maintenance Window
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* 7. CANCEL SCHEDULE MODAL */}
      <AdminModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={
          cancelTarget
            ? `Cancel Maintenance Window ${cancelTarget.trackingCode}`
            : "Cancel Maintenance Window"
        }
        maxWidth="md"
      >
        {cancelTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-text-secondary)]">
              Are you sure you want to cancel the scheduled maintenance &ldquo;{cancelTarget.title}&rdquo;?
            </p>

            <AdminTextarea
              label="Cancellation Reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={2}
              placeholder="e.g. Superseded by container upgrade v2.15.0."
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setCancelTarget(null)}
              >
                Back
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                onClick={handleCancelSubmit}
              >
                Cancel Window
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* 8. EDIT CUSTOMER NOTICE MODAL */}
      <AdminModal
        isOpen={Boolean(editNoticeTarget)}
        onClose={() => setEditNoticeTarget(null)}
        title={
          editNoticeTarget
            ? `Update Customer Banner Notice (${editNoticeTarget.trackingCode})`
            : "Update Notice"
        }
        maxWidth="md"
      >
        {editNoticeTarget && (
          <form onSubmit={handleEditNoticeSubmit} className="space-y-4 text-xs">
            <AdminTextarea
              label="Live Customer Notice Message"
              value={editNoticeMsg}
              onChange={(e) => setEditNoticeMsg(e.target.value)}
              rows={3}
            />

            <AdminInput
              label="Estimated Restoration Time"
              value={editNoticeTime}
              onChange={(e) => setEditNoticeTime(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditNoticeTarget(null)}
              >
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary" size="sm">
                <Save className="w-3.5 h-3.5" />
                Broadcast Updated Message
              </AdminButton>
            </div>
          </form>
        )}
      </AdminModal>

      {/* 9. MASTER GLOBAL PLATFORM TOGGLE CONFIRMATION */}
      <ConfirmActionModal
        isOpen={confirmMasterToggleOpen}
        onClose={() => setConfirmMasterToggleOpen(false)}
        title={
          targetMasterToggleValue
            ? "Activate Platform-Wide Maintenance Mode?"
            : "Deactivate Platform-Wide Maintenance Mode?"
        }
        description={
          targetMasterToggleValue
            ? "Enabling platform-wide maintenance mode will display an alert banner with estimated restoration time across all tenant workspaces. It does not block internal Super Admin console access."
            : "Deactivating platform-wide maintenance mode will remove the customer notice banner and restore normal operating status."
        }
        confirmLabel={
          targetMasterToggleValue ? "Enable Maintenance" : "Disable Maintenance"
        }
        variant={targetMasterToggleValue ? "danger" : "primary"}
        onConfirm={() => {
          togglePlatformWideMaintenance(targetMasterToggleValue, adminName);
          logActivity(
            "PLATFORM",
            targetMasterToggleValue
              ? "PLATFORM_MAINTENANCE_ENABLED"
              : "PLATFORM_MAINTENANCE_DISABLED",
            targetMasterToggleValue
              ? "Enabled platform-wide maintenance mode"
              : "Disabled platform-wide maintenance mode",
            targetMasterToggleValue ? "CRITICAL" : "INFO"
          );
          toast.success(
            targetMasterToggleValue
              ? "Platform-wide maintenance mode enabled. Customer banner is live."
              : "Platform-wide maintenance mode disabled."
          );
          setConfirmMasterToggleOpen(false);
        }}
      />
    </div>
  );
}
