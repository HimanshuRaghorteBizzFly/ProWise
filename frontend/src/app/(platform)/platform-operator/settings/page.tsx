"use client";

import React, { useMemo, useState } from "react";
import {
  Bell,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import type { OperatorProfile } from "@/types/operator-console";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
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
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";

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

const PROFILE_REASON = "operators cannot edit their own profile or preferences on the server yet";
const PASSWORD_REASON = "there is no change-password endpoint; use the reset link instead";
const MFA_REASON = "two-factor setup for operators is not built yet";
const NOTIFY_REASON = "notification preferences are not stored on the server yet";

function titleOf(me: OperatorProfile | null): string {
  if (!me) return "";
  const level = me.access_level ? humanizeCode(me.access_level) : "";
  const dept = me.department ? humanizeCode(me.department.replace(/-/g, "_")) : "";
  return [level, dept].filter(Boolean).join(" · ");
}

/**
 * The signed-in operator's own settings. The profile is read from GET /v1/operator/me; every change on this page
 * except "Email me a reset link" (POST /v1/auth/operator/forgot-password to the operator's own address) has no
 * server endpoint yet, so those controls stay visible and disabled.
 */
export default function OperatorSettingsPage() {
  const { state, reload } = useOperatorResource(() => operatorApi.me(), "me");
  const me = state.status === "ready" ? state.data : null;
  const { busy, notice, clearNotice, run } = useOperatorMutation(() => undefined);
  const { can } = useOperatorPermissions();
  const canManage = can("settings.manage");

  // Password form (kept for when a change-password endpoint exists; inputs are disabled today)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordModal, setConfirmPasswordModal] = useState(false);
  const [confirmMfaModal, setConfirmMfaModal] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const mfaEnabled = me?.mfa_enabled ?? false;

  const sendResetLink = () => {
    if (!me?.email) return;
    void run(
      "reset-link",
      () => operatorApi.session.requestPasswordReset(me.email),
      `If the account is active, a password reset link was sent to ${me.email}.`
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operator Settings"
        badge={me ? (mfaEnabled ? "2FA Active" : "2FA Off") : undefined}
        liveData
        description="Manage your operator profile, live dashboard refresh cadence, password security, two-factor authentication, and alert routing."
      />

      <DemoDataBanner
        title="Credential Safety"
        description="Passwords and 2FA secrets are never stored or displayed in plain text. Security updates persist in local operator state until integrated with backend auth."
      />

      <OperatorResourceStatus
        state={state}
        isEmpty={() => false}
        onRetry={() => void reload()}
        emptyTitle="Profile not found"
        emptyDescription="The server returned no operator profile."
        rows={2}
      />

      <MutationNotice
        notice={notice}
        onReload={() => {
          clearNotice();
          void reload();
        }}
        onDismiss={clearNotice}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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
              <OpInput label="Full Name" value={me?.name ?? ""} readOnly disabled title={NOT_AVAILABLE} />
              <OpInput label="Operational Title" value={titleOf(me)} readOnly disabled title={NOT_AVAILABLE} />
              <OpInput label="Work Email" type="email" value={me?.email ?? ""} readOnly disabled title={NOT_AVAILABLE} />
              <OpSelect
                label="Timezone"
                value="UTC"
                disabled
                title={NOT_AVAILABLE}
                onChange={() => undefined}
                options={[
                  { label: "America/New_York (ET)", value: "America/New_York" },
                  { label: "America/Los_Angeles (PT)", value: "America/Los_Angeles" },
                  { label: "UTC", value: "UTC" },
                  { label: "Europe/London (UK)", value: "Europe/London" },
                  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                ]}
              />
            </div>

            {me && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                <StatusBadge label={humanizeCode(me.status)} tone={me.status === "ACTIVE" ? "success" : "warning"} dot />
                {me.on_call && <StatusBadge label="On Call" tone="info" />}
                {me.shift_name && <span>Shift: {me.shift_name}</span>}
                <span>Active sessions: {me.active_sessions_count}</span>
                <span>Last active {formatDateTime(me.last_active_at ?? "")}</span>
              </div>
            )}

            <OpSelect
              label="Dashboard Telemetry Auto-Refresh Interval"
              value={0}
              disabled
              title={NOT_AVAILABLE}
              onChange={() => undefined}
              options={[
                { label: "Every 10 seconds (Fast triage)", value: 10 },
                { label: "Every 30 seconds (Balanced)", value: 30 },
                { label: "Every 60 seconds", value: 60 },
                { label: "Manual refresh only", value: 0 },
              ]}
            />

            <label
              title={NOT_AVAILABLE}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs cursor-not-allowed"
            >
              <input type="checkbox" checked={false} disabled readOnly className="rounded border-[var(--color-border)]" />
              <span className="font-medium text-[var(--color-text-primary)]">
                Use compact spacing in operational tables
              </span>
              <NotAvailableText reason={PROFILE_REASON} />
            </label>

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <NotAvailableButton variant="primary" size="sm" reason={PROFILE_REASON} wrapperClassName="items-end">
                <Save className="w-3.5 h-3.5" />
                Save Profile & Preferences
              </NotAvailableButton>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Lock className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Change Password
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Last rotated <NotAvailableText reason="the server does not report when the password was changed" />
                </p>
              </div>
            </div>

            <OpInput
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              disabled
              title={NOT_AVAILABLE}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <OpInput
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
                disabled
                title={NOT_AVAILABLE}
              />
              <OpInput
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                disabled
                title={NOT_AVAILABLE}
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

            <div className="flex flex-wrap items-start justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <OpButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canManage || !me || busy !== null}
                isLoading={busy === "reset-link"}
                onClick={sendResetLink}
              >
                <Mail className="w-3.5 h-3.5" />
                Email me a reset link
              </OpButton>
              <NotAvailableButton variant="primary" size="sm" reason={PASSWORD_REASON} wrapperClassName="items-end">
                <KeyRound className="w-3.5 h-3.5" />
                Update Password
              </NotAvailableButton>
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
            {me ? (
              <StatusBadge label={mfaEnabled ? "Enabled" : "Disabled"} tone={mfaEnabled ? "success" : "danger"} dot />
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">-</span>
            )}
          </div>

          <OpSelect
            label="Verification Method"
            value="Authenticator App"
            disabled
            title={NOT_AVAILABLE}
            onChange={() => undefined}
            options={[
              { label: "Authenticator App", value: "Authenticator App" },
              { label: "Security Key", value: "Security Key" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs">
            <p className="text-[var(--color-text-secondary)] max-w-sm">
              {mfaEnabled ? "Two-factor authentication is enabled on your account." : "2FA is currently disabled."}
              {mfaEnabled && (
                <>
                  {" "}
                  Active method: <NotAvailableText reason="the server does not report the MFA method" />.
                </>
              )}
            </p>
            <NotAvailableButton variant={mfaEnabled ? "outline" : "primary"} size="xs" reason={MFA_REASON}>
              {mfaEnabled ? "Disable 2FA" : "Enable 2FA"}
            </NotAvailableButton>
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
                  {me?.email ?? "-"}
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
                title={NOT_AVAILABLE}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-not-allowed"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] block">
                    {item.title}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block leading-relaxed">
                    {item.desc}
                  </span>
                  <NotAvailableText reason={NOTIFY_REASON} />
                </div>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  readOnly
                  aria-label={`${item.title} (${NOT_AVAILABLE})`}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                />
              </label>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Kept for when the endpoints exist; nothing opens these confirmations today. */}
      <ConfirmModal
        isOpen={confirmPasswordModal}
        onClose={() => setConfirmPasswordModal(false)}
        title="Confirm Password Rotation?"
        description="Your Platform Operator password will be updated and the change logged."
        confirmLabel="Update Password"
        variant="primary"
        onConfirm={() => setConfirmPasswordModal(false)}
      />

      <ConfirmModal
        isOpen={confirmMfaModal}
        onClose={() => setConfirmMfaModal(false)}
        title={mfaEnabled ? "Disable Two-Factor Authentication?" : "Update Two-Factor Authentication?"}
        description={
          mfaEnabled
            ? "Disabling 2FA may restrict access to sensitive operator queues under organization security policies."
            : "Set your two-factor authentication method."
        }
        confirmLabel={mfaEnabled ? "Disable 2FA" : "Confirm 2FA"}
        variant={mfaEnabled ? "danger" : "primary"}
        onConfirm={() => setConfirmMfaModal(false)}
      />
    </div>
  );
}
