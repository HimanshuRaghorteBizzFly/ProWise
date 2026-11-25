"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Edit3,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  ToggleLeft,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import type { PlatformApi } from "@/lib/admin-api/platform";
import type { PlatformFeatureFlag, PlatformLicense, PlatformPolicies, PoliciesInput } from "@/types/admin-platform";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "./admin-resource";
import { MutationErrorBanner, TabBar, useMutation, type MutationFailure } from "./platform-shared";
import type { NamedOption } from "./AnnouncementsView";
import { usePagedRows } from "./use-paged-rows";

export type ConfigurationApi = Pick<PlatformApi, "policies" | "featureFlags" | "licenses">;
export type ConfigurationTab = "limits" | "flags" | "licenses";

export const FLAG_AUDIENCES = ["All Tenants", "Enterprise Only", "Internal Operators"];

const NUMBER_FIELDS: { key: keyof PoliciesInput; label: string; min: number; max: number; help: string }[] = [
  { key: "default_trial_days", label: "Default Trial Length (Days)", min: 1, max: 90, help: "Days a new workspace evaluates ProWise." },
  { key: "auto_suspend_after_past_due_days", label: "Overdue Auto-Suspend Window (Days)", min: 1, max: 90, help: "Days after an unpaid invoice before suspension (billing is dormant in V1)." },
  { key: "checkin_grace_working_days", label: "Check-in Reminder Grace (Working Days)", min: 0, max: 14, help: "Buffer before team check-ins are marked overdue." },
  { key: "stale_webhook_minutes", label: "Webhook Health Alert Threshold (Minutes)", min: 1, max: 1440, help: "Minutes without deliveries before a webhook is flagged stale." },
  { key: "audit_retention_days", label: "Audit History Retention (Days)", min: 1, max: 3650, help: "Days administrative and security logs are kept." },
  { key: "max_attachment_mb", label: "Max File Attachment Size (MB)", min: 1, max: 1024, help: "Upload limit per attachment inside workspaces." },
];

export function policiesInputFrom(p: PlatformPolicies): PoliciesInput {
  return {
    checkin_grace_working_days: p.checkin_grace_working_days,
    stale_webhook_minutes: p.stale_webhook_minutes,
    audit_retention_days: p.audit_retention_days,
    enforce_mfa_for_operators: p.enforce_mfa_for_operators,
    auto_suspend_after_past_due_days: p.auto_suspend_after_past_due_days,
    default_trial_days: p.default_trial_days,
    max_attachment_mb: p.max_attachment_mb,
    maintenance_banner_mode: p.maintenance_banner_mode,
  };
}

function validatePolicies(input: PoliciesInput): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of NUMBER_FIELDS) {
    const v = input[f.key] as number;
    if (!Number.isInteger(v) || v < f.min || v > f.max) errors[f.key] = `Enter a whole number from ${f.min} to ${f.max}.`;
  }
  return errors;
}

const fe = (failure: MutationFailure | null, field: string) => failure?.fieldErrors[field];

export interface ConfigurationViewProps {
  policies: ResourceState<PlatformPolicies>;
  flags: ResourceState<PlatformFeatureFlag[]>;
  licenses: ResourceState<PlatformLicense[]>;
  onReloadPolicies: () => void;
  onReloadFlags: () => void;
  onReloadLicenses: () => void;
  api: ConfigurationApi;
  organizations: NamedOption[];
  plans: NamedOption[];
  initialTab?: ConfigurationTab;
}

