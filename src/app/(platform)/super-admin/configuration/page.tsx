"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Globe,
  History,
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
import { PlatformFeatureFlag } from "../_types";
import { formatDateTime } from "../_services/super-admin-service";
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

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney"];

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

export default function PlatformConfigurationPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "limits" ? "limits" : searchParams.get("tab") === "flags" ? "flags" : "maintenance";

  const [activeTab, setActiveTab] = useState<"maintenance" | "limits" | "flags">(initialTab);

  // Sync tab with URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "limits" || tabParam === "flags" || tabParam === "maintenance") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Stores
  const organizations = useSuperAdminStore((s) => s.organizations);
  const accountProfile = useSuperAdminStore((s) => s.accountProfile);
  const policySettings = useSuperAdminStore((s) => s.policySettings);
  const savePolicySettings = useSuperAdminStore((s) => s.savePolicySettings);
  const toggleFeatureFlag = useSuperAdminStore((s) => s.toggleFeatureFlag);

  // Maintenance Store
  const maintenanceWindows = useMaintenanceStore((s) => s.maintenanceWindows);
  const platformWideMaintenanceActive = useMaintenanceStore((s) => s.platformWideMaintenanceActive);
  const activeOrgMaintenanceIds = useMaintenanceStore((s) => s.activeOrgMaintenanceIds);
  const approveMaintenance = useMaintenanceStore((s) => s.approveMaintenance);
  const rejectMaintenance = useMaintenanceStore((s) => s.rejectMaintenance);
  const cancelMaintenance = useMaintenanceStore((s) => s.cancelMaintenance);
  const emergencyOverrideActivate = useMaintenanceStore((s) => s.emergencyOverrideActivate);
  const emergencyStop = useMaintenanceStore((s) => s.emergencyStop);
  const updateCustomerNotice = useMaintenanceStore((s) => s.updateCustomerNotice);
  const togglePlatformWideMaintenance = useMaintenanceStore((s) => s.togglePlatformWideMaintenance);
  const toggleOrgMaintenance = useMaintenanceStore((s) => s.toggleOrgMaintenance);
  const requestMaintenance = useMaintenanceStore((s) => s.requestMaintenance);

  const { can } = useAdminPermissions();
  const canConfigure = can("config.manage");

  const adminName = accountProfile.name || "Arthur Pendelton";

  // Section 1: Limits & Flags State (Preserved from existing page)
  const [checkinGraceWorkingDays, setCheckinGraceWorkingDays] = useState(policySettings.checkinGraceWorkingDays);
  const [staleWebhookMinutes, setStaleWebhookMinutes] = useState(policySettings.staleWebhookMinutes);
  const [auditRetentionDays, setAuditRetentionDays] = useState(policySettings.auditRetentionDays);
  const [enforceMfaForOperators, setEnforceMfaForOperators] = useState(policySettings.enforceMfaForOperators);
  const [autoSuspendAfterPastDueDays, setAutoSuspendAfterPastDueDays] = useState(policySettings.autoSuspendAfterPastDueDays);
  const [defaultTrialDays, setDefaultTrialDays] = useState(policySettings.defaultTrialDays);
  const [maxAttachmentMb, setMaxAttachmentMb] = useState(policySettings.maxAttachmentMb);
  const [maintenanceBannerMode, setMaintenanceBannerMode] = useState(policySettings.maintenanceBannerMode);
  const [pendingFlag, setPendingFlag] = useState<PlatformFeatureFlag | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  useEffect(() => {
    setCheckinGraceWorkingDays(policySettings.checkinGraceWorkingDays);
    setStaleWebhookMinutes(policySettings.staleWebhookMinutes);
    setAuditRetentionDays(policySettings.auditRetentionDays);
    setEnforceMfaForOperators(policySettings.enforceMfaForOperators);
    setAutoSuspendAfterPastDueDays(policySettings.autoSuspendAfterPastDueDays);
    setDefaultTrialDays(policySettings.defaultTrialDays);
    setMaxAttachmentMb(policySettings.maxAttachmentMb);
    setMaintenanceBannerMode(policySettings.maintenanceBannerMode);
  }, [policySettings]);

  // Section 2: Maintenance Mode Governance State
  const [maintSearch, setMaintSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Selected Target Organization for quick tenant toggle
  const [selectedOrgIdForToggle, setSelectedOrgIdForToggle] = useState(organizations[0]?.id || "");

  // Modals & Action Targets
  const [selectedMaintWindow, setSelectedMaintWindow] = useState<MaintenanceWindowItem | null>(null);

  // Schedule Maintenance Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedReason, setSchedReason] = useState("");
  const [schedScope, setSchedScope] = useState<MaintenanceScope>("PLATFORM_WIDE");
  const [schedOrgId, setSchedOrgId] = useState(organizations[0]?.id || "");
  const [schedImpact, setSchedImpact] = useState<MaintenanceImpactLevel>("Brief Slowdown");
  const [schedServices, setSchedServices] = useState<MaintenanceServiceArea[]>([
    "Core Web API",
    "Webhook Delivery & Ingestion",
  ]);
  const [schedStart, setSchedStart] = useState("2026-11-15T02:00");
  const [schedEnd, setSchedEnd] = useState("2026-11-15T02:45");
  const [schedTimezone, setSchedTimezone] = useState("UTC");
  const [schedNoticeMsg, setSchedNoticeMsg] = useState(
    "ProWise will undergo scheduled maintenance during this window. Workspaces may experience brief transit latency."
  );
  const [schedRestorationTime, setSchedRestorationTime] = useState("Within scheduled 45-minute window");
  const [schedNotify, setSchedNotify] = useState(true);

  // Emergency Override Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emTitle, setEmTitle] = useState("Critical Infrastructure Hotfix Deployment");
  const [emReason, setEmReason] = useState("Urgent zero-downtime database cache and webhook consumer failover.");
  const [emScope, setEmScope] = useState<MaintenanceScope>("PLATFORM_WIDE");
  const [emOrgId, setEmOrgId] = useState(organizations[0]?.id || "");
  const [emImpact, setEmImpact] = useState<MaintenanceImpactLevel>("Brief Slowdown");
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

  // Approval / Rejection / Cancellation / Emergency Stop Modals
  const [approveTarget, setApproveTarget] = useState<MaintenanceWindowItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  const [rejectTarget, setRejectTarget] = useState<MaintenanceWindowItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindowItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const [emergencyStopTarget, setEmergencyStopTarget] = useState<MaintenanceWindowItem | null>(null);
  const [stopReason, setStopReason] = useState("");

  const [editNoticeTarget, setEditNoticeTarget] = useState<MaintenanceWindowItem | null>(null);
  const [editNoticeMsg, setEditNoticeMsg] = useState("");
  const [editNoticeTime, setEditNoticeTime] = useState("");

  // Confirmation for Master Toggles
  const [confirmMasterToggleOpen, setConfirmMasterToggleOpen] = useState(false);
  const [targetMasterToggleValue, setTargetMasterToggleValue] = useState(false);

  const [confirmOrgToggleOpen, setConfirmOrgToggleOpen] = useState(false);

  // KPIs
  const activeCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "IN_PROGRESS").length,
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
  const paginatedWindows = filteredWindows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Handlers for Maintenance Actions
  const handleApproveSubmit = () => {
    if (!approveTarget) return;
    if (!canConfigure) {
      toast.error("Your role does not permit approving maintenance windows.");
      return;
    }
    const res = approveMaintenance(approveTarget.id, adminName, approvalNotes.trim());
    if (res.ok) {
      toast.success(`Maintenance window ${approveTarget.trackingCode} approved for execution.`);
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
    const res = rejectMaintenance(rejectTarget.id, adminName, rejectionReason.trim());
    if (res.ok) {
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
    const res = cancelMaintenance(cancelTarget.id, adminName, cancellationReason.trim());
    if (res.ok) {
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
    const res = emergencyStop(emergencyStopTarget.id, adminName, stopReason.trim() || "Super Admin emergency stop triggered.");
    if (res.ok) {
      toast.success(`Emergency stop triggered for ${emergencyStopTarget.trackingCode}. Normal platform operations restored.`);
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
    updateCustomerNotice(editNoticeTarget.id, editNoticeMsg.trim(), editNoticeTime.trim());
    toast.success(`Customer maintenance message updated for ${editNoticeTarget.trackingCode}.`);
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
      targetOrgId: schedScope === "ORGANIZATION_SPECIFIC" ? schedOrgId : undefined,
      targetOrgName: schedScope === "ORGANIZATION_SPECIFIC" ? (targetOrg?.name || schedOrgId) : undefined,
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

    // Auto-approve since Super Admin is creating it
    approveMaintenance(created.id, adminName, "Directly scheduled and approved by Super Administrator.");
    toast.success(`Scheduled maintenance window ${created.trackingCode} approved and confirmed.`);
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
      targetOrgName: emScope === "ORGANIZATION_SPECIFIC" ? (targetOrg?.name || emOrgId) : undefined,
      impactLevel: emImpact,
      affectedServices: emServices,
      customerNoticeMessage: emNoticeMsg.trim(),
      estimatedRestorationTime: emRestorationTime.trim(),
      durationMinutes: emDuration,
      adminName,
    });

    toast.warning(`EMERGENCY OVERRIDE ACTIVATED: ${created.trackingCode} is now active. Customer banner is live.`);
    setEmergencyModalOpen(false);
  };

  // Section 1 Limits Handlers
  const validateAndRequestSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit updating global platform configuration.");
      return;
    }
    if (defaultTrialDays < 1 || defaultTrialDays > 90) {
      toast.error("Default trial duration must be between 1 and 90 days.");
      return;
    }
    if (autoSuspendAfterPastDueDays < 3 || autoSuspendAfterPastDueDays > 60) {
      toast.error("Past-due auto-suspend threshold must be between 3 and 60 days.");
      return;
    }
    if (auditRetentionDays < 30 || auditRetentionDays > 3650) {
      toast.error("Audit log retention must be between 30 and 3,650 days.");
      return;
    }
    if (maxAttachmentMb < 1 || maxAttachmentMb > 250) {
      toast.error("Maximum attachment size must be between 1 MB and 250 MB.");
      return;
    }
    setConfirmSaveOpen(true);
  };

  const handleConfirmSave = () => {
    savePolicySettings({
      checkinGraceWorkingDays,
      staleWebhookMinutes,
      auditRetentionDays,
      enforceMfaForOperators,
      autoSuspendAfterPastDueDays,
      defaultTrialDays,
      maxAttachmentMb,
      maintenanceBannerMode,
    });
    toast.success("Platform system limits and operational rules updated.");
  };

  const resetUnsaved = () => {
    setCheckinGraceWorkingDays(policySettings.checkinGraceWorkingDays);
    setStaleWebhookMinutes(policySettings.staleWebhookMinutes);
    setAuditRetentionDays(policySettings.auditRetentionDays);
    setEnforceMfaForOperators(policySettings.enforceMfaForOperators);
    setAutoSuspendAfterPastDueDays(policySettings.autoSuspendAfterPastDueDays);
    setDefaultTrialDays(policySettings.defaultTrialDays);
    setMaxAttachmentMb(policySettings.maxAttachmentMb);
    setMaintenanceBannerMode(policySettings.maintenanceBannerMode);
    toast.info("Reverted unsaved changes.");
  };

  const enabledFlagsCount = policySettings.featureFlags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Platform Configuration & Governance"
        badge="Platform Authority"
        simulationLabel="Multi-Tenant Maintenance Engine"
        description="Govern platform-wide and organization-specific maintenance windows, approve operator scheduling requests, activate emergency overrides, and configure global system safeguards."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
              variant="outline"
              size="sm"
              permissionLocked={!canConfigure}
              onClick={() => setEmergencyModalOpen(true)}
            >
              <Flame className="w-4 h-4 text-rose-500" />
              Emergency Override
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Live Multi-Tenant Maintenance Engine Active"
        description="All maintenance schedules, approvals, and emergency locks synchronize in real-time with Platform Operator consoles. Customer banners display customized restoration notices without blocking Super Admin governance access."
      />

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-2 bg-[var(--color-surface)] px-4 rounded-xl border">
        <button
          type="button"
          onClick={() => setActiveTab("maintenance")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "maintenance"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Maintenance Mode &amp; Governance</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {pendingCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("limits")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "limits"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Global System Limits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("flags")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "flags"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <ToggleLeft className="w-4 h-4" />
          <span>Feature Availability Flags</span>
          <span className="rounded-full bg-[var(--color-elevated)] px-1.5 py-0.2 text-[10px] text-[var(--color-text-muted)]">
            {enabledFlagsCount}/{policySettings.featureFlags.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
       * TAB 1: MAINTENANCE MODE & GOVERNANCE (Requirement 1, 3, 4)
       * ========================================================================= */}
      {activeTab === "maintenance" && (
        <div className="space-y-6">
          {/* Master Emergency & Org Control Surface */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4 border-l-4 border-l-blue-600">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                    Maintenance Authority &amp; Access Controls
                  </h3>
                  {platformWideMaintenanceActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      <Flame className="w-3 h-3" />
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
                  Toggle platform-wide maintenance locks or isolate specific customer workspaces. Broadcasts restoration notices to customers while preserving internal administrative authority.
                </p>
              </div>

              {/* Master Global Platform-Wide Toggle */}
              <div className="flex items-center gap-3 bg-[var(--color-app-bg)] p-3 rounded-xl border border-[var(--color-border)] shrink-0">
                <div className="space-y-0.5 text-right">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    Global Platform Lock
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] block">
                    {platformWideMaintenanceActive ? "Active Notice Live" : "Inactive"}
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
                    platformWideMaintenanceActive ? "bg-rose-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      platformWideMaintenanceActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Organization-Specific Quick Maintenance Switcher */}
            <div className="pt-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Organization-Specific Maintenance:
                </span>
                <div className="w-56">
                  <AdminSelect
                    value={selectedOrgIdForToggle}
                    onChange={(e) => setSelectedOrgIdForToggle(e.target.value)}
                    options={organizations.map((o) => ({
                      label: `${o.name} (${activeOrgMaintenanceIds.includes(o.id) ? "MAINTENANCE" : "NORMAL"})`,
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
                      const org = organizations.find((o) => o.id === selectedOrgIdForToggle);
                      toggleOrgMaintenance(selectedOrgIdForToggle, org?.name || selectedOrgIdForToggle, false, adminName);
                      toast.info(`Ended maintenance for ${org?.name || selectedOrgIdForToggle}.`);
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Disable Org Maintenance
                  </AdminButton>
                ) : (
                  <AdminButton
                    variant="outline"
                    size="xs"
                    permissionLocked={!canConfigure}
                    onClick={() => {
                      const org = organizations.find((o) => o.id === selectedOrgIdForToggle);
                      toggleOrgMaintenance(selectedOrgIdForToggle, org?.name || selectedOrgIdForToggle, true, adminName);
                      toast.warning(`Activated dedicated maintenance for ${org?.name || selectedOrgIdForToggle}.`);
                    }}
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    Enable Org Maintenance
                  </AdminButton>
                )}
              </div>
            </div>
          </SurfaceCard>

          {/* 4 KPIs */}
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
              sublabel="Authorized for planned windows"
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

          {/* Pending Operator Requests Queue (Review & Approvals) */}
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
                      Review proposed infrastructure windows, evaluate scope and customer impact, and authorize schedules.
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
                          label={req.scope === "PLATFORM_WIDE" ? "Platform-Wide" : `Tenant: ${req.targetOrgName}`}
                          tone="info"
                        />
                        <StatusBadge label={req.impactLevel} tone={getImpactTone(req.impactLevel)} />
                        {req.isEmergency && (
                          <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            🚨 EMERGENCY REQUEST
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
                        <span>Submitted by: <strong className="text-[var(--color-text-primary)]">{req.requestedBy}</strong></span>
                        <span>·</span>
                        <span>Start: <strong>{formatDateTime(req.scheduledStart)}</strong></span>
                        <span>·</span>
                        <span>Duration: <strong>{req.durationMinutes} min</strong></span>
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

          {/* Maintenance Table & Filters */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4">
            <FilterBar
              search={maintSearch}
              onSearchChange={(v) => {
                setMaintSearch(v);
                setPage(1);
              }}
              searchPlaceholder="Search tracking code, title, reason, affected service, or organization..."
              hasActiveFilters={Boolean(
                maintSearch || statusFilter !== "ALL" || scopeFilter !== "ALL" || impactFilter !== "ALL"
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
                        { label: "Org-Specific", value: "ORGANIZATION_SPECIFIC" },
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

            {paginatedWindows.length === 0 ? (
              <EmptyStateView
                icon={Wrench}
                title="No maintenance records found"
                description="No maintenance windows match your active search and filter criteria."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <th className="py-3 px-3.5 whitespace-nowrap">Tracking #</th>
                      <th className="py-3 px-3.5 min-w-[200px]">Title &amp; Justification</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Scope</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Affected Services</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Impact</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Timing &amp; Schedule</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {paginatedWindows.map((win) => {
                      const isPlatform = win.scope === "PLATFORM_WIDE";

                      return (
                        <tr
                          key={win.id}
                          className="hover:bg-[var(--color-hover)] transition-colors"
                        >
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
                            <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
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
                              <AdminButton
                                variant="outline"
                                size="xs"
                                onClick={() => setSelectedMaintWindow(win)}
                                title="Inspect maintenance details, checklist and audit logs"
                              >
                                <Eye className="w-3 h-3" />
                                Details
                              </AdminButton>

                              <AdminButton
                                variant="subtle"
                                size="xs"
                                permissionLocked={!canConfigure}
                                onClick={() => {
                                  setEditNoticeTarget(win);
                                  setEditNoticeMsg(win.customerNoticeMessage);
                                  setEditNoticeTime(win.estimatedRestorationTime);
                                }}
                                title="Customize customer-facing maintenance notice"
                              >
                                Notice
                              </AdminButton>

                              {win.status === "IN_PROGRESS" && (
                                <AdminButton
                                  variant="danger"
                                  size="xs"
                                  permissionLocked={!canConfigure}
                                  onClick={() => {
                                    setEmergencyStopTarget(win);
                                    setStopReason("");
                                  }}
                                  title="Immediately halt active maintenance"
                                >
                                  Stop
                                </AdminButton>
                              )}

                              {(win.status === "SCHEDULED" || win.status === "APPROVED") && (
                                <AdminButton
                                  variant="outline"
                                  size="xs"
                                  permissionLocked={!canConfigure}
                                  onClick={() => {
                                    setCancelTarget(win);
                                    setCancellationReason("");
                                  }}
                                  title="Cancel scheduled window"
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
              totalItems={filteredWindows.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </SurfaceCard>
        </div>
      )}

      {/* =========================================================================
       * TAB 2: GLOBAL SYSTEM LIMITS (Preserved)
       * ========================================================================= */}
      {activeTab === "limits" && (
        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={validateAndRequestSave} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Global System Limits &amp; Safeguards
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Configure organization defaults, billing grace intervals, and upload ceilings. Last saved{" "}
                  {formatDateTime(policySettings.updatedAt)}.
                </p>
              </div>
              <AdminButton type="button" variant="ghost" size="xs" onClick={resetUnsaved}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Changes
              </AdminButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AdminInput
                label="Default Trial Length (Days)"
                type="number"
                min={1}
                max={90}
                value={defaultTrialDays}
                onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
                helperText="How many days a new workspace evaluates ProWise before billing starts."
              />
              <AdminInput
                label="Overdue Auto-Suspend Window (Days)"
                type="number"
                min={3}
                max={60}
                value={autoSuspendAfterPastDueDays}
                onChange={(e) => setAutoSuspendAfterPastDueDays(Number(e.target.value))}
                helperText="Days after an unpaid invoice before automatic workspace suspension."
              />
              <AdminInput
                label="Check-in Reminder Grace (Working Days)"
                type="number"
                min={1}
                max={14}
                value={checkinGraceWorkingDays}
                onChange={(e) => setCheckinGraceWorkingDays(Number(e.target.value))}
                helperText="Buffer before team check-ins are marked overdue."
              />
              <AdminInput
                label="Webhook Health Alert Threshold (Minutes)"
                type="number"
                min={1}
                max={120}
                value={staleWebhookMinutes}
                onChange={(e) => setStaleWebhookMinutes(Number(e.target.value))}
                helperText="Minutes of stalled event delivery before raising an operator warning."
              />
              <AdminInput
                label="Audit History Retention (Days)"
                type="number"
                min={30}
                max={3650}
                value={auditRetentionDays}
                onChange={(e) => setAuditRetentionDays(Number(e.target.value))}
                helperText="Minimum days administrative and security logs are preserved."
              />
              <AdminInput
                label="Max File Attachment Size (MB)"
                type="number"
                min={1}
                max={250}
                value={maxAttachmentMb}
                onChange={(e) => setMaxAttachmentMb(Number(e.target.value))}
                helperText="Maximum upload limit per attachment inside customer workspaces."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    Require Two-Factor Authentication for All Operators
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">
                    Blocks Platform Operators from accessing governance tools unless 2FA is active.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enforceMfaForOperators}
                  onChange={(e) => setEnforceMfaForOperators(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    Legacy Maintenance Notice Mode
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">
                    Historical switch preserved for compatibility with older tenant banners.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceBannerMode}
                  onChange={(e) => setMaintenanceBannerMode(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                type="submit"
                variant="primary"
                size="sm"
                permissionLocked={!canConfigure}
              >
                <Save className="w-3.5 h-3.5" />
                Save Platform Limits
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* =========================================================================
       * TAB 3: FEATURE FLAGS (Preserved)
       * ========================================================================= */}
      {activeTab === "flags" && (
        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Feature Availability Controls
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Enable or pause platform capabilities by customer tier without deploying new code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {policySettings.featureFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                      {flag.label}
                    </span>
                    <StatusBadge label={flag.audience} tone="info" />
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {flag.description}
                  </p>
                </div>
                <AdminButton
                  variant={flag.enabled ? "primary" : "outline"}
                  size="xs"
                  permissionLocked={!canConfigure}
                  onClick={() => setPendingFlag(flag)}
                  className="shrink-0"
                >
                  {flag.enabled ? "Enabled" : "Disabled"}
                </AdminButton>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* =========================================================================
       * MODALS & DRAWERS
       * ========================================================================= */}

      {/* SCHEDULE MAINTENANCE MODAL (Super Admin Guided Form) */}
      <AdminModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Planned Maintenance Window"
        description="Configure start/end times, scope, timezone, affected service areas, and customer notice."
        maxWidth="lg"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Maintenance Scope"
              value={schedScope}
              onChange={(e) => setSchedScope(e.target.value as MaintenanceScope)}
              options={[
                { label: "Platform-Wide (All Organizations)", value: "PLATFORM_WIDE" },
                { label: "Organization-Specific (Single Tenant)", value: "ORGANIZATION_SPECIFIC" },
              ]}
            />

            {schedScope === "ORGANIZATION_SPECIFIC" ? (
              <AdminSelect
                label="Target Tenant Organization"
                value={schedOrgId}
                onChange={(e) => setSchedOrgId(e.target.value)}
                options={organizations.map((o) => ({ label: o.name, value: o.id }))}
              />
            ) : (
              <AdminSelect
                label="Impact Level"
                value={schedImpact}
                onChange={(e) => setSchedImpact(e.target.value as MaintenanceImpactLevel)}
                options={IMPACT_LEVELS.map((lvl) => ({ label: lvl, value: lvl }))}
              />
            )}
          </div>

          <AdminInput
            label="Maintenance Title"
            value={schedTitle}
            onChange={(e) => setSchedTitle(e.target.value)}
            placeholder="e.g. Primary Read-Replica Index Rebuild & OS Upgrade"
          />

          <AdminTextarea
            label="Technical Reason & Justification"
            value={schedReason}
            onChange={(e) => setSchedReason(e.target.value)}
            placeholder="Explain why this maintenance is required and what will be accomplished..."
            rows={2}
          />

          {/* Affected Services Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block">
              Affected Service Areas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SERVICE_AREAS.map((svc) => {
                const isChecked = schedServices.includes(svc);
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
                          setSchedServices(schedServices.filter((s) => s !== svc));
                        } else {
                          setSchedServices([...schedServices, svc]);
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
              label="Schedule Timezone"
              value={schedTimezone}
              onChange={(e) => setSchedTimezone(e.target.value)}
              options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
            />
          </div>

          <AdminTextarea
            label="Customer-Facing Maintenance Message"
            value={schedNoticeMsg}
            onChange={(e) => setSchedNoticeMsg(e.target.value)}
            placeholder="Message displayed in the customer dashboard banner during maintenance..."
            rows={2}
          />

          <AdminInput
            label="Estimated Restoration Time"
            value={schedRestorationTime}
            onChange={(e) => setSchedRestorationTime(e.target.value)}
            placeholder="e.g. 02:45 UTC (approx 45 minutes)"
          />

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={schedNotify}
                onChange={(e) => setSchedNotify(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span>Broadcast maintenance notice banner to customer workspaces</span>
            </label>

            <div className="flex items-center gap-2">
              <AdminButton type="button" variant="outline" size="sm" onClick={() => setScheduleModalOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary" size="sm">
                Confirm &amp; Schedule
              </AdminButton>
            </div>
          </div>
        </form>
      </AdminModal>

      {/* EMERGENCY OVERRIDE MODAL */}
      <AdminModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title="Direct Super Admin Emergency Override"
        description="Immediately activates emergency maintenance mode. Bypasses operator approval flow and broadcasts restoration notices instantly."
        maxWidth="lg"
      >
        <form onSubmit={handleEmergencyOverrideSubmit} className="space-y-4">
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200">
            <strong>Emergency Safeguard:</strong> This action will mark maintenance as <strong>IN_PROGRESS</strong> immediately and publish live customer alerts across the selected scope.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Emergency Scope"
              value={emScope}
              onChange={(e) => setEmScope(e.target.value as MaintenanceScope)}
              options={[
                { label: "Platform-Wide (All Workspaces)", value: "PLATFORM_WIDE" },
                { label: "Organization-Specific", value: "ORGANIZATION_SPECIFIC" },
              ]}
            />
            {emScope === "ORGANIZATION_SPECIFIC" && (
              <AdminSelect
                label="Target Organization"
                value={emOrgId}
                onChange={(e) => setEmOrgId(e.target.value)}
                options={organizations.map((o) => ({ label: o.name, value: o.id }))}
              />
            )}
          </div>

          <AdminInput
            label="Emergency Maintenance Title"
            value={emTitle}
            onChange={(e) => setEmTitle(e.target.value)}
          />

          <AdminTextarea
            label="Emergency Reason & Root Cause"
            value={emReason}
            onChange={(e) => setEmReason(e.target.value)}
            rows={2}
          />

          <AdminTextarea
            label="Live Customer Alert Message"
            value={emNoticeMsg}
            onChange={(e) => setEmNoticeMsg(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminInput
              label="Estimated Restoration Time"
              value={emRestorationTime}
              onChange={(e) => setEmRestorationTime(e.target.value)}
            />
            <AdminInput
              label="Target Duration (Minutes)"
              type="number"
              value={emDuration}
              onChange={(e) => setEmDuration(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setEmergencyModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="danger" size="sm">
              <Flame className="w-3.5 h-3.5" />
              Activate Emergency Override
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* APPROVE MODAL */}
      <AdminModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={`Approve Maintenance Window: ${approveTarget?.trackingCode}`}
        description="Confirm authorization for this operator-requested maintenance window."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs bg-[var(--color-app-bg)] space-y-1">
            <p className="font-semibold text-[var(--color-text-primary)]">{approveTarget?.title}</p>
            <p className="text-[var(--color-text-secondary)]">{approveTarget?.reason}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Requested by {approveTarget?.requestedBy} · Start: {approveTarget && formatDateTime(approveTarget.scheduledStart)}
            </p>
          </div>

          <AdminTextarea
            label="Approval Notes (Optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add guidance or confirmation for the executing operator..."
            rows={2}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setApproveTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleApproveSubmit}>
              Confirm Approval
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* REJECT MODAL */}
      <AdminModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={`Reject Request: ${rejectTarget?.trackingCode}`}
        description="Explain why this maintenance request cannot be approved at this time."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Rejection Justification (Required)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Schedule conflicts with tenant month-end billing cutover..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton variant="danger" size="sm" onClick={handleRejectSubmit}>
              Confirm Rejection
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* CANCEL MODAL */}
      <AdminModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel Maintenance: ${cancelTarget?.trackingCode}`}
        description="Cancelling will abort this window and remove any scheduled customer notices."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Cancellation Reason"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Why is this window being cancelled?..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Keep Window
            </AdminButton>
            <AdminButton variant="danger" size="sm" onClick={handleCancelSubmit}>
              Confirm Cancellation
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* EMERGENCY STOP MODAL */}
      <AdminModal
        isOpen={Boolean(emergencyStopTarget)}
        onClose={() => setEmergencyStopTarget(null)}
        title={`Emergency Stop: ${emergencyStopTarget?.trackingCode}`}
        description="Immediately halt active maintenance, take down customer banners, and restore normal platform routing."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200">
            Halting this window will immediately turn off the maintenance mode lock across all targeted workspaces.
          </div>

          <AdminInput
            label="Emergency Stop Reason"
            value={stopReason}
            onChange={(e) => setStopReason(e.target.value)}
            placeholder="e.g. Unexpected production traffic surge, operator aborted rollout"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setEmergencyStopTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton variant="danger" size="sm" onClick={handleEmergencyStopSubmit}>
              Halt Maintenance Now
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* EDIT CUSTOMER NOTICE MODAL */}
      <AdminModal
        isOpen={Boolean(editNoticeTarget)}
        onClose={() => setEditNoticeTarget(null)}
        title={`Customize Customer Notice: ${editNoticeTarget?.trackingCode}`}
        description="Update the live message and estimated restoration time displayed to customer workspaces."
        maxWidth="md"
      >
        <form onSubmit={handleEditNoticeSubmit} className="space-y-4">
          <AdminTextarea
            label="Customer Notice Message"
            value={editNoticeMsg}
            onChange={(e) => setEditNoticeMsg(e.target.value)}
            rows={3}
          />

          <AdminInput
            label="Estimated Restoration Time"
            value={editNoticeTime}
            onChange={(e) => setEditNoticeTime(e.target.value)}
            placeholder="e.g. 03:00 UTC (15 minutes remaining)"
          />

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-semibold">Customer Preview:</p>
            <p className="italic">"{editNoticeMsg || "No notice entered"}"</p>
            <p className="text-[10px] opacity-80">Estimated Restoration: {editNoticeTime || "Pending"}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setEditNoticeTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Save Customer Notice
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* MASTER TOGGLE CONFIRMATION */}
      <ConfirmActionModal
        isOpen={confirmMasterToggleOpen}
        onClose={() => setConfirmMasterToggleOpen(false)}
        title={targetMasterToggleValue ? "Activate Platform-Wide Maintenance Mode?" : "Deactivate Platform-Wide Maintenance Mode?"}
        description={
          targetMasterToggleValue
            ? "Enabling platform-wide maintenance mode will display an alert banner with estimated restoration time across all tenant workspaces. It does not block internal Super Admin console access."
            : "Deactivating platform-wide maintenance mode will remove the customer notice banner and restore normal operating status."
        }
        confirmLabel={targetMasterToggleValue ? "Enable Maintenance" : "Disable Maintenance"}
        variant={targetMasterToggleValue ? "danger" : "primary"}
        onConfirm={() => {
          togglePlatformWideMaintenance(targetMasterToggleValue, adminName);
          toast.success(
            targetMasterToggleValue
              ? "Platform-wide maintenance mode enabled. Customer banner is live."
              : "Platform-wide maintenance mode disabled."
          );
        }}
      />

      {/* DETAILS DRAWER / MODAL */}
      {selectedMaintWindow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={() => setSelectedMaintWindow(null)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] p-5 shrink-0 bg-[var(--color-sidebar)]">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {selectedMaintWindow.trackingCode}
                  </span>
                  <StatusBadge
                    label={selectedMaintWindow.status.replace("_", " ")}
                    tone={getMaintStatusTone(selectedMaintWindow.status)}
                    dot
                  />
                  <StatusBadge label={selectedMaintWindow.impactLevel} tone={getImpactTone(selectedMaintWindow.impactLevel)} />
                  {selectedMaintWindow.isEmergency && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                      EMERGENCY
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                  {selectedMaintWindow.title}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Scope: {selectedMaintWindow.scope === "PLATFORM_WIDE" ? "Platform-Wide" : `Target Org: ${selectedMaintWindow.targetOrgName}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaintWindow(null)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Technical Reason */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1">
                <span className="font-semibold text-[var(--color-text-primary)]">Technical Justification:</span>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">{selectedMaintWindow.reason}</p>
              </div>

              {/* Timing & Schedule Matrix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Scheduled Start</span>
                  <p className="font-semibold text-[var(--color-text-primary)]">{formatDateTime(selectedMaintWindow.scheduledStart)}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{selectedMaintWindow.timezone}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-app-bg)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Target Duration</span>
                  <p className="font-semibold text-[var(--color-text-primary)]">{selectedMaintWindow.durationMinutes} minutes</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {selectedMaintWindow.actualEnd ? "Completed" : "In Progress / Pending"}
                  </p>
                </div>
              </div>

              {/* Customer Notice Card */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-200">Customer Notice Message:</span>
                  <span className="text-[10px] text-blue-700 dark:text-blue-300">
                    Restoration: {selectedMaintWindow.estimatedRestorationTime}
                  </span>
                </div>
                <p className="text-blue-950 dark:text-blue-100 italic">"{selectedMaintWindow.customerNoticeMessage}"</p>
              </div>

              {/* Service Restoration Checks */}
              {selectedMaintWindow.serviceRestorationChecks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      Service Restoration Checklist ({selectedMaintWindow.progressPct}% Complete)
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedMaintWindow.serviceRestorationChecks.map((chk) => (
                      <div
                        key={chk.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)]"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            chk.completed ? "text-emerald-500" : "text-slate-400"
                          }`}
                        />
                        <span className={chk.completed ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}>
                          {chk.label}
                        </span>
                        {chk.checkedBy && (
                          <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                            {chk.checkedBy}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Notes */}
              {selectedMaintWindow.executionNotes.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-[var(--color-text-primary)]">Operator Execution Notes:</span>
                  <div className="space-y-2">
                    {selectedMaintWindow.executionNotes.map((nt) => (
                      <div key={nt.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                          <span className="font-semibold text-[var(--color-text-primary)]">{nt.author} ({nt.role})</span>
                          <span>{formatDateTime(nt.timestamp)}</span>
                        </div>
                        <p className="text-[var(--color-text-secondary)]">{nt.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Logs */}
              <div className="space-y-2">
                <span className="font-semibold text-[var(--color-text-primary)]">Audit History:</span>
                <div className="relative pl-5 space-y-3 border-l-2 border-[var(--color-border)] ml-2">
                  {selectedMaintWindow.auditLogs.map((log) => (
                    <div key={log.id} className="relative space-y-0.5">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-blue-600" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--color-text-primary)]">{log.action}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{formatDateTime(log.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">By {log.actor}</p>
                      {log.details && <p className="text-[10px] text-[var(--color-text-muted)] italic">"{log.details}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
