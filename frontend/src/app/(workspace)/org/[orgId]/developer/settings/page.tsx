"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Palette, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminButton, AdminInput, AdminSelect, PageFrame, Panel } from "@/components/delivery/DeliveryUI";
import { DevGate, changeError } from "@/components/developer/DevUI";
import { useDevMutation, useDevPreferences } from "@/components/developer/useDeveloperData";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { developerApi, type DeveloperPreferences } from "@/lib/developer-api";
import { useThemeStore } from "@/store/theme-store";

type Theme = "light" | "dark" | "system";

interface Form {
  emailNotifications: boolean;
  slackNotifications: boolean;
  theme: Theme;
  githubUsername: string;
  timezone: string;
}

/** GitHub usernames: 1–39 characters, letters, digits and single hyphens, not starting or ending with a hyphen. */
const GITHUB_USERNAME = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;

function supportedZones(current: string): string[] {
  let zones: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    zones = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Singapore"];
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function toForm(p: DeveloperPreferences): Form {
  const theme = (["light", "dark", "system"].includes(p.theme) ? p.theme : "system") as Theme;
  return {
    emailNotifications: !!p.emailNotifications,
    slackNotifications: !!p.slackNotifications,
    theme,
    githubUsername: p.githubUsername ?? "",
    timezone: p.timezone || "UTC",
  };
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const errors: Partial<Record<keyof Form, string>> = {};
  const gh = f.githubUsername.trim();
  if (gh && !GITHUB_USERNAME.test(gh)) errors.githubUsername = "Use a valid GitHub username (letters, digits and hyphens, up to 39).";
  if (!f.timezone || !isValidZone(f.timezone)) errors.timezone = "Choose a valid time zone.";
  return errors;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
        <span className="block text-xs text-[var(--color-text-secondary)]">{description}</span>
      </span>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function PreferencesForm({ initial }: { initial: DeveloperPreferences }) {
  const setTheme = useThemeStore((s) => s.setTheme);
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [touched, setTouched] = useState(false);
  useEffect(() => setForm(toForm(initial)), [initial]);

  const zones = useMemo(() => supportedZones(form.timezone), [form.timezone]);
  const errors = validate(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(initial));

  const save = useDevMutation((f: Form) =>
    developerApi.updatePreferences({
      emailNotifications: f.emailNotifications,
      slackNotifications: f.slackNotifications,
      theme: f.theme,
      githubUsername: f.githubUsername.trim() || undefined,
      timezone: f.timezone,
    }),
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length > 0) return;
        save.mutate(form, {
          onSuccess: () => {
            setTheme(form.theme);
            toast.success("Settings saved.");
            setTouched(false);
          },
          onError: (err) => toast.error(changeError(err)),
        });
      }}
    >
      <Panel title="Profile" icon={UserRound}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdminInput
            label="GitHub username"
            placeholder="octocat"
            value={form.githubUsername}
            maxLength={39}
            onChange={(e) => setForm({ ...form, githubUsername: e.target.value })}
            error={touched ? errors.githubUsername : undefined}
            helperText="Used to match your linked activity. Activity is evidence only."
          />
          <AdminSelect
            label="Time zone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            error={touched ? errors.timezone : undefined}
            options={zones.map((z) => ({ label: z, value: z }))}
          />
        </div>
      </Panel>

      <Panel title="Appearance" icon={Palette}>
        <AdminSelect
          label="Theme"
          value={form.theme}
          onChange={(e) => setForm({ ...form, theme: e.target.value as Theme })}
          options={[
            { label: "System", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
        />
      </Panel>

      <Panel title="Notifications" icon={Bell}>
        <div className="space-y-2">
          <Toggle
            label="Email notifications"
            description="Assignments, review decisions and blockers on your work."
            checked={form.emailNotifications}
            onChange={(v) => setForm({ ...form, emailNotifications: v })}
          />
          <Toggle
            label="Slack notifications"
            description="Sent only when your organization has connected Slack."
            checked={form.slackNotifications}
            onChange={(v) => setForm({ ...form, slackNotifications: v })}
          />
        </div>
      </Panel>

      <div className="flex justify-end gap-2">
        <AdminButton type="button" variant="outline" size="sm" disabled={!dirty || save.isPending} onClick={() => setForm(toForm(initial))}>
          Discard changes
        </AdminButton>
        <AdminButton type="submit" size="sm" disabled={!dirty || save.isPending} isLoading={save.isPending}>
          Save settings
        </AdminButton>
      </div>
    </form>
  );
}

export default function DeveloperSettingsPage() {
  const orgId = useOrgId();
  const home = `/org/${orgId}/developer/dashboard`;
  const prefs = useDevPreferences();

  return (
    <PanelLayout title="Settings">
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "Settings" }]}
        title="Settings"
        description="Your profile, appearance and notification preferences."
      >
        <DevGate state={prefs} what="Your settings" back={{ href: home, label: "Back to dashboard" }} skeleton="detail">
          {(data) => <PreferencesForm initial={data} />}
        </DevGate>
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <Settings className="h-3.5 w-3.5" /> Repository connections are managed by your organization; they are not set here.
        </p>
      </PageFrame>
    </PanelLayout>
  );
}