export function ConfigurationView(props: ConfigurationViewProps) {
  const { policies, flags, licenses, api } = props;
  const [tab, setTab] = useState<ConfigurationTab>(props.initialTab ?? "limits");
  const flagRows = flags.status === "ready" ? flags.data : [];
  const licenseRows = licenses.status === "ready" ? licenses.data : [];
  const enabledFlags = flagRows.filter((f) => f.enabled).length;
  const activeLicenses = licenseRows.filter((l) => l.status === "ACTIVE").length;
  const pol = policies.status === "ready" ? policies.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Configuration"
        description="Global system limits, feature availability flags and enterprise licenses. Every change is saved on the server and recorded in the audit log."
        actions={
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => {
              props.onReloadPolicies();
              props.onReloadFlags();
              props.onReloadLicenses();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </AdminButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Feature flags enabled"
          value={flags.status === "ready" ? `${enabledFlags} / ${flagRows.length}` : "-"}
          sublabel="Platform capabilities"
          icon={ToggleLeft}
          tone="blue"
        />
        <KpiCard label="Active licenses" value={licenses.status === "ready" ? activeLicenses : "-"} sublabel={licenses.status === "ready" ? `${licenseRows.length} issued` : undefined} icon={BadgeCheck} tone="emerald" />
        <KpiCard
          label="Operator MFA policy"
          value={pol ? (pol.enforce_mfa_for_operators ? "Mandatory" : "Optional") : "-"}
          sublabel="Global System Limits"
          icon={ShieldCheck}
          tone={pol?.enforce_mfa_for_operators ? "emerald" : "amber"}
        />
        <KpiCard label="Audit retention" value={pol ? `${pol.audit_retention_days} days` : "-"} sublabel="Global System Limits" icon={Sliders} tone="violet" />
      </div>

      <SurfaceCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Wrench className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Maintenance windows</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Scheduling and approving maintenance has its own page.</p>
          </div>
        </div>
        <Link href="/super-admin/maintenance" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Open Maintenance
        </Link>
      </SurfaceCard>

      <TabBar<ConfigurationTab>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "limits", label: "Global System Limits", icon: Sliders },
          { key: "flags", label: "Feature Availability Flags", icon: ToggleLeft, badge: flags.status === "ready" ? `${enabledFlags}/${flagRows.length}` : undefined },
          { key: "licenses", label: "Licenses", icon: KeyRound, badge: licenses.status === "ready" ? String(licenseRows.length) : undefined },
        ]}
      />

      {tab === "limits" && <PoliciesPanel state={policies} onReload={props.onReloadPolicies} api={api} />}
      {tab === "flags" && <FlagsPanel state={flags} onReload={props.onReloadFlags} api={api} />}
      {tab === "licenses" && (
        <LicensesPanel state={licenses} onReload={props.onReloadLicenses} api={api} organizations={props.organizations} plans={props.plans} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ policies */

export function PoliciesPanel({ state, onReload, api }: { state: ResourceState<PlatformPolicies>; onReload: () => void; api: ConfigurationApi }) {
  const data = state.status === "ready" ? state.data : null;
  const [form, setForm] = useState<PoliciesInput | null>(data ? policiesInputFrom(data) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation();

  useEffect(() => {
    setForm(data ? policiesInputFrom(data) : null);
    setErrors({});
  }, [data]);

  if (!data || !form) {
    return (
      <SurfaceCard className="overflow-hidden">
        <ResourceStatus state={state} isEmpty={() => false} onRetry={onReload} emptyTitle="" emptyDescription="" />
      </SurfaceCard>
    );
  }

  const set = (patch: Partial<PoliciesInput>) => setForm({ ...form, ...patch });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validatePolicies(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const ok = await save.run(() => api.policies.update(form, data.version));
    if (ok) {
      toast.success("Platform limits saved.");
      onReload();
    }
  };

  return (
    <SurfaceCard className="p-4 sm:p-6">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Global System Limits &amp; Safeguards</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Last saved {formatInstant(data.updated_at)}.</p>
          </div>
          <AdminButton type="button" variant="ghost" size="xs" onClick={() => { setForm(policiesInputFrom(data)); setErrors({}); save.clear(); }}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Changes
          </AdminButton>
        </div>

        <MutationErrorBanner failure={save.failure} onReload={() => { save.clear(); onReload(); }} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NUMBER_FIELDS.map((f) => (
            <AdminInput
              key={f.key}
              label={f.label}
              type="number"
              min={f.min}
              max={f.max}
              value={Number.isNaN(form[f.key] as number) ? "" : String(form[f.key])}
              onChange={(e) => set({ [f.key]: e.target.value === "" ? NaN : Number(e.target.value) } as Partial<PoliciesInput>)}
              helperText={f.help}
              error={errors[f.key] ?? fe(save.failure, f.key)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
            <span>
              <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">Require two-factor authentication for operators</span>
              <span className="text-xs text-[var(--color-text-secondary)] block">Stored platform policy for Platform Operator sign-in.</span>
            </span>
            <input type="checkbox" checked={form.enforce_mfa_for_operators} onChange={(e) => set({ enforce_mfa_for_operators: e.target.checked })} className="mt-1 h-4 w-4" />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer">
            <span>
              <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">Maintenance notice banner mode</span>
              <span className="text-xs text-[var(--color-text-secondary)] block">Platform-wide maintenance banner switch.</span>
            </span>
            <input type="checkbox" checked={form.maintenance_banner_mode} onChange={(e) => set({ maintenance_banner_mode: e.target.checked })} className="mt-1 h-4 w-4" />
          </label>
        </div>

        <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
          <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>
            <Save className="w-3.5 h-3.5" />
            Save Platform Limits
          </AdminButton>
        </div>
      </form>
    </SurfaceCard>
  );
}

/* ------------------------------------------------------------------ feature flags */

interface FlagForm {
  flag_key: string;
  label: string;
  description: string;
  audience: string;
  enabled: boolean;
}

const EMPTY_FLAG: FlagForm = { flag_key: "", label: "", description: "", audience: FLAG_AUDIENCES[0], enabled: false };

export function FlagsPanel({ state, onReload, api }: { state: ResourceState<PlatformFeatureFlag[]>; onReload: () => void; api: ConfigurationApi }) {
  const rows = state.status === "ready" ? state.data : [];
  const { pageRows, barProps } = usePagedRows(rows);
  const [pendingToggle, setPendingToggle] = useState<PlatformFeatureFlag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformFeatureFlag | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformFeatureFlag | null>(null);
  const [form, setForm] = useState<FlagForm>(EMPTY_FLAG);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const action = useMutation();
  const save = useMutation();

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (await action.run(fn)) {
      toast.success(label);
      onReload();
    }
  };

  const openForm = (flag: PlatformFeatureFlag | null) => {
    setEditing(flag);
    setForm(
      flag
        ? { flag_key: flag.flag_key, label: flag.label, description: flag.description ?? "", audience: flag.audience ?? FLAG_AUDIENCES[0], enabled: flag.enabled }
        : EMPTY_FLAG,
    );
    setErrors({});
    save.clear();
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!editing && !/^[a-z0-9][a-z0-9_.-]*$/i.test(form.flag_key.trim())) found.flag_key = "Use letters, numbers, dots, dashes or underscores.";
    if (!form.label.trim()) found.label = "A label is required.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const description = form.description.trim() || null;
    const ok = await save.run(() =>
      editing
        ? api.featureFlags.update(editing.id, { label: form.label.trim(), description, audience: form.audience }, editing.version)
        : api.featureFlags.create({ flag_key: form.flag_key.trim(), label: form.label.trim(), description, audience: form.audience, enabled: form.enabled }),
    );
    if (ok) {
      toast.success(editing ? "Feature flag saved." : "Feature flag created.");
      setFormOpen(false);
      onReload();
    }
  };

  return (
    <SurfaceCard className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Feature Availability Controls</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Enable or pause platform capabilities without deploying new code.</p>
        </div>
        <AdminButton variant="primary" size="sm" onClick={() => openForm(null)}>
          <Plus className="w-3.5 h-3.5" />
          New Flag
        </AdminButton>
      </div>

      <MutationErrorBanner failure={action.failure} onReload={() => { action.clear(); onReload(); }} />
      <ResourceStatus state={state} isEmpty={(d) => d.length === 0} onRetry={onReload} emptyIcon={ToggleLeft} emptyTitle="No feature flags yet" emptyDescription="Create a flag with New Flag." />

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pageRows.map((flag) => (
            <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">{flag.label}</span>
                  {flag.audience && <StatusBadge label={flag.audience} tone="info" />}
                </div>
                <p className="font-mono text-[11px] text-[var(--color-text-muted)]">{flag.flag_key}</p>
                {flag.description && <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{flag.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <AdminButton variant={flag.enabled ? "primary" : "outline"} size="xs" disabled={action.pending} onClick={() => setPendingToggle(flag)} aria-pressed={flag.enabled}>
                  {flag.enabled ? "Enabled" : "Disabled"}
                </AdminButton>
                <AdminButton variant="ghost" size="xs" onClick={() => openForm(flag)} aria-label={`Edit ${flag.label}`}>
                  <Edit3 className="w-3.5 h-3.5" />
                </AdminButton>
                <AdminButton variant="ghost" size="xs" className="text-rose-600 dark:text-rose-400" onClick={() => setDeleteTarget(flag)} aria-label={`Delete ${flag.label}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && <PaginationBar {...barProps} />}

      <ConfirmActionModal
        isOpen={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        title={pendingToggle ? `${pendingToggle.enabled ? "Disable" : "Enable"} "${pendingToggle.label}"?` : ""}
        description="The change applies platform-wide as soon as it is saved."
        confirmLabel={pendingToggle?.enabled ? "Disable" : "Enable"}
        variant={pendingToggle?.enabled ? "danger" : "primary"}
        onConfirm={() => {
          const f = pendingToggle;
          if (f) void runAction(`${f.label} ${f.enabled ? "disabled" : "enabled"}.`, () => api.featureFlags.toggle(f.id, !f.enabled, f.version));
        }}
      />
      <ConfirmActionModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete flag "${deleteTarget?.label ?? ""}"?`}
        description="The flag is removed from the server. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          const f = deleteTarget;
          if (f) void runAction("Feature flag deleted.", () => api.featureFlags.remove(f.id, f.version));
        }}
      />

      <AdminModal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit flag: ${editing.label}` : "New feature flag"} maxWidth="md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <MutationErrorBanner failure={save.failure} onReload={() => { setFormOpen(false); save.clear(); onReload(); }} />
          <AdminInput
            label="Flag key"
            value={form.flag_key}
            disabled={Boolean(editing)}
            onChange={(e) => setForm({ ...form, flag_key: e.target.value })}
            helperText={editing ? "The key cannot change after creation." : "Used by code to check the flag, e.g. github_sync."}
            error={errors.flag_key ?? fe(save.failure, "flag_key")}
          />
          <AdminInput label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} error={errors.label ?? fe(save.failure, "label")} />
          <AdminTextarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fe(save.failure, "description")} />
          <AdminSelect
            label="Audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            options={Array.from(new Set([...FLAG_AUDIENCES, form.audience])).map((a) => ({ label: a, value: a }))}
            error={fe(save.failure, "audience")}
          />
          {!editing && (
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled when created
            </label>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>{editing ? "Save flag" : "Create flag"}</AdminButton>
          </div>
        </form>
      </AdminModal>
    </SurfaceCard>
  );
}

/* ------------------------------------------------------------------ licenses */

export function LicensesPanel({
  state,
  onReload,
  api,
  organizations,
  plans,
}: {
  state: ResourceState<PlatformLicense[]>;
  onReload: () => void;
  api: ConfigurationApi;
  organizations: NamedOption[];
  plans: NamedOption[];
}) {
  const rows = state.status === "ready" ? state.data : [];
  const { pageRows, barProps } = usePagedRows(rows);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [gen, setGen] = useState({ org_id: "", plan_id: "", max_seats: "25", validity_days: "365" });
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});
  const [revokeTarget, setRevokeTarget] = useState<PlatformLicense | null>(null);
  const [reason, setReason] = useState("");
  const save = useMutation();
  const revoke = useMutation();
  const orgName = (id: string | null) => (id ? organizations.find((o) => o.id === id)?.name ?? id : "-");
  const planName = (id: string | null) => (id ? plans.find((p) => p.id === id)?.name ?? id : "-");

  const submitGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const seats = Number(gen.max_seats);
    const days = gen.validity_days.trim() === "" ? null : Number(gen.validity_days);
    const found: Record<string, string> = {};
    if (!Number.isInteger(seats) || seats < 1) found.max_seats = "Enter at least 1 seat.";
    if (days !== null && (!Number.isInteger(days) || days < 1)) found.validity_days = "Enter a whole number of days, or leave empty.";
    setGenErrors(found);
    if (Object.keys(found).length > 0) return;
    const ok = await save.run(() =>
      api.licenses.generate({ org_id: gen.org_id || null, plan_id: gen.plan_id || null, max_seats: seats, validity_days: days }),
    );
    if (ok) {
      toast.success("License generated.");
      setGenerateOpen(false);
      onReload();
    }
  };

  const submitRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = revokeTarget;
    if (!target || !reason.trim()) return;
    const ok = await revoke.run(() => api.licenses.revoke(target.id, reason.trim(), target.version));
    if (ok) {
      toast.success("License revoked.");
      setRevokeTarget(null);
      onReload();
    }
  };

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Enterprise Licenses</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Keys are generated by the server. Revoking a key is permanent.</p>
        </div>
        <AdminButton
          variant="primary"
          size="sm"
          onClick={() => {
            setGen({ org_id: "", plan_id: "", max_seats: "25", validity_days: "365" });
            setGenErrors({});
            save.clear();
            setGenerateOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Generate License
        </AdminButton>
      </div>

      <ResourceStatus state={state} isEmpty={(d) => d.length === 0} onRetry={onReload} emptyIcon={KeyRound} emptyTitle="No licenses issued" emptyDescription="Generate a license for an organization with Generate License." />

      {rows.length > 0 && (
        <AdminTable label="Licenses" headers={["License key", "Organization", "Plan", "Seats", "Status", "Issued", "Expires", ""]}>
          {pageRows.map((l) => (
            <tr key={l.id}>
              <td className={`${cellClass} font-mono text-[11px] break-all`}>{l.license_key}</td>
              <td className={mutedCellClass}>{orgName(l.org_id)}</td>
              <td className={mutedCellClass}>{planName(l.plan_id)}</td>
              <td className={`${mutedCellClass} tabular-nums`}>{l.max_seats}</td>
              <td className={cellClass}>
                <StatusBadge label={humanize(l.status)} tone={getStatusTone(l.status)} dot />
                {l.revoked_reason && <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{l.revoked_reason}</p>}
              </td>
              <td className={`${mutedCellClass} whitespace-nowrap`}>{formatInstant(l.issued_at)}</td>
              <td className={`${mutedCellClass} whitespace-nowrap`}>{formatInstant(l.expires_at)}</td>
              <td className={cellClass}>
                {l.status !== "REVOKED" && (
                  <AdminButton
                    variant="ghost"
                    size="xs"
                    className="text-rose-600 dark:text-rose-400"
                    onClick={() => {
                      setReason("");
                      revoke.clear();
                      setRevokeTarget(l);
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Revoke
                  </AdminButton>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      {rows.length > 0 && <PaginationBar {...barProps} />}

      <AdminModal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate enterprise license" description="The server creates the key; it is shown in the list once generated." maxWidth="md">
        <form onSubmit={submitGenerate} className="space-y-4" noValidate>
          <MutationErrorBanner failure={save.failure} />
          <AdminSelect
            label="Organization"
            value={gen.org_id}
            onChange={(e) => setGen({ ...gen, org_id: e.target.value })}
            options={[{ label: "No organization", value: "" }, ...organizations.map((o) => ({ label: o.name, value: o.id }))]}
            error={fe(save.failure, "org_id")}
          />
          <AdminSelect
            label="Plan"
            value={gen.plan_id}
            onChange={(e) => setGen({ ...gen, plan_id: e.target.value })}
            options={[{ label: "Server default", value: "" }, ...plans.map((p) => ({ label: p.name, value: p.id }))]}
            error={fe(save.failure, "plan_id")}
          />
          <div className="grid grid-cols-2 gap-4">
            <AdminInput label="Max seats" type="number" min={1} value={gen.max_seats} onChange={(e) => setGen({ ...gen, max_seats: e.target.value })} error={genErrors.max_seats ?? fe(save.failure, "max_seats")} />
            <AdminInput label="Valid for (days)" type="number" min={1} value={gen.validity_days} onChange={(e) => setGen({ ...gen, validity_days: e.target.value })} error={genErrors.validity_days ?? fe(save.failure, "validity_days")} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setGenerateOpen(false)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>Generate</AdminButton>
          </div>
        </form>
      </AdminModal>

      <AdminModal isOpen={revokeTarget !== null} onClose={() => setRevokeTarget(null)} title="Revoke license" description={revokeTarget ? `Key ${revokeTarget.license_key} stops validating immediately.` : undefined} maxWidth="md">
        <form onSubmit={submitRevoke} className="space-y-4" noValidate>
          <MutationErrorBanner failure={revoke.failure} onReload={() => { setRevokeTarget(null); revoke.clear(); onReload(); }} />
          <AdminTextarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={fe(revoke.failure, "reason")} />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setRevokeTarget(null)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="danger" size="sm" disabled={!reason.trim()} isLoading={revoke.pending}>Revoke license</AdminButton>
          </div>
        </form>
      </AdminModal>
    </SurfaceCard>
  );
}
