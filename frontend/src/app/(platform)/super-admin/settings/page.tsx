"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Lock,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  ToggleLeft,
  Trash2,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  PlatformBrandingPreferences,
  PlatformPolicySettings,
  SecurityPolicy,
} from "../_types";
import {
  exportRowsToCsv,
  formatDateTime,
  isValidEmail,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

export default function PlatformSettingsPage() {
  const brandingPrefs = useSuperAdminStore((s) => s.brandingPrefs);
  const saveBrandingPrefs = useSuperAdminStore((s) => s.saveBrandingPrefs);
  const policySettings = useSuperAdminStore((s) => s.policySettings);
  const savePolicySettings = useSuperAdminStore((s) => s.savePolicySettings);
  const securityPolicies = useSuperAdminStore((s) => s.securityPolicies);
  const toggleSecurityPolicy = useSuperAdminStore((s) => s.toggleSecurityPolicy);
  const activities = useSuperAdminStore((s) => s.activities);
  const logActivity = useSuperAdminStore((s) => s.logActivity);
  const resetAllData = useSuperAdminStore((s) => s.resetAllData);

  const { can } = useAdminPermissions();
  const canConfigure = can("config.manage");

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "general" | "limits" | "security" | "notifications" | "data"
  >("general");

  // 1. General Branding State
  const [platformName, setPlatformName] = useState(brandingPrefs.platformName);
  const [supportEmail, setSupportEmail] = useState(brandingPrefs.supportEmail);
  const [supportPhone, setSupportPhone] = useState("+1 (800) 555-0199");
  const [helpCenterUrl, setHelpCenterUrl] = useState("https://help.prowise.io");
  const [statusPageUrl, setStatusPageUrl] = useState(brandingPrefs.statusPageUrl);
  const [defaultTimezone, setDefaultTimezone] = useState(brandingPrefs.defaultTimezone);
  const [defaultLanguage, setDefaultLanguage] = useState(brandingPrefs.defaultLanguage);
  const [dateFormat, setDateFormat] = useState<PlatformBrandingPreferences["dateFormat"]>(
    brandingPrefs.dateFormat
  );
  const [currencyDisplay, setCurrencyDisplay] =
    useState<PlatformBrandingPreferences["currencyDisplay"]>(brandingPrefs.currencyDisplay);
  const [compactDensity, setCompactDensity] = useState(brandingPrefs.compactDensity);

  // 2. Limits State
  const [checkinGraceWorkingDays, setCheckinGraceWorkingDays] = useState(
    policySettings.checkinGraceWorkingDays
  );
  const [staleWebhookMinutes, setStaleWebhookMinutes] = useState(
    policySettings.staleWebhookMinutes
  );
  const [auditRetentionDays, setAuditRetentionDays] = useState(
    policySettings.auditRetentionDays
  );
  const [autoSuspendAfterPastDueDays, setAutoSuspendAfterPastDueDays] = useState(
    policySettings.autoSuspendAfterPastDueDays
  );
  const [defaultTrialDays, setDefaultTrialDays] = useState(
    policySettings.defaultTrialDays
  );
  const [maxAttachmentMb, setMaxAttachmentMb] = useState(
    policySettings.maxAttachmentMb
  );
  const [maintenanceBannerMode, setMaintenanceBannerMode] = useState(
    policySettings.maintenanceBannerMode
  );

  // 3. Security State
  const [enforceMfaForOperators, setEnforceMfaForOperators] = useState(
    policySettings.enforceMfaForOperators
  );
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("30");
  const [maxFailedLogins, setMaxFailedLogins] = useState("5");
  const [passwordMinLength, setPasswordMinLength] = useState("10");

  // 4. Notifications State
  const [emailDigestFreq, setEmailDigestFreq] = useState("DAILY");
  const [notifySecurityBreach, setNotifySecurityBreach] = useState(true);
  const [notifyMaintenanceAdvance, setNotifyMaintenanceAdvance] = useState(true);
  const [incidentWebhookUrl, setIncidentWebhookUrl] = useState(
    "https://hooks.slack.com/services/T00/B00/X00EXAMPLE"
  );

  // Modals
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Sync state from stores on store update
  useEffect(() => {
    setPlatformName(brandingPrefs.platformName);
    setSupportEmail(brandingPrefs.supportEmail);
    setStatusPageUrl(brandingPrefs.statusPageUrl);
    setDefaultTimezone(brandingPrefs.defaultTimezone);
    setDefaultLanguage(brandingPrefs.defaultLanguage);
    setDateFormat(brandingPrefs.dateFormat);
    setCurrencyDisplay(brandingPrefs.currencyDisplay);
    setCompactDensity(brandingPrefs.compactDensity);
  }, [brandingPrefs]);

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

  // Tab 1: Save General Branding
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit modifying platform branding.");
      return;
    }
    if (platformName.trim().length < 2) {
      toast.error("Please enter a valid platform display name (at least 2 characters).");
      return;
    }
    if (!isValidEmail(supportEmail)) {
      toast.error("Please enter a valid customer support email address.");
      return;
    }
    if (!statusPageUrl.trim().startsWith("https://")) {
      toast.error("Status page web address must start with https://");
      return;
    }

    saveBrandingPrefs({
      platformName: platformName.trim(),
      supportEmail: supportEmail.trim(),
      statusPageUrl: statusPageUrl.trim(),
      defaultTimezone,
      defaultLanguage,
      dateFormat,
      currencyDisplay,
      compactDensity,
    });
    logActivity(
      "PLATFORM",
      "BRANDING_SAVED",
      `Saved platform branding and localization preferences (${platformName.trim()})`,
      "INFO"
    );
    toast.success("Platform branding and localization preferences saved successfully.");
  };

  // Tab 2: Save System Limits
  const handleSaveLimits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit changing global system limits.");
      return;
    }
    if (defaultTrialDays < 1 || defaultTrialDays > 90) {
      toast.error("Trial duration must be between 1 and 90 days.");
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
      toast.error("Max attachment size must be between 1 MB and 250 MB.");
      return;
    }

    savePolicySettings({
      checkinGraceWorkingDays,
      staleWebhookMinutes,
      auditRetentionDays,
      autoSuspendAfterPastDueDays,
      defaultTrialDays,
      maxAttachmentMb,
      maintenanceBannerMode,
    });
    logActivity(
      "PLATFORM",
      "SYSTEM_LIMITS_SAVED",
      "Saved global system limits and tenant operational rules",
      "INFO"
    );
    toast.success("Global system limits and operational rules updated.");
  };

  // Tab 3: Save Security Policies
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit updating security policies.");
      return;
    }
    savePolicySettings({
      enforceMfaForOperators,
    });
    logActivity(
      "SECURITY",
      "SECURITY_POLICIES_UPDATED",
      `Updated platform security policies (MFA enforced: ${enforceMfaForOperators ? "YES" : "NO"})`,
      "INFO"
    );
    toast.success("Security & authentication policies saved.");
  };

  // Tab 4: Save Notifications
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit updating notification settings.");
      return;
    }
    logActivity(
      "COMMUNICATION",
      "NOTIFICATIONS_SETTINGS_SAVED",
      `Saved platform alert defaults (Digest: ${emailDigestFreq})`,
      "INFO"
    );
    toast.success("Notification preferences and webhook routing saved.");
  };

  // Trigger Test Alert Simulation
  const handleTestAlert = () => {
    toast.info("Sending simulated critical system alert to operators...");
    setTimeout(() => {
      toast.success(
        "Test alert successfully delivered to superadmin@prowise.io and alert webhook endpoint."
      );
    }, 450);
  };

  // Tab 5: Data Exports & Diagnostic Actions
  const handleExportConfigJson = () => {
    const configSnapshot = {
      exportedAt: new Date().toISOString(),
      brandingPreferences: brandingPrefs,
      policySettings,
      securityPolicies,
      activeTimezone: defaultTimezone,
      systemLanguage: defaultLanguage,
    };
    const blob = new Blob([JSON.stringify(configSnapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prowise-platform-configuration-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Platform configuration exported as JSON.");
  };

  const handleExportAuditCsv = () => {
    exportRowsToCsv(
      `prowise-audit-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Timestamp", "Category", "Action", "Summary", "Actor", "Severity", "Target"],
      activities.map((a) => [
        a.timestamp,
        a.category,
        a.action,
        a.summary,
        a.actorName,
        a.severity,
        a.targetLabel || "",
      ])
    );
    toast.success("Audit & activity telemetry exported as CSV.");
  };

  const handleFlushCache = () => {
    toast.info("Flushing system distributed cache buffers...");
    setTimeout(() => {
      toast.success("Distributed session and webhook cache buffers successfully cleared.");
    }, 400);
  };

  const handleConfirmReset = () => {
    resetAllData();
    setConfirmResetOpen(false);
    toast.success("Platform data and configurations restored to initial seed state.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Platform Settings & Governance Hub"
        badge="Platform Authority"
        simulationLabel="Persisted Settings Engine"
        description="Configure customer-facing platform branding, system limits, session security safeguards, executive email digests, and diagnostics."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleExportConfigJson}
            >
              <Download className="w-4 h-4 text-blue-600" />
              Export Config (JSON)
            </AdminButton>
            <AdminButton
              variant="subtle"
              size="sm"
              onClick={handleFlushCache}
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              Flush Cache
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Central Platform Configuration"
        description="Preferences saved here apply globally across all tenant workspaces, email receipt footers, and operator governance consoles in real time."
      />

      {/* 2. Primary Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-2 bg-[var(--color-surface)] px-4 rounded-xl border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "general"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Branding &amp; Localization</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("limits")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "limits"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System Limits &amp; Safeguards</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "security"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security &amp; Access Policies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "notifications"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications &amp; Alerts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("data")}
          className={`py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "data"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data &amp; Diagnostics</span>
        </button>
      </div>

      {/* =========================================================================
       * TAB 1: BRANDING & LOCALIZATION
       * ========================================================================= */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <SurfaceCard className="p-4 sm:p-6 xl:col-span-2">
            <form onSubmit={handleSaveBranding} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Platform Identity &amp; Support Contacts
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Last updated {formatDateTime(brandingPrefs.updatedAt)}
                    </p>
                  </div>
                </div>
                <AdminButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setPlatformName(brandingPrefs.platformName);
                    setSupportEmail(brandingPrefs.supportEmail);
                    setStatusPageUrl(brandingPrefs.statusPageUrl);
                    setDefaultTimezone(brandingPrefs.defaultTimezone);
                    setDefaultLanguage(brandingPrefs.defaultLanguage);
                    setDateFormat(brandingPrefs.dateFormat);
                    setCurrencyDisplay(brandingPrefs.currencyDisplay);
                    setCompactDensity(brandingPrefs.compactDensity);
                    toast.info("Restored saved branding preferences.");
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </AdminButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminInput
                  label="Platform Display Name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="ProWise Cloud"
                  helperText="Shown in customer onboarding headers and invoice documents."
                />
                <AdminInput
                  label="Customer Support Email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@prowise.io"
                  helperText="Reply-to address for billing receipts and customer notices."
                />
                <AdminInput
                  label="Support Phone / Hotline"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+1 (800) 555-0199"
                  helperText="Customer emergency escalation phone contact."
                />
                <AdminInput
                  label="Help Center Web Address"
                  value={helpCenterUrl}
                  onChange={(e) => setHelpCenterUrl(e.target.value)}
                  placeholder="https://help.prowise.io"
                  helperText="Direct documentation link in customer navigation."
                />
                <div className="sm:col-span-2">
                  <AdminInput
                    label="Public Status Page Web Address"
                    value={statusPageUrl}
                    onChange={(e) => setStatusPageUrl(e.target.value)}
                    placeholder="https://status.prowise.io"
                    helperText="Where customers can inspect live uptime and maintenance windows."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                <Globe className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Regional Formats &amp; Defaults
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminSelect
                  label="Default Platform Timezone"
                  value={defaultTimezone}
                  onChange={(e) => setDefaultTimezone(e.target.value)}
                  options={[
                    { label: "UTC (Coordinated Universal Time)", value: "UTC" },
                    { label: "America/New_York (Eastern Time)", value: "America/New_York" },
                    { label: "America/Los_Angeles (Pacific Time)", value: "America/Los_Angeles" },
                    { label: "Europe/London (UK)", value: "Europe/London" },
                    { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
                    { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                    { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
                    { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
                    { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },
                  ]}
                />
                <AdminSelect
                  label="Default System Language"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  options={[
                    { label: "English (US)", value: "English (US)" },
                    { label: "English (UK)", value: "English (UK)" },
                    { label: "German (Deutsch)", value: "German (Deutsch)" },
                    { label: "French (Français)", value: "French (Français)" },
                    { label: "Spanish (Español)", value: "Spanish (Español)" },
                    { label: "Japanese (日本語)", value: "Japanese (日本語)" },
                  ]}
                />
                <AdminSelect
                  label="Date Display Format"
                  value={dateFormat}
                  onChange={(e) =>
                    setDateFormat(
                      e.target.value as PlatformBrandingPreferences["dateFormat"]
                    )
                  }
                  options={[
                    { label: "MMM DD, YYYY (Nov 19, 2026)", value: "MMM DD, YYYY" },
                    { label: "YYYY-MM-DD (2026-11-19)", value: "YYYY-MM-DD" },
                    { label: "DD/MM/YYYY (19/11/2026)", value: "DD/MM/YYYY" },
                  ]}
                />
                <AdminSelect
                  label="Default Billing Currency"
                  value={currencyDisplay}
                  onChange={(e) =>
                    setCurrencyDisplay(
                      e.target.value as PlatformBrandingPreferences["currencyDisplay"]
                    )
                  }
                  options={[
                    { label: "USD ($) — US Dollar", value: "USD ($)" },
                    { label: "EUR (€) — Euro", value: "EUR (€)" },
                    { label: "GBP (£) — British Pound", value: "GBP (£)" },
                  ]}
                />
              </div>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    Prefer Compact Table Density by Default
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">
                    Fits more rows on laptop and desktop displays across Super Admin tables.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={compactDensity}
                  onChange={(e) => setCompactDensity(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-blue-600"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  permissionLocked={!canConfigure}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Branding Preferences
                </AdminButton>
              </div>
            </form>
          </SurfaceCard>

          {/* Live Identity & Customer Receipt Preview */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Customer Document &amp; Footer Preview
              </h3>
              <StatusBadge label="Live Preview" tone="info" />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                <div className="h-8 w-8 rounded-lg bg-[#1A73E8] text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                  {(platformName || "P").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text-primary)] truncate">
                    {platformName || "ProWise"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {defaultLanguage} · {defaultTimezone}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-[var(--color-text-secondary)]">
                <div className="flex justify-between gap-2">
                  <span>Date Display:</span>
                  <strong className="text-[var(--color-text-primary)]">{dateFormat}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Billing Currency:</span>
                  <strong className="text-[var(--color-text-primary)]">{currencyDisplay}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Layout Density:</span>
                  <strong className="text-[var(--color-text-primary)]">
                    {compactDensity ? "Compact" : "Comfortable"}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Hotline:</span>
                  <strong className="text-[var(--color-text-primary)]">{supportPhone}</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] space-y-1 text-[11px] text-[var(--color-text-muted)]">
                <p>
                  Customer support:{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {supportEmail || "support@prowise.io"}
                  </span>
                </p>
                <p>
                  Live platform status:{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-medium break-all">
                    {statusPageUrl || "https://status.prowise.io"}
                  </span>
                </p>
                <p>
                  Help documentation:{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-medium break-all">
                    {helpCenterUrl}
                  </span>
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* =========================================================================
       * TAB 2: SYSTEM LIMITS & GOVERNANCE
       * ========================================================================= */}
      {activeTab === "limits" && (
        <SurfaceCard className="p-4 sm:p-6 max-w-4xl">
          <form onSubmit={handleSaveLimits} className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Global System Safeguards &amp; Operational Thresholds
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Enforces automated tenant governance, storage caps, and webhook latency monitors.
                </p>
              </div>
              <AdminButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setCheckinGraceWorkingDays(policySettings.checkinGraceWorkingDays);
                  setStaleWebhookMinutes(policySettings.staleWebhookMinutes);
                  setAuditRetentionDays(policySettings.auditRetentionDays);
                  setAutoSuspendAfterPastDueDays(policySettings.autoSuspendAfterPastDueDays);
                  setDefaultTrialDays(policySettings.defaultTrialDays);
                  setMaxAttachmentMb(policySettings.maxAttachmentMb);
                  setMaintenanceBannerMode(policySettings.maintenanceBannerMode);
                  toast.info("Restored saved limits.");
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </AdminButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput
                label="Check-in Grace Working Days"
                type="number"
                value={checkinGraceWorkingDays}
                onChange={(e) => setCheckinGraceWorkingDays(Number(e.target.value))}
                helperText="Working days before a project is flagged past due for developer progress."
              />
              <AdminInput
                label="Stale Webhook Alert Threshold (Minutes)"
                type="number"
                value={staleWebhookMinutes}
                onChange={(e) => setStaleWebhookMinutes(Number(e.target.value))}
                helperText="Alerts operators if incoming GitHub or billing webhooks lag."
              />
              <AdminInput
                label="Audit Log Retention Period (Days)"
                type="number"
                value={auditRetentionDays}
                onChange={(e) => setAuditRetentionDays(Number(e.target.value))}
                helperText="How long platform security &amp; audit trails are stored."
              />
              <AdminInput
                label="Maximum File Attachment Size (MB)"
                type="number"
                value={maxAttachmentMb}
                onChange={(e) => setMaxAttachmentMb(Number(e.target.value))}
                helperText="Storage limit for specification documents and evidence attachments."
              />
              <AdminInput
                label="Default Free Trial Duration (Days)"
                type="number"
                value={defaultTrialDays}
                onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
                helperText="Initial trial window granted to newly self-registered organizations."
              />
              <AdminInput
                label="Auto-Suspend Past Due Account Threshold (Days)"
                type="number"
                value={autoSuspendAfterPastDueDays}
                onChange={(e) => setAutoSuspendAfterPastDueDays(Number(e.target.value))}
                helperText="Grace period before delinquent subscription workspaces are locked."
              />
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    Persistent Maintenance Banner Mode
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">
                    Pin high-visibility notice banners to customer workspaces during planned windows.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceBannerMode}
                  onChange={(e) => setMaintenanceBannerMode(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-blue-600"
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
                Save System Limits
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* =========================================================================
       * TAB 3: SECURITY & ACCESS POLICIES
       * ========================================================================= */}
      {activeTab === "security" && (
        <div className="space-y-6 max-w-4xl">
          <SurfaceCard className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Privileged Access &amp; Session Policies
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Mandatory verification rules for Super Admins and Platform Operators.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <AdminSelect
                  label="Session Inactivity Timeout"
                  value={sessionTimeoutMinutes}
                  onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
                  options={[
                    { label: "15 Minutes (High Security)", value: "15" },
                    { label: "30 Minutes (Recommended)", value: "30" },
                    { label: "60 Minutes (Standard)", value: "60" },
                    { label: "120 Minutes (Extended)", value: "120" },
                  ]}
                />
                <AdminSelect
                  label="Max Failed Sign-In Attempts"
                  value={maxFailedLogins}
                  onChange={(e) => setMaxFailedLogins(e.target.value)}
                  options={[
                    { label: "3 Attempts (Strict)", value: "3" },
                    { label: "5 Attempts (Standard)", value: "5" },
                    { label: "10 Attempts (Permissive)", value: "10" },
                  ]}
                />
                <AdminSelect
                  label="Minimum Password Length"
                  value={passwordMinLength}
                  onChange={(e) => setPasswordMinLength(e.target.value)}
                  options={[
                    { label: "8 Characters", value: "8" },
                    { label: "10 Characters (Standard)", value: "10" },
                    { label: "12 Characters (Strong)", value: "12" },
                    { label: "14 Characters (Government)", value: "14" },
                  ]}
                />
              </div>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    Enforce Multi-Factor Authentication (MFA) for Operators
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">
                    Blocks operator console access if TOTP hardware authenticator is not enrolled.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enforceMfaForOperators}
                  onChange={(e) => setEnforceMfaForOperators(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-blue-600"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  permissionLocked={!canConfigure}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Session Policies
                </AdminButton>
              </div>
            </form>
          </SurfaceCard>

          {/* Granular Active Security Policies Table */}
          <SurfaceCard className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Active Platform Security Safeguards
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Toggle individual automated runtime protection barriers.
                </p>
              </div>
              <StatusBadge
                label={`${securityPolicies.filter((p) => p.enabled).length}/${securityPolicies.length} Active`}
                tone="success"
              />
            </div>

            <div className="space-y-3">
              {securityPolicies.map((pol) => (
                <div
                  key={pol.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {pol.title}
                      </span>
                      <StatusBadge
                        label={pol.enabled ? "Enforced" : "Disabled"}
                        tone={pol.enabled ? "success" : "neutral"}
                        dot
                      />
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {pol.description}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <AdminButton
                      size="xs"
                      variant={pol.enabled ? "outline" : "primary"}
                      permissionLocked={!canConfigure}
                      onClick={() => {
                        toggleSecurityPolicy(pol.id);
                        toast.success(`Security policy "${pol.title}" updated.`);
                      }}
                    >
                      {pol.enabled ? "Disable Policy" : "Enable Policy"}
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* =========================================================================
       * TAB 4: NOTIFICATIONS & ALERTS
       * ========================================================================= */}
      {activeTab === "notifications" && (
        <SurfaceCard className="p-4 sm:p-6 max-w-4xl">
          <form onSubmit={handleSaveNotifications} className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Platform Event Routing &amp; Email Digests
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Configure automated notifications sent to administrative inboxes and webhook endpoints.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminSelect
                label="Executive Delivery &amp; Operational Digest Frequency"
                value={emailDigestFreq}
                onChange={(e) => setEmailDigestFreq(e.target.value)}
                options={[
                  { label: "Daily Executive Summary (08:00 UTC)", value: "DAILY" },
                  { label: "Weekly Platform Digest (Monday 08:00 UTC)", value: "WEEKLY" },
                  { label: "Disabled (Off)", value: "OFF" },
                ]}
              />

              <AdminInput
                label="Incident &amp; Escalation Alert Webhook"
                value={incidentWebhookUrl}
                onChange={(e) => setIncidentWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                helperText="Dispatches instant JSON alerts for Sev-1 platform incidents."
              />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[var(--color-border)]">
              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifySecurityBreach}
                  onChange={(e) => setNotifySecurityBreach(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--color-border)] text-blue-600"
                />
                <div>
                  <span className="font-semibold text-xs text-[var(--color-text-primary)] block">
                    Immediate Critical Security Alert Broadcasts
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Send urgent alerts when unrecognized login bursts or rate limit violations occur.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyMaintenanceAdvance}
                  onChange={(e) => setNotifyMaintenanceAdvance(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--color-border)] text-blue-600"
                />
                <div>
                  <span className="font-semibold text-xs text-[var(--color-text-primary)] block">
                    Scheduled Maintenance 24h Advance Warning Broadcasts
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Automatically emails customer organization admins before scheduled downtime.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] flex-wrap gap-2">
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestAlert}
              >
                <Send className="w-3.5 h-3.5 text-blue-500" />
                Dispatch Test Alert
              </AdminButton>

              <AdminButton
                type="submit"
                variant="primary"
                size="sm"
                permissionLocked={!canConfigure}
              >
                <Save className="w-3.5 h-3.5" />
                Save Notification Settings
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* =========================================================================
       * TAB 5: DATA MANAGEMENT & DIAGNOSTICS
       * ========================================================================= */}
      {activeTab === "data" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-5xl">
          {/* Backups & JSON Config Export */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
              <FileCode className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Platform Configuration Snapshots
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Export all system limits, feature rollout flags, localization branding, and governance policies as a structured JSON snapshot for auditing or backup.
            </p>
            <div className="pt-2">
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleExportConfigJson}
              >
                <Download className="w-3.5 h-3.5" />
                Download Configuration (JSON)
              </AdminButton>
            </div>
          </SurfaceCard>

          {/* Audit Telemetry CSV Export */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Operational Telemetry &amp; Logs
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Download complete platform operational audit records, including tenant creations, role updates, and maintenance overrides, as an RFC-4180 CSV spreadsheet.
            </p>
            <div className="pt-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={handleExportAuditCsv}
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Export Audit Telemetry (CSV)
              </AdminButton>
            </div>
          </SurfaceCard>

          {/* Cache Maintenance */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Distributed Cache Flush
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Force an immediate invalidation of platform memory caches, webhook signature verifiers, and role preview states.
            </p>
            <div className="pt-2">
              <AdminButton
                variant="subtle"
                size="sm"
                onClick={handleFlushCache}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Flush Platform Cache
              </AdminButton>
            </div>
          </SurfaceCard>

          {/* Factory Reset */}
          <SurfaceCard className="p-4 sm:p-5 space-y-4 border-rose-500/30 bg-rose-500/[0.03]">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Restore Factory Seed Defaults
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Reset all organizations, operators, subscriptions, and platform settings back to pristine demo state.
            </p>
            <div className="pt-2">
              <AdminButton
                variant="danger"
                size="sm"
                permissionLocked={!canConfigure}
                onClick={() => setConfirmResetOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Platform Data to Seed
              </AdminButton>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* FACTORY RESET CONFIRMATION MODAL */}
      <ConfirmActionModal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset All Platform Data to Initial Factory State?"
        description="This will restore all simulated tenants, subscriptions, operators, and platform configuration back to initial default seed values. Any custom modifications will be reset."
        confirmLabel="Reset Platform Data"
        variant="danger"
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
