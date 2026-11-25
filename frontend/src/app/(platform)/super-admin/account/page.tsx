"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Laptop, Lock, RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { ApiError, apiClient, type SessionView } from "@/lib/api";
import type { MeResponse } from "@/types/api";
import { isPasswordAcceptable } from "@/lib/password-policy";
import { PasswordInput, PasswordStrengthChecklist } from "@/components/auth/PasswordFields";
import { formatDateTime } from "../_services/super-admin-service";
import { AdminButton, ConfirmActionModal, PageHeader, PaginationBar, StatusBadge, SurfaceCard } from "../_components/SuperAdminPrimitives";
import { usePagedRows } from "@/components/super-admin/use-paged-rows";

/**
 * Super Admin profile and security settings, backed by the real identity API:
 * profile from /v1/me, password change (current password verified, BCrypt on the server, other sessions ended),
 * and the real session list. Passwords exist only in component state and are cleared after submit.
 */
export default function SuperAdminAccountPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordModal, setConfirmPasswordModal] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changedAt, setChangedAt] = useState<string | null>(null);

  const [pendingSession, setPendingSession] = useState<SessionView | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await apiClient.mySessions());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient
      .me()
      .then(setMe)
      .catch((error: unknown) => setMeError(error instanceof Error ? error.message : "Could not load your profile."));
    void loadSessions();
  }, [loadSessions]);

  const handleValidatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError("Enter your current password to verify your identity.");
      return;
    }
    if (!isPasswordAcceptable(newPassword)) {
      setPasswordError("The new password does not meet every requirement.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("Choose a password different from your current one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setConfirmPasswordModal(true);
  };

  const handleConfirmPasswordChange = async () => {
    setChanging(true);
    try {
      await apiClient.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangedAt(new Date().toISOString());
      toast.success("Password changed. Your other sessions were signed out.");
      void loadSessions();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.code === "INVALID_CURRENT_PASSWORD"
            ? "The current password is incorrect."
            : error.code === "PASSWORD_REUSE"
              ? "Choose a password different from your current one."
              : error.message
          : "Password change failed.";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setChanging(false);
    }
  };

  const revokeSession = async (session: SessionView) => {
    try {
      await apiClient.revokeSession(session.id);
      toast.success("Session signed out.");
      void loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out that session.");
    }
  };

  const revokeOthers = async () => {
    try {
      const result = await apiClient.revokeOtherSessions();
      toast.success(`Signed out ${result.revoked} other session${result.revoked === 1 ? "" : "s"}.`);
      void loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out other sessions.");
    }
  };

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const { pageRows: sessionPage, barProps: sessionBarProps } = usePagedRows(sessions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account & Security"
        description="Your Super Admin profile, password and signed-in sessions."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
            <UserCog className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Profile</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Shown on audit trail entries and approvals.</p>
            </div>
          </div>
          {meError && <p className="text-xs text-rose-700 dark:text-rose-300">{meError}</p>}
          {!me && !meError && <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>}
          {me && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-[var(--color-text-muted)]">Name</dt>
              <dd className="text-[var(--color-text-primary)] font-medium">{me.name || "—"}</dd>
              <dt className="text-[var(--color-text-muted)]">Email</dt>
              <dd className="text-[var(--color-text-primary)] break-all">{me.email}</dd>
              <dt className="text-[var(--color-text-muted)]">Role</dt>
              <dd>
                <StatusBadge label={(me.role ?? "—").replace(/_/g, " ")} tone="info" />
              </dd>
            </dl>
          )}
          <p className="text-[11px] text-[var(--color-text-muted)]">
            The Super Admin email is set by platform configuration and cannot be changed here.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-6">
          <form onSubmit={handleValidatePassword} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Lock className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Change Password</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {changedAt ? `Changed ${formatDateTime(changedAt)}` : "Changing it signs out your other sessions."}
                </p>
              </div>
            </div>

            {passwordError && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {passwordError}
              </div>
            )}

            <PasswordInput
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordInput
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="At least 12 characters"
            />
            <PasswordStrengthChecklist password={newPassword} />
            <PasswordInput
              id="confirm-new-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              error={mismatch ? "Passwords do not match." : undefined}
            />

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <AdminButton type="submit" variant="primary" size="sm" isLoading={changing}>
                <KeyRound className="w-3.5 h-3.5" />
                Change Password
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SurfaceCard className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-violet-500" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Signed-In Sessions</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">End any session you do not recognize.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <AdminButton variant="outline" size="xs" isLoading={sessionsLoading} onClick={() => void loadSessions()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </AdminButton>
              <AdminButton variant="outline" size="xs" disabled={sessions.filter((s) => !s.current).length === 0} onClick={() => setConfirmRevokeOthers(true)}>
                Sign out others
              </AdminButton>
            </div>
          </div>
          <div className="space-y-2.5">
            {sessions.length === 0 && !sessionsLoading && (
              <p className="text-xs text-[var(--color-text-muted)]">No active sessions found.</p>
            )}
            {sessionPage.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate max-w-[280px]">
                      {session.user_agent || "Unknown device"}
                    </span>
                    {session.current && <StatusBadge label="This session" tone="success" dot />}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {session.ip_address ?? "IP unknown"} · signed in {formatDateTime(session.created_at)} · last used{" "}
                    {formatDateTime(session.last_used_at)}
                  </p>
                </div>
                {!session.current && (
                  <AdminButton variant="outline" size="xs" onClick={() => setPendingSession(session)}>
                    Sign Out
                  </AdminButton>
                )}
              </div>
            ))}
          </div>
          {sessions.length > 0 && <PaginationBar {...sessionBarProps} />}
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Two-Factor Authentication</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Not available in this release.</p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            MFA is deferred for V1 (decision D12, item T08). Until it ships, protect this account with a unique password and review
            the sessions list regularly.
          </p>
        </SurfaceCard>
      </div>

      <ConfirmActionModal
        isOpen={confirmPasswordModal}
        onClose={() => setConfirmPasswordModal(false)}
        title="Change your password?"
        description="Your password is updated immediately, your other sessions are signed out, and the change is recorded in the security audit log."
        confirmLabel="Change Password"
        variant="primary"
        onConfirm={() => void handleConfirmPasswordChange()}
      />
      <ConfirmActionModal
        isOpen={Boolean(pendingSession)}
        onClose={() => setPendingSession(null)}
        title="Sign out this session?"
        description={pendingSession ? `End the session from ${pendingSession.user_agent || "an unknown device"}?` : ""}
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={() => {
          if (pendingSession) void revokeSession(pendingSession);
        }}
      />
      <ConfirmActionModal
        isOpen={confirmRevokeOthers}
        onClose={() => setConfirmRevokeOthers(false)}
        title="Sign out all other sessions?"
        description="Every session except this one ends immediately."
        confirmLabel="Sign Out Others"
        variant="danger"
        onConfirm={() => void revokeOthers()}
      />
    </div>
  );
}
