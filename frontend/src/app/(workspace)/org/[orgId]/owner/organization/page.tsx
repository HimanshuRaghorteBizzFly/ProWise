"use client";

import React, { useEffect, useState } from "react";
import { Building2, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { OrgSettings } from "@/mocks/org-console";
import { AdminButton, AdminInput, AdminSelect, ButtonLink, PageFrame, Panel, StatPill, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { cn } from "@/lib/utils";

const TIMEZONES = ["Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Kolkata", "Asia/Singapore"];

export default function OwnerOrganizationSettingsPage() {
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const settings = useOrgConsoleStore((s) => s.settings);
  const roles = useOrgConsoleStore((s) => s.roles);
  const update = useOrgConsoleStore((s) => s.updateSettings);
  const [form, setForm] = useState<OrgSettings>(settings);
  const [domains, setDomains] = useState(settings.allowedDomains.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(settings); setDomains(settings.allowedDomains.join(", ")); }, [settings]);

  const set = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors({}); };
  const dirty = JSON.stringify({ ...form, allowedDomains: domains }) !== JSON.stringify({ ...settings, allowedDomains: settings.allowedDomains.join(", ") });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = "Organization name needs at least 3 characters.";
    const list = domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (list.length === 0 || list.some((d) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d))) next.domains = "Enter one or more valid domains, separated by commas.";
    if (form.sessionTimeoutHours < 1 || form.sessionTimeoutHours > 72) next.timeout = "Between 1 and 72 hours.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    window.setTimeout(() => {
      update({ ...form, name: form.name.trim(), allowedDomains: list });
      setSaving(false);
      toast.success("Organization settings saved");
    }, 500);
  };

  return (
    <OrgGate family="owner" need="org.manage">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Organization settings" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Organization settings"
        description="Identity, locale and security policy for the whole organization. Only the owner can change these."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill label="Slug" value={settings.slug} />
          <StatPill label="Data region" value={settings.dataRegion} />
          <StatPill label="Created" value={formatDate(settings.createdAt, true)} />
          <StatPill label="MFA" value={settings.requireMfa ? "Required" : "Optional"} tone={settings.requireMfa ? "success" : "warning"} />
        </div>
        <form onSubmit={save} noValidate className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Panel title="Identity" icon={Building2}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminInput label="Organization name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
                <AdminInput label="Primary domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} />
                <AdminInput label="Industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
                <AdminSelect label="Default timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} options={TIMEZONES.map((t) => ({ label: t, value: t }))} />
                <AdminSelect label="Locale" value={form.locale} onChange={(e) => set("locale", e.target.value)} options={[{ label: "English (UK)", value: "en-GB" }, { label: "English (US)", value: "en-US" }, { label: "Deutsch", value: "de-DE" }]} />
                <AdminInput label="Data region" value={form.dataRegion} disabled helperText="Set at creation; contact support to migrate." />
              </div>
            </Panel>
            <Panel title="Security policy" icon={ShieldCheck} iconTone="emerald">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.requireMfa}
                    onClick={() => set("requireMfa", !form.requireMfa)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-left transition-colors hover:border-blue-500/40"
                  >
                    <span><span className="block text-xs font-semibold">Require multi-factor authentication</span><span className="block text-[11px] text-[var(--color-text-muted)]">Members without MFA are asked to enrol at next sign-in.</span></span>
                    <span className={cn("relative h-5 w-9 rounded-full transition-colors shrink-0", form.requireMfa ? "bg-emerald-500" : "bg-slate-400")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", form.requireMfa ? "left-[18px]" : "left-0.5")} /></span>
                  </button>
                </div>
                <AdminInput label="Allowed invite domains" value={domains} onChange={(e) => { setDomains(e.target.value); setErrors({}); }} error={errors.domains} helperText="Comma separated" />
                <AdminInput label="Session timeout (hours)" type="number" min={1} max={72} value={form.sessionTimeoutHours} onChange={(e) => set("sessionTimeoutHours", Number(e.target.value))} error={errors.timeout} />
                <AdminSelect label="Default role for new members" value={form.defaultRoleId} onChange={(e) => set("defaultRoleId", e.target.value)} options={roles.filter((r) => r.id !== "role-owner" && r.id !== "role-admin").map((r) => ({ label: r.name, value: r.id }))} />
              </div>
            </Panel>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <AdminButton type="button" variant="outline" disabled={!dirty} onClick={() => { setForm(settings); setDomains(settings.allowedDomains.join(", ")); }}>Discard</AdminButton>
              <AdminButton type="submit" isLoading={saving} disabled={!dirty}>Save settings</AdminButton>
            </div>
          </div>
          <div className="space-y-4">
            <Panel title="Data & privacy" icon={Lock} iconTone="violet"><p className="text-xs text-[var(--color-text-secondary)] mb-3">Retention, exports and deletion requests.</p><ButtonLink href={href("privacy")} variant="outline">Open data & privacy</ButtonLink></Panel>
            <Panel title="Ownership" icon={KeyRound} iconTone="rose"><p className="text-xs text-[var(--color-text-secondary)] mb-3">Hand the organization to another member.</p><ButtonLink href={href("transfer-ownership")} variant="outline">Transfer ownership</ButtonLink></Panel>
          </div>
        </form>
      </PageFrame>
    </OrgGate>
  );
}
