"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  KeyRound,
  Lock,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { OperatorAccountSettings } from "../_types";
import { formatDateTime, isValidEmail } from "../_services/operator-service";
import {
  ConfirmModal,
  DemoDataBanner,
  OpButton,
  OpInput,
  OpSelect,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "../_components/OperatorPrimitives";

function getPasswordStrength(password: string): {
  label: string;
  score: number;
  barClass: string;
} {
  if (!password) return { label: "Not entered", score: 0, barClass: "bg-[var(--color-border)]" };
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: "Weak", score: 1, barClass: "bg-rose-500" };
  if (score === 2) return { label: "Fair", score: 2, barClass: "bg-amber-500" };
  if (score === 3) return { label: "Good", score: 3, barClass: "bg-blue-500" };
  return { label: "Strong", score: 4, barClass: "bg-emerald-500" };
}

export default function OperatorSettingsPage() {
  const accountSettings = usePlatformOperatorStore((s) => s.accountSettings);
  const updateAccountSettings = usePlatformOperatorStore((s) => s.updateAccountSettings);
  const changeOperatorPassword = usePlatformOperatorStore((s) => s.changeOperatorPassword);
  const toggleOperatorMfa = usePlatformOperatorStore((s) => s.toggleOperatorMfa);
  const { can } = useOperatorPermissions();
  const canManage = can("settings.manage");

  const [name, setName] = useState(accountSettings.name);
  const [roleTitle, setRoleTitle] = useState(accountSettings.roleTitle);
  const [email, setEmail] = useState(accountSettings.email);
  const [timezone, setTimezone] = useState(accountSettings.timezone);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<
    OperatorAccountSettings["autoRefreshSeconds"]
  >(accountSettings.autoRefreshSeconds);
  const [compactTables, setCompactTables] = useState(accountSettings.compactTables);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordModal, setConfirmPasswordModal] = useState(false);

  // MFA
  const [mfaMethod, setMfaMethod] = useState<OperatorAccountSettings["mfaMethod"]>(
    accountSettings.mfaMethod
  );
  const [confirmMfaModal, setConfirmMfaModal] = useState(false);

  useEffect(() => {
    setName(accountSettings.name);
    setRoleTitle(accountSettings.roleTitle);
    setEmail(accountSettings.email);
    setTimezone(accountSettings.timezone);
    setAutoRefreshSeconds(accountSettings.autoRefreshSeconds);
    setCompactTables(accountSettings.compactTables);
    setMfaMethod(accountSettings.mfaMethod);
  }, [accountSettings]);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const handleSaveProfileAndPrefs = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || roleTitle.trim().length < 2) {
      toast.error("Please enter a valid name and operational title.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid work email address.");
      return;
    }
    updateAccountSettings({
      name: name.trim(),
      roleTitle: roleTitle.trim(),
      email: email.trim(),
      timezone,
      autoRefreshSeconds,
      compactTables,
    });
    toast.success("Operator profile and workspace preferences saved.");
  };

  const handleValidatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 10 || strength.score < 3) {
      setPasswordError(
        "Use at least 10 characters with mixed case, numbers, or symbols (Good/Strong)."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setConfirmMfaModal(false);
    setConfirmPasswordModal(true);
  };

  const handleToggleNotification = (
    key: keyof OperatorAccountSettings["notifications"],
    nextValue: boolean
  ) => {
    updateAccountSettings({
      notifications: {
        ...accountSettings.notifications,
        [key]: nextValue,
      },
    });
    toast.success("Operator notification preference saved.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operator Settings"
        badge={accountSettings.mfaEnabled ? "2FA Active" : "2FA Off"}
        demoLabel="Simulated Account Security"
        description="Manage your operator profile, live dashboard refresh cadence, password security, two-factor authentication, and alert routing."
      />

      <DemoDataBanner
        title="Credential Safety"
        description="Passwords and 2FA secrets are never stored or displayed in plain text. Security updates persist in local operator state until integrated with backend auth."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={handleSaveProfileAndPrefs} className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <UserCog className="w-4 h-4 text-teal-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Operator Profile & Console Preferences
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Customize your display details and live-dashboard refresh cadence.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <OpInput
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <OpInput
                label="Operational Title"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
              <OpInput
                label="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <OpSelect
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                options={[
                  { label: "America/New_York (ET)", value: "America/New_York" },
                  { label: "America/Los_Angeles (PT)", value: "America/Los_Angeles" },
                  { label: "UTC", value: "UTC" },
                  { label: "Europe/London (UK)", value: "Europe/London" },
                  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                ]}
              />
            </div>

            <OpSelect
              label="Dashboard Telemetry Auto-Refresh Interval"
              value={autoRefreshSeconds}
              onChange={(e) =>
                setAutoRefreshSeconds(
                  Number(e.target.value) as OperatorAccountSettings["autoRefreshSeconds"]
                )
              }
              options={[
                { label: "Every 10 seconds (Fast triage)", value: 10 },
                { label: "Every 30 seconds (Balanced)", value: 30 },
                { label: "Every 60 seconds", value: 60 },
                { label: "Manual refresh only", value: 0 },
              ]}
            />

            <label className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={compactTables}
                onChange={(e) => setCompactTables(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span className="font-medium text-[var(--color-text-primary)]">
                Use compact spacing in operational tables
              </span>
            </label>

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <OpButton type="submit" variant="primary" size="sm" disabled={!canManage}>
                <Save className="w-3.5 h-3.5" />
                Save Profile & Preferences
              </OpButton>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={handleValidatePassword} className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Lock className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Change Password
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Last rotated {formatDateTime(accountSettings.passwordUpdatedAt)}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {passwordError}
              </div>
            )}

            <OpInput
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <OpInput
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
              />
              <OpInput
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-text-muted)]">Password strength</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {strength.label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full transition-colors ${
                      strength.score >= step ? strength.barClass : "bg-[var(--color-border)]"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <OpButton type="submit" variant="primary" size="sm" disabled={!canManage}>
                <KeyRound className="w-3.5 h-3.5" />
                Update Password
              </OpButton>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Two-Factor Authentication (2FA)
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Required under Super Admin security policy for operator access.
                </p>
              </div>
            </div>
            <StatusBadge
              label={accountSettings.mfaEnabled ? "Enabled" : "Disabled"}
              tone={accountSettings.mfaEnabled ? "success" : "danger"}
              dot
            />
          </div>

          <OpSelect
            label="Verification Method"
            value={mfaMethod}
            onChange={(e) =>
              setMfaMethod(e.target.value as OperatorAccountSettings["mfaMethod"])
            }
            options={[
              { label: "Authenticator App", value: "Authenticator App" },
              { label: "Security Key", value: "Security Key" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs">
            <p className="text-[var(--color-text-secondary)] max-w-sm">
              {accountSettings.mfaEnabled
                ? `Active method: ${accountSettings.mfaMethod}.`
                : "2FA is currently disabled."}
            </p>
            <OpButton
              variant={accountSettings.mfaEnabled ? "outline" : "primary"}
              size="xs"
              disabled={!canManage}
              onClick={() => {
                setConfirmPasswordModal(false);
                setConfirmMfaModal(true);
              }}
            >
              {accountSettings.mfaEnabled
                ? mfaMethod !== accountSettings.mfaMethod
                  ? "Switch 2FA Method"
                  : "Disable 2FA"
                : "Enable 2FA"}
            </OpButton>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
            <Bell className="w-4 h-4 text-teal-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Alert & Notification Routing
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose which operational events send alerts to{" "}
                <strong className="text-[var(--color-text-primary)]">
                  {accountSettings.email}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                key: "criticalAlerts" as const,
                title: "Critical System & Infrastructure Alerts",
                desc: "Immediate notice when cluster latency, CPU, or error rate exceeds safe limits.",
              },
              {
                key: "incidentAssignments" as const,
                title: "Incident Assignments & Escalations",
                desc: "Notify when an operational incident is assigned to you.",
              },
              {
                key: "webhookFailures" as const,
                title: "Repeated Webhook Delivery Failures",
                desc: "Alert when GitHub or billing webhooks fail automatic retries.",
              },
              {
                key: "slaWarnings" as const,
                title: "Support Ticket SLA Warnings",
                desc: "Alert before an open customer support ticket approaches its response SLA.",
              },
              {
                key: "approvalDecisions" as const,
                title: "Super Admin Approval Decisions",
                desc: "Notify when Super Admin approves or denies access requests and drafts.",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer hover:border-teal-500/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    {item.title}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block leading-relaxed">
                    {item.desc}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={accountSettings.notifications[item.key]}
                  onChange={(e) => handleToggleNotification(item.key, e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                />
              </label>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <ConfirmModal
        isOpen={confirmPasswordModal}
        onClose={() => setConfirmPasswordModal(false)}
        title="Confirm Password Rotation?"
        description="Your Platform Operator password will be updated in simulated local state and logged."
        confirmLabel="Update Password"
        variant="primary"
        onConfirm={() => {
          changeOperatorPassword();
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("Operator password rotated (simulated).");
        }}
      />

      <ConfirmModal
        isOpen={confirmMfaModal}
        onClose={() => setConfirmMfaModal(false)}
        title={
          accountSettings.mfaEnabled && mfaMethod === accountSettings.mfaMethod
            ? "Disable Two-Factor Authentication?"
            : "Update Two-Factor Authentication?"
        }
        description={
          accountSettings.mfaEnabled && mfaMethod === accountSettings.mfaMethod
            ? "Disabling 2FA may restrict access to sensitive operator queues under organization security policies."
            : `Set "${mfaMethod}" as your two-factor authentication method.`
        }
        confirmLabel={
          accountSettings.mfaEnabled && mfaMethod === accountSettings.mfaMethod
            ? "Disable 2FA"
            : "Confirm 2FA"
        }
        variant={
          accountSettings.mfaEnabled && mfaMethod === accountSettings.mfaMethod
            ? "danger"
            : "primary"
        }
        onConfirm={() => {
          if (accountSettings.mfaEnabled && mfaMethod !== accountSettings.mfaMethod) {
            toggleOperatorMfa(mfaMethod);
            toggleOperatorMfa(mfaMethod);
            toast.success(`Switched 2FA method to ${mfaMethod}.`);
          } else {
            const nextState = !accountSettings.mfaEnabled;
            toggleOperatorMfa(mfaMethod);
            toast.success(
              nextState ? `Enabled 2FA (${mfaMethod}).` : "Two-factor authentication disabled."
            );
          }
        }}
      />
    </div>
  );
}
