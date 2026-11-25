"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, KeyRound, Palette, RefreshCw, RotateCcw, Save, Sliders } from "lucide-react";
import type { PlatformApi } from "@/lib/admin-api/platform";
import type { BrandingInput, PlatformBranding } from "@/types/admin-platform";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, type ResourceState } from "./admin-resource";
import { InfoRow, MutationErrorBanner, useMutation } from "./platform-shared";

export type SettingsApi = Pick<PlatformApi, "branding">;

const LANGUAGES = ["English (US)", "English (UK)", "German (Deutsch)", "French (Français)", "Spanish (Español)", "Japanese (日本語)"];
const DATE_FORMATS = ["MMM DD, YYYY", "YYYY-MM-DD", "DD/MM/YYYY"];
const CURRENCIES = ["USD ($)", "EUR (€)", "GBP (£)"];
const FALLBACK_ZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

/** IANA zones known to this browser, plus the stored value so it is never silently replaced. */
function timeZoneOptions(current: string | null): string[] {
  let zones: string[] = FALLBACK_ZONES;
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    if (typeof intl.supportedValuesOf === "function") zones = ["UTC", ...intl.supportedValuesOf("timeZone")];
  } catch {
    /* keep the short list */
  }
  return Array.from(new Set([...(current ? [current] : []), ...zones]));
}

/** Choices plus the stored value (kept even when it is not in the list). */
function withCurrent(list: string[], current: string | null): { label: string; value: string }[] {
  return Array.from(new Set([...(current ? [current] : []), ...list])).map((v) => ({ label: v, value: v }));
}

export function brandingInputFrom(b: PlatformBranding): BrandingInput {
  return {
    platform_name: b.platform_name,
    support_email: b.support_email,
    status_page_url: b.status_page_url,
    default_timezone: b.default_timezone,
    default_language: b.default_language,
    date_format: b.date_format,
    currency_display: b.currency_display,
    compact_density: b.compact_density,
  };
}

function validateBranding(input: BrandingInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.platform_name.trim()) errors.platform_name = "A platform name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.support_email.trim())) errors.support_email = "Enter a valid email address.";
  const url = (input.status_page_url ?? "").trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) errors.status_page_url = "Enter a full http(s) address, or leave empty.";
  return errors;
}

export interface SettingsViewProps {
  state: ResourceState<PlatformBranding>;
  onRetry: () => void;
  api: SettingsApi;
}

