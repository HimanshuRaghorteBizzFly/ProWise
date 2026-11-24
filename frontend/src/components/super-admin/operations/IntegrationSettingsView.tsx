"use client";

import React, { useEffect, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import type { IntegrationSettings, UpdateIntegrationSettingsBody } from "@/types/admin-operations";
import {
  AdminButton,
  AdminInput,
  AdminTextarea,
  PageHeader,
  SurfaceCard,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, type ResourceState } from "../admin-resource";
import { MutationNotice, type MutationNoticeState } from "./shared";
import { InfoNote } from "./IntegrationViews";

export interface IntegrationSettingsForm {
  githubAppSlug: string;
  githubClientId: string;
  webhookMaxRetries: string;
  webhookTimeoutSeconds: string;
  webhookSignatureRequired: boolean;
  allowedEventTypes: string;
}

export function formFromSettings(s: IntegrationSettings): IntegrationSettingsForm {
  return {
    githubAppSlug: s.github_app_slug ?? "",
    githubClientId: s.github_client_id ?? "",
    webhookMaxRetries: String(s.webhook_max_retries),
    webhookTimeoutSeconds: String(s.webhook_timeout_seconds),
    webhookSignatureRequired: s.webhook_signature_required,
    allowedEventTypes: (s.allowed_event_types ?? []).join("\n"),
  };
}

/** Validates the form and builds the PUT body (with the loaded version as expected_version), or returns field errors. */
export function buildSettingsUpdate(
  form: IntegrationSettingsForm,
  version: number,
): { body: UpdateIntegrationSettingsBody } | { errors: Partial<Record<keyof IntegrationSettingsForm, string>> } {
  const errors: Partial<Record<keyof IntegrationSettingsForm, string>> = {};
  const retries = Number(form.webhookMaxRetries);
  const timeout = Number(form.webhookTimeoutSeconds);
  if (!Number.isInteger(retries) || retries < 0 || retries > 20) errors.webhookMaxRetries = "Enter a whole number from 0 to 20.";
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120) errors.webhookTimeoutSeconds = "Enter a whole number of seconds from 1 to 120.";
  const events = Array.from(
    new Set(
      form.allowedEventTypes
        .split(/[\n,]/)
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  );
  if (events.some((e) => !/^[a-z0-9_.:-]+$/i.test(e))) errors.allowedEventTypes = "Event types may contain letters, digits, dots, dashes, colons and underscores.";
  if (Object.keys(errors).length > 0) return { errors };
  return {
    body: {
      github_app_slug: form.githubAppSlug.trim() || null,
      github_client_id: form.githubClientId.trim() || null,
      webhook_max_retries: retries,
      webhook_timeout_seconds: timeout,
      webhook_signature_required: form.webhookSignatureRequired,
      allowed_event_types: events,
      expected_version: version,
    },
  };
}

export interface IntegrationSettingsViewProps {
  settings: ResourceState<IntegrationSettings>;
  onRetry: () => void;
  onSave: (body: UpdateIntegrationSettingsBody) => Promise<boolean>;
  saving: boolean;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
}

export function IntegrationSettingsView({ settings, onRetry, onSave, saving, notice, onReload, onDismissNotice }: IntegrationSettingsViewProps) {
  const loaded = settings.status === "ready" ? settings.data : null;
  const [form, setForm] = useState<IntegrationSettingsForm | null>(loaded ? formFromSettings(loaded) : null);
  const [errors, setErrors] = useState<Partial<Record<keyof IntegrationSettingsForm, string>>>({});

  const loadedKey = loaded ? `${loaded.version}:${loaded.updated_at ?? ""}` : "";
  useEffect(() => {
    if (loaded) {
      setForm(formFromSettings(loaded));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  const set = <K extends keyof IntegrationSettingsForm>(key: K, value: IntegrationSettingsForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !loaded) return;
    const result = buildSettingsUpdate(form, loaded.version);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await onSave(result.body);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Integration Settings" description="Platform-wide GitHub App identifiers and inbound webhook handling rules." />

      <InfoNote title="Protected credentials">
        Secrets (the GitHub App private key, client secret and webhook signing secret) are configured in the server environment and are
        never entered or shown here.
      </InfoNote>

      <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />

      <SurfaceCard className="overflow-hidden">
        <ResourceStatus
          state={settings}
          isEmpty={() => false}
          onRetry={onRetry}
          emptyIcon={Settings2}
          emptyTitle="No settings"
          emptyDescription="Integration settings are not available."
        />
        {loaded && form && (
          <form onSubmit={submit} className="p-4 sm:p-6 space-y-6" aria-label="Integration settings">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">GitHub App</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AdminInput label="GitHub App Slug" value={form.githubAppSlug} onChange={(e) => set("githubAppSlug", e.target.value)} maxLength={100} autoComplete="off" />
                <AdminInput
                  label="GitHub Client ID"
                  value={form.githubClientId}
                  onChange={(e) => set("githubClientId", e.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  helperText="Public OAuth client identifier, not the client secret."
                />
              </div>
            </section>

            <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Webhook handling</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AdminInput
                  label="Max Delivery Retries"
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={form.webhookMaxRetries}
                  onChange={(e) => set("webhookMaxRetries", e.target.value)}
                  error={errors.webhookMaxRetries}
                />
                <AdminInput
                  label="Processing Timeout (seconds)"
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={form.webhookTimeoutSeconds}
                  onChange={(e) => set("webhookTimeoutSeconds", e.target.value)}
                  error={errors.webhookTimeoutSeconds}
                />
              </div>
              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.webhookSignatureRequired}
                  onChange={(e) => set("webhookSignatureRequired", e.target.checked)}
                  className="mt-0.5 rounded border-[var(--color-border)]"
                />
                <span>
                  <span className="font-medium text-[var(--color-text-primary)]">Require a valid webhook signature</span>
                  <span className="block text-[var(--color-text-secondary)]">Unsigned or wrongly signed deliveries are refused.</span>
                </span>
              </label>
              <AdminTextarea
                label="Allowed Event Types (one per line)"
                value={form.allowedEventTypes}
                onChange={(e) => set("allowedEventTypes", e.target.value)}
                rows={5}
              />
              {errors.allowedEventTypes && <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.allowedEventTypes}</p>}
            </section>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--color-border)]">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Last updated {formatInstant(loaded.updated_at)}
                {loaded.updated_by ? ` by ${loaded.updated_by}` : ""} · version {loaded.version}
              </p>
              <AdminButton type="submit" size="sm" isLoading={saving}>
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </AdminButton>
            </div>
          </form>
        )}
      </SurfaceCard>
    </div>
  );
}
