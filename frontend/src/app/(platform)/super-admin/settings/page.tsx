"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Palette, RotateCcw, Save } from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { PlatformBrandingPreferences } from "../_types";
import { formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

export default function PlatformSettingsPage() {
  const brandingPrefs = useSuperAdminStore((s) => s.brandingPrefs);
  const saveBrandingPrefs = useSuperAdminStore((s) => s.saveBrandingPrefs);

  const { can } = useAdminPermissions();
  const canConfigure = can("config.manage");

  const [platformName, setPlatformName] = useState(brandingPrefs.platformName);
  const [supportEmail, setSupportEmail] = useState(brandingPrefs.supportEmail);
  const [statusPageUrl, setStatusPageUrl] = useState(brandingPrefs.statusPageUrl);
  const [defaultTimezone, setDefaultTimezone] = useState(brandingPrefs.defaultTimezone);
  const [defaultLanguage, setDefaultLanguage] = useState(brandingPrefs.defaultLanguage);
  const [dateFormat, setDateFormat] = useState<PlatformBrandingPreferences["dateFormat"]>(
    brandingPrefs.dateFormat
  );
  const [currencyDisplay, setCurrencyDisplay] =
    useState<PlatformBrandingPreferences["currencyDisplay"]>(brandingPrefs.currencyDisplay);
  const [compactDensity, setCompactDensity] = useState(brandingPrefs.compactDensity);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) {
      toast.error("Your role does not permit changing platform branding or localization.");
      return;
    }
    if (platformName.trim().length < 2) {
      toast.error("Please enter a valid platform display name.");
      return;
    }
    if (!isValidEmail(supportEmail)) {
      toast.error("Please enter a valid customer support email address.");
      return;
    }
    if (!statusPageUrl.trim().startsWith("https://")) {
      toast.error("Status page link must begin with https://");
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
    toast.success("Platform branding and localization preferences saved.");
  };

  const handleReset = () => {
    setPlatformName(brandingPrefs.platformName);
    setSupportEmail(brandingPrefs.supportEmail);
    setStatusPageUrl(brandingPrefs.statusPageUrl);
    setDefaultTimezone(brandingPrefs.defaultTimezone);
    setDefaultLanguage(brandingPrefs.defaultLanguage);
    setDateFormat(brandingPrefs.dateFormat);
    setCurrencyDisplay(brandingPrefs.currencyDisplay);
    setCompactDensity(brandingPrefs.compactDensity);
    toast.info("Restored saved preferences.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        badge="Branding & Localization"
        simulationLabel="Persisted Local Preferences"
        description="Customize customer-facing platform identity, support contact details, and regional date, time, and currency formats."
      />

      <SimulationNotice
        title="Default Tenant Experience"
        description="These preferences determine default regional formatting and support links displayed on invoices, onboarding emails, and help dialogs."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6 xl:col-span-2">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-500" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Branding & Customer Support Links
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Last updated {formatDateTime(brandingPrefs.updatedAt)}
                  </p>
                </div>
              </div>
              <AdminButton type="button" variant="ghost" size="xs" onClick={handleReset}>
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
              <div className="sm:col-span-2">
                <AdminInput
                  label="Public Status Page Web Address"
                  value={statusPageUrl}
                  onChange={(e) => setStatusPageUrl(e.target.value)}
                  placeholder="https://status.prowise.io"
                  helperText="Where customers can check service availability updates."
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
              <Globe className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Localization & Regional Formats
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
                  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                  { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
                ]}
              />
              <AdminSelect
                label="Default Language"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                options={[
                  { label: "English (US)", value: "English (US)" },
                  { label: "English (UK)", value: "English (UK)" },
                  { label: "German (Deutsch)", value: "German (Deutsch)" },
                  { label: "French (Français)", value: "French (Français)" },
                ]}
              />
              <AdminSelect
                label="Date Display Format"
                value={dateFormat}
                onChange={(e) =>
                  setDateFormat(e.target.value as PlatformBrandingPreferences["dateFormat"])
                }
                options={[
                  { label: "MMM DD, YYYY (Nov 12, 2026)", value: "MMM DD, YYYY" },
                  { label: "YYYY-MM-DD (2026-11-12)", value: "YYYY-MM-DD" },
                  { label: "DD/MM/YYYY (12/11/2026)", value: "DD/MM/YYYY" },
                ]}
              />
              <AdminSelect
                label="Default Billing Currency"
                value={currencyDisplay}
                onChange={(e) =>
                  setCurrencyDisplay(e.target.value as PlatformBrandingPreferences["currencyDisplay"])
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
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
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
                Save Preferences
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>

        {/* Live Identity Preview */}
        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Customer Footer & Receipt Preview
            </h3>
            <StatusBadge label="Live Preview" tone="info" />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
              <div className="h-8 w-8 rounded-lg bg-[#1A73E8] text-white font-bold flex items-center justify-center text-sm shrink-0">
                {(platformName || "P").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)] truncate">
                  {platformName || "ProWise Cloud"}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {defaultLanguage} · {defaultTimezone}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-[var(--color-text-secondary)]">
              <div className="flex justify-between gap-2">
                <span>Date Format:</span>
                <strong className="text-[var(--color-text-primary)]">{dateFormat}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Billing Currency:</span>
                <strong className="text-[var(--color-text-primary)]">{currencyDisplay}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Table Spacing:</span>
                <strong className="text-[var(--color-text-primary)]">
                  {compactDensity ? "Compact" : "Comfortable"}
                </strong>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--color-border)] space-y-1 text-[11px] text-[var(--color-text-muted)]">
              <p>
                Need help? Contact{" "}
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {supportEmail || "support@prowise.io"}
                </span>
              </p>
              <p>
                Service status:{" "}
                <span className="text-blue-600 dark:text-blue-400 font-medium break-all">
                  {statusPageUrl || "https://status.prowise.io"}
                </span>
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
