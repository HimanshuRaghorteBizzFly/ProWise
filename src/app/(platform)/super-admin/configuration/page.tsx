"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  Sliders,
  ToggleLeft,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { PlatformFeatureFlag } from "../_types";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  ConfirmActionModal,
  KpiCard,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

export default function PlatformConfigurationPage() {
  const policySettings = useSuperAdminStore((s) => s.policySettings);
  const savePolicySettings = useSuperAdminStore((s) => s.savePolicySettings);
  const toggleFeatureFlag = useSuperAdminStore((s) => s.toggleFeatureFlag);

  const { can } = useAdminPermissions();
  const canConfigure = can("config.manage");

  const [checkinGraceWorkingDays, setCheckinGraceWorkingDays] = useState(
    policySettings.checkinGraceWorkingDays
  );
  const [staleWebhookMinutes, setStaleWebhookMinutes] = useState(
    policySettings.staleWebhookMinutes
  );
  const [auditRetentionDays, setAuditRetentionDays] = useState(
    policySettings.auditRetentionDays
  );
  const [enforceMfaForOperators, setEnforceMfaForOperators] = useState(
    policySettings.enforceMfaForOperators
  );
  const [autoSuspendAfterPastDueDays, setAutoSuspendAfterPastDueDays] = useState(
    policySettings.autoSuspendAfterPastDueDays
  );
  const [defaultTrialDays, setDefaultTrialDays] = useState(policySettings.defaultTrialDays);
  const [maxAttachmentMb, setMaxAttachmentMb] = useState(policySettings.maxAttachmentMb);
  const [maintenanceBannerMode, setMaintenanceBannerMode] = useState(
    policySettings.maintenanceBannerMode
  );

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
      <PageHeader
        title="Platform Configuration"
        badge="Global Rules"
        simulationLabel="Persisted Local Config"
        description="Manage global system limits, automated billing grace windows, compliance retention, and feature availability across customer workspaces."
      />

      <SimulationNotice
        title="Guided Controls"
        description="All limits and feature toggles use validated plain-language controls and persist in browser storage until connected to Spring Boot configuration APIs."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Default Trial Period"
          value={`${policySettings.defaultTrialDays} days`}
          sublabel="Applied to newly created trials"
          icon={Sliders}
          tone="blue"
        />
        <KpiCard
          label="Enabled Feature Flags"
          value={`${enabledFlagsCount} / ${policySettings.featureFlags.length}`}
          sublabel="Capabilities active across ProWise"
          icon={ToggleLeft}
          tone="emerald"
        />
        <KpiCard
          label="Audit Log Retention"
          value={`${policySettings.auditRetentionDays} days`}
          sublabel="Minimum compliance history window"
          icon={CheckCircle2}
          tone="violet"
        />
        <KpiCard
          label="Maintenance Banner"
          value={policySettings.maintenanceBannerMode ? "Visible" : "Hidden"}
          sublabel={
            policySettings.maintenanceBannerMode
              ? "Customers see planned maintenance notice"
              : "Normal operating status"
          }
          icon={AlertTriangle}
          tone={policySettings.maintenanceBannerMode ? "amber" : "slate"}
        />
      </div>

      {/* Global Operational Limits Form */}
      <SurfaceCard className="p-4 sm:p-6">
        <form onSubmit={validateAndRequestSave} className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Global System Limits & Safeguards
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
                  Display Platform Maintenance Banner
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] block">
                  Shows a non-intrusive maintenance notice across customer dashboards during planned windows.
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

      {/* Feature Flags */}
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

      <ConfirmActionModal
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        title="Apply Global Platform Limits?"
        description="Saving these limits updates platform-wide billing thresholds, trial defaults, and security enforcement rules, and records an entry in the audit log."
        confirmLabel="Save Configuration"
        variant="primary"
        onConfirm={handleConfirmSave}
      />

      <ConfirmActionModal
        isOpen={Boolean(pendingFlag)}
        onClose={() => setPendingFlag(null)}
        title={
          pendingFlag?.enabled
            ? `Disable "${pendingFlag.label}"?`
            : `Enable "${pendingFlag?.label}"?`
        }
        description={
          pendingFlag
            ? `This changes availability for "${pendingFlag.audience}" immediately and logs an administrative audit event.`
            : ""
        }
        confirmLabel={pendingFlag?.enabled ? "Disable Feature" : "Enable Feature"}
        variant={pendingFlag?.enabled ? "danger" : "primary"}
        onConfirm={() => {
          if (pendingFlag) {
            toggleFeatureFlag(pendingFlag.id);
            toast.success(
              `Feature "${pendingFlag.label}" ${pendingFlag.enabled ? "disabled" : "enabled"}.`
            );
          }
        }}
      />
    </div>
  );
}
