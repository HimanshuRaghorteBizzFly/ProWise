"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  KeyRound,
  Laptop,
  Lock,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import { SuperAdminAccountProfile } from "../_types";
import { formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  ConfirmActionModal,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

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

export default function SuperAdminAccountPage() {
  const accountProfile = useSuperAdminStore((s) => s.accountProfile);
  const updateAccountProfile = useSuperAdminStore((s) => s.updateAccountProfile);
  const changeAccountPassword = useSuperAdminStore((s) => s.changeAccountPassword);
  const toggleAccountMfa = useSuperAdminStore((s) => s.toggleAccountMfa);
  const revokeAdminSession = useSuperAdminStore((s) => s.revokeAdminSession);
  const updateAccountNotifications = useSuperAdminStore((s) => s.updateAccountNotifications);

  // Profile form
  const [name, setName] = useState(accountProfile.name);
  const [title, setTitle] = useState(accountProfile.title);
  const [email, setEmail] = useState(accountProfile.email);
  const [timezone, setTimezone] = useState(accountProfile.timezone);

  // Password form (never stored or displayed back)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordModal, setConfirmPasswordModal] = useState(false);

  // MFA
  const [selectedMfaMethod, setSelectedMfaMethod] =
    useState<SuperAdminAccountProfile["mfaMethod"]>(accountProfile.mfaMethod);
  const [confirmMfaModal, setConfirmMfaModal] = useState(false);

  // Session Revoke
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setName(accountProfile.name);
    setTitle(accountProfile.title);
    setEmail(accountProfile.email);
    setTimezone(accountProfile.timezone);
    setSelectedMfaMethod(accountProfile.mfaMethod);
  }, [accountProfile]);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const sessionToRevoke = accountProfile.sessions.find((s) => s.id === pendingSessionId);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (title.trim().length < 2) {
      toast.error("Please enter your job title or role label.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid work email address.");
      return;
    }

    updateAccountProfile({
      name: name.trim(),
      title: title.trim(),
      email: email.trim(),
      timezone,
    });
    toast.success("Super Admin profile updated.");
  };

  const handleValidatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password to verify your identity.");
      return;
    }
    if (newPassword.length < 10) {
      setPasswordError("New password must be at least 10 characters long.");
      return;
    }
    if (strength.score < 3) {
      setPasswordError(
        "Use a mix of uppercase, lowercase, numbers, or symbols for a Good or Strong password."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }
    setConfirmPasswordModal(true);
  };

  const handleConfirmPasswordChange = () => {
    changeAccountPassword();
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Account password rotated and logged (simulated local security state).");
  };

  const handleToggleNotification = (
    key: keyof SuperAdminAccountProfile["notifications"],
    nextValue: boolean
  ) => {
    updateAccountNotifications({ [key]: nextValue });
    toast.success("Notification preference updated.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account & Security"
        badge={accountProfile.mfaEnabled ? "2FA Active" : "2FA Off"}
        simulationLabel="Simulated Identity Security"
        description="Manage your Super Admin profile, password rotation, two-factor authentication, active device sessions, and alert notifications."
      />

      <SimulationNotice
        title="Credential Safety"
        description="Passwords and recovery keys are never stored or displayed in plain text. Security changes update local account state and write to the audit trail until backend SSO/auth APIs are linked."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Profile Information */}
        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <UserCog className="w-4 h-4 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Personal Profile
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Shown on audit trail entries and approval reviews.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AdminInput
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <AdminInput
                label="Role / Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <AdminInput
                label="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <AdminSelect
                label="Personal Timezone"
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

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <AdminButton type="submit" variant="primary" size="sm">
                <Save className="w-3.5 h-3.5" />
                Save Profile
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>

        {/* Password Rotation */}
        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={handleValidatePassword} className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Change Password
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Last updated {formatDateTime(accountProfile.passwordLastChangedAt)}
                  </p>
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {passwordError}
              </div>
            )}

            <AdminInput
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AdminInput
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
              />
              <AdminInput
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
                <span className="font-semibold text-[var(--color-text-primary)]">{strength.label}</span>
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
              <AdminButton type="submit" variant="primary" size="sm">
                <KeyRound className="w-3.5 h-3.5" />
                Update Password
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Two-Factor Authentication & Active Sessions */}
        <div className="space-y-6">
          <SurfaceCard className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Two-Factor Authentication (2FA)
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Adds an extra verification step before accessing billing or security controls.
                  </p>
                </div>
              </div>
              <StatusBadge
                label={accountProfile.mfaEnabled ? "Enabled" : "Disabled"}
                tone={accountProfile.mfaEnabled ? "success" : "danger"}
                dot
              />
            </div>

            <AdminSelect
              label="Verification Method"
              value={selectedMfaMethod}
              onChange={(e) =>
                setSelectedMfaMethod(e.target.value as SuperAdminAccountProfile["mfaMethod"])
              }
              options={[
                { label: "Authenticator App (Google Authenticator / 1Password)", value: "Authenticator App" },
                { label: "Hardware Security Key (YubiKey / Passkey)", value: "Hardware Security Key" },
              ]}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs">
              <p className="text-[var(--color-text-secondary)] max-w-sm">
                {accountProfile.mfaEnabled
                  ? `Protected using ${accountProfile.mfaMethod}. You can switch methods or turn 2FA off with confirmation.`
                  : "Enable 2FA to protect customer billing, organizations, and access approvals."}
              </p>
              <AdminButton
                variant={accountProfile.mfaEnabled ? "outline" : "primary"}
                size="xs"
                onClick={() => setConfirmMfaModal(true)}
              >
                {accountProfile.mfaEnabled
                  ? selectedMfaMethod !== accountProfile.mfaMethod
                    ? "Switch 2FA Method"
                    : "Disable 2FA"
                  : "Enable 2FA"}
              </AdminButton>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Laptop className="w-4 h-4 text-violet-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Signed-In Devices & Sessions
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  End any session you do not recognize immediately.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {accountProfile.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                        {session.device}
                      </span>
                      {session.isCurrent && <StatusBadge label="Current Device" tone="success" dot />}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {session.browser} · {session.location} ({session.ipMasked})
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Active {formatDateTime(session.lastActiveAt)}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <AdminButton
                      variant="outline"
                      size="xs"
                      onClick={() => setPendingSessionId(session.id)}
                    >
                      Sign Out Device
                    </AdminButton>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        {/* Notification Preferences */}
        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
            <Bell className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Super Admin Notification Preferences
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose which platform events send email digests or urgent alerts to{" "}
                <strong className="text-[var(--color-text-primary)]">{accountProfile.email}</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                key: "securityAlerts" as const,
                title: "High-Priority Security Alerts",
                desc: "Immediate alert for unusual sign-in attempts, MFA failures, or elevated permission changes.",
              },
              {
                key: "accessApprovals" as const,
                title: "Support Access Approval Requests",
                desc: "Notify when a Platform Operator requests temporary entry into a customer workspace.",
              },
              {
                key: "incidentEscalations" as const,
                title: "Incident Governance Escalations",
                desc: "Notify when an active incident reaches Major/Critical severity or executive tier.",
              },
              {
                key: "paymentFailures" as const,
                title: "Billing & Settlement Exceptions",
                desc: "Daily alert if enterprise subscription renewals fail or invoices exceed overdue threshold.",
              },
              {
                key: "weeklyDigest" as const,
                title: "Weekly Executive Summary",
                desc: "Receive a Monday morning digest covering MRR growth, new organizations, and SLA health.",
              },
            ].map((item) => {
              const checked = accountProfile.notifications[item.key];
              return (
                <label
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 cursor-pointer hover:border-blue-500/40"
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
                    checked={checked}
                    onChange={(e) => handleToggleNotification(item.key, e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                  />
                </label>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      {/* Confirm Password Change */}
      <ConfirmActionModal
        isOpen={confirmPasswordModal}
        onClose={() => setConfirmPasswordModal(false)}
        title="Confirm Password Rotation?"
        description="Your Super Admin password will be updated immediately and an entry will be added to the security audit log."
        confirmLabel="Update Password"
        variant="primary"
        onConfirm={handleConfirmPasswordChange}
      />

      {/* Confirm MFA Toggle */}
      <ConfirmActionModal
        isOpen={confirmMfaModal}
        onClose={() => setConfirmMfaModal(false)}
        title={
          accountProfile.mfaEnabled && selectedMfaMethod === accountProfile.mfaMethod
            ? "Disable Two-Factor Authentication?"
            : "Confirm Two-Factor Authentication Update"
        }
        description={
          accountProfile.mfaEnabled && selectedMfaMethod === accountProfile.mfaMethod
            ? "Turning off 2FA lowers account protection for sensitive billing and tenant controls. Are you sure?"
            : `Apply "${selectedMfaMethod}" as your verified two-factor authentication method.`
        }
        confirmLabel={
          accountProfile.mfaEnabled && selectedMfaMethod === accountProfile.mfaMethod
            ? "Disable 2FA"
            : "Confirm 2FA Setting"
        }
        variant={
          accountProfile.mfaEnabled && selectedMfaMethod === accountProfile.mfaMethod
            ? "danger"
            : "primary"
        }
        onConfirm={() => {
          if (accountProfile.mfaEnabled && selectedMfaMethod !== accountProfile.mfaMethod) {
            // Keep enabled while updating method: toggle off then back on with new method, or just call toggleAccountMfa twice?
            // Let's handle cleanly: toggleAccountMfa toggles mfaEnabled; to change method cleanly, call toggle twice if staying enabled.
            toggleAccountMfa(selectedMfaMethod);
            toggleAccountMfa(selectedMfaMethod);
            toast.success(`Switched 2FA method to ${selectedMfaMethod}.`);
          } else {
            const willEnable = !accountProfile.mfaEnabled;
            toggleAccountMfa(selectedMfaMethod);
            toast.success(
              willEnable
                ? `Two-factor authentication enabled (${selectedMfaMethod}).`
                : "Two-factor authentication disabled."
            );
          }
        }}
      />

      {/* Confirm Revoke Session */}
      <ConfirmActionModal
        isOpen={Boolean(sessionToRevoke)}
        onClose={() => setPendingSessionId(null)}
        title="Sign Out Selected Device?"
        description={
          sessionToRevoke
            ? `Revoke active Super Admin session on ${sessionToRevoke.device} (${sessionToRevoke.location})?`
            : ""
        }
        confirmLabel="Sign Out Device"
        variant="danger"
        onConfirm={() => {
          if (sessionToRevoke) {
            revokeAdminSession(sessionToRevoke.id);
            toast.success(`Signed out ${sessionToRevoke.device}.`);
          }
        }}
      />
    </div>
  );
}