export function SettingsView({ state, onRetry, api }: SettingsViewProps) {
  const data = state.status === "ready" ? state.data : null;
  const [form, setForm] = useState<BrandingInput | null>(data ? brandingInputFrom(data) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation();
  const zones = useMemo(() => timeZoneOptions(data?.default_timezone ?? null), [data?.default_timezone]);

  useEffect(() => {
    setForm(data ? brandingInputFrom(data) : null);
    setErrors({});
  }, [data]);

  const set = (patch: Partial<BrandingInput>) => form && setForm({ ...form, ...patch });
  const err = (field: string) => errors[field] ?? save.failure?.fieldErrors[field];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !data) return;
    const cleaned: BrandingInput = {
      ...form,
      platform_name: form.platform_name.trim(),
      support_email: form.support_email.trim(),
      status_page_url: (form.status_page_url ?? "").trim() || null,
    };
    const found = validateBranding(cleaned);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await save.run(() => api.branding.update(cleaned, data.version))) {
      toast.success("Platform settings saved.");
      onRetry();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Platform branding, support contacts and regional defaults. Saved on the server and applied across the platform."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/super-admin/security-keys">
              <AdminButton variant="outline" size="sm">
                <KeyRound className="w-4 h-4 text-purple-600" />
                Platform Keys
              </AdminButton>
            </Link>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
          </div>
        }
      />

      {(!data || !form) && (
        <SurfaceCard className="overflow-hidden">
          <ResourceStatus state={state} isEmpty={() => false} onRetry={onRetry} emptyTitle="" emptyDescription="" />
        </SurfaceCard>
      )}

      {data && form && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <SurfaceCard className="p-4 sm:p-6 xl:col-span-2">
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Platform Identity &amp; Support Contacts</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">Last updated {formatInstant(data.updated_at)}</p>
                  </div>
                </div>
                <AdminButton type="button" variant="ghost" size="xs" onClick={() => { setForm(brandingInputFrom(data)); setErrors({}); save.clear(); }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </AdminButton>
              </div>

              <MutationErrorBanner failure={save.failure} onReload={() => { save.clear(); onRetry(); }} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminInput label="Platform Display Name" value={form.platform_name} onChange={(e) => set({ platform_name: e.target.value })} error={err("platform_name")} />
                <AdminInput label="Customer Support Email" type="email" value={form.support_email} onChange={(e) => set({ support_email: e.target.value })} error={err("support_email")} />
                <div className="sm:col-span-2">
                  <AdminInput
                    label="Public Status Page Web Address"
                    value={form.status_page_url ?? ""}
                    onChange={(e) => set({ status_page_url: e.target.value })}
                    placeholder="https://"
                    error={err("status_page_url")}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                <Globe className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Regional Formats &amp; Defaults</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminSelect label="Default Platform Timezone" value={form.default_timezone ?? ""} onChange={(e) => set({ default_timezone: e.target.value })} options={zones.map((z) => ({ label: z, value: z }))} error={err("default_timezone")} />
                <AdminSelect label="Default System Language" value={form.default_language ?? ""} onChange={(e) => set({ default_language: e.target.value })} options={withCurrent(LANGUAGES, data.default_language)} error={err("default_language")} />
                <AdminSelect label="Date Display Format" value={form.date_format ?? ""} onChange={(e) => set({ date_format: e.target.value })} options={withCurrent(DATE_FORMATS, data.date_format)} error={err("date_format")} />
                <AdminSelect label="Default Currency Display" value={form.currency_display ?? ""} onChange={(e) => set({ currency_display: e.target.value })} options={withCurrent(CURRENCIES, data.currency_display)} error={err("currency_display")} />
              </div>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
                <span>
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">Prefer compact table density by default</span>
                  <span className="text-xs text-[var(--color-text-secondary)] block">Fits more rows on laptop and desktop displays.</span>
                </span>
                <input type="checkbox" checked={form.compact_density} onChange={(e) => set({ compact_density: e.target.checked })} className="mt-1 h-4 w-4" />
              </label>

              <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
                <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>
                  <Save className="w-3.5 h-3.5" />
                  Save Settings
                </AdminButton>
              </div>
            </form>
          </SurfaceCard>

          <div className="space-y-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Customer Footer Preview</h3>
                <StatusBadge label="Unsaved edits shown" tone="info" />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                  <div className="h-8 w-8 rounded-lg bg-[#1A73E8] text-white font-bold flex items-center justify-center text-sm shrink-0">
                    {(form.platform_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate">{form.platform_name || "-"}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {form.default_language || "-"} · {form.default_timezone || "-"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <InfoRow label="Date display" value={form.date_format || "-"} />
                  <InfoRow label="Currency display" value={form.currency_display || "-"} />
                  <InfoRow label="Layout density" value={form.compact_density ? "Compact" : "Comfortable"} />
                </div>
                <div className="pt-3 border-t border-[var(--color-border)] space-y-1 text-[11px] text-[var(--color-text-muted)]">
                  <p>Customer support: <span className="text-blue-600 dark:text-blue-400 font-medium">{form.support_email || "-"}</span></p>
                  <p>Platform status: <span className="text-blue-600 dark:text-blue-400 font-medium break-all">{form.status_page_url || "-"}</span></p>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Related settings</h3>
              <Link href="/super-admin/configuration" className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-hover)]">
                <Sliders className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  <span className="font-semibold text-[var(--color-text-primary)] block">Platform Configuration</span>
                  <span className="text-[var(--color-text-secondary)]">System limits, operator MFA policy, feature flags and licenses.</span>
                </span>
              </Link>
              <Link href="/super-admin/security-keys" className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-hover)]">
                <KeyRound className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  <span className="font-semibold text-[var(--color-text-primary)] block">Platform Keys</span>
                  <span className="text-[var(--color-text-secondary)]">Secrets and signing keys live in the server environment; their status is shown there.</span>
                </span>
              </Link>
            </SurfaceCard>
          </div>
        </div>
      )}
    </div>
  );
}
