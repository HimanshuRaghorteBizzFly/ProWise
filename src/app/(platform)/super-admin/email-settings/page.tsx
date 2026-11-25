"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  apiClient,
  type EmailDeliveryLogPage,
  type SmtpConnectionTestResponse,
  type SmtpSettingsResponse,
  type SmtpTestEmailResponse,
  type SmtpVerifySenderResponse,
  type UpdateSmtpSettingsRequest,
} from "@/lib/api";
import { useAdminPermissions } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  ConfirmActionModal,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

type Provider = "GMAIL" | "SENDGRID" | "AWS_SES" | "POSTMARK" | "MAILGUN" | "SMTP_CUSTOM";

const PROVIDER_PRESETS: Record<Provider, { host: string; port: number; encryption: "TLS" | "SSL" }> = {
  GMAIL: { host: "smtp.gmail.com", port: 587, encryption: "TLS" },
  SENDGRID: { host: "smtp.sendgrid.net", port: 587, encryption: "TLS" },
  AWS_SES: { host: "email-smtp.us-east-1.amazonaws.com", port: 587, encryption: "TLS" },
  POSTMARK: { host: "smtp.postmarkapp.com", port: 587, encryption: "TLS" },
  MAILGUN: { host: "smtp.mailgun.org", port: 587, encryption: "TLS" },
  SMTP_CUSTOM: { host: "", port: 587, encryption: "TLS" },
};

const STATUS_FILTERS = ["ALL", "SMTP_ACCEPTED", "FAILED", "NOT_SENT", "PROCESSING", "QUEUED", "RETRY_PENDING"];
const TYPE_FILTERS = [
  "ALL",
  "SMTP_TEST",
  "ACCOUNT_SETUP",
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "ORGANIZATION_INVITATION",
  "OPERATOR_INVITATION",
  "OPERATOR_PASSWORD_RESET",
  "NOTIFICATION",
];

interface Draft {
  provider: Provider;
  host: string;
  port: number;
  encryption: string;
  username: string;
  from_name: string;
  from_email: string;
  reply_to_email: string;
  rate_limit_per_minute: number;
  retry_attempts: number;
  retry_wait_seconds: number;
}

function toDraft(s: SmtpSettingsResponse): Draft {
  return {
    provider: (s.provider as Provider) ?? "SMTP_CUSTOM",
    host: s.host ?? "",
    port: s.port,
    encryption: s.encryption,
    username: s.username ?? "",
    from_name: s.from_name ?? "",
    from_email: s.from_email ?? "",
    reply_to_email: s.reply_to_email ?? "",
    rate_limit_per_minute: s.rate_limit_per_minute,
    retry_attempts: s.retry_attempts,
    retry_wait_seconds: s.retry_wait_seconds,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "STALE_VERSION") return "Someone else changed these settings. Reload and try again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Request failed.";
}

function passwordSourceLabel(s: SmtpSettingsResponse): string {
  switch (s.password_source) {
    case "DATABASE":
      return `Stored encrypted${s.password_updated_at ? `, updated ${formatDateTime(s.password_updated_at)}` : ""}`;
    case "ENVIRONMENT":
      return "Provided by the server environment (SMTP_PASSWORD)";
    case "UNREADABLE":
      return "Stored password cannot be decrypted. Enter it again.";
    default:
      return "Not configured";
  }
}

export default function SuperAdminSmtpEmailPage() {
  const { can } = useAdminPermissions();
  const canConfigure = can("smtp.configure");

  const [settings, setSettings] = useState<SmtpSettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Write-only: never prefilled, never stored in the browser, cleared after every save.
  const [newCredential, setNewCredential] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<SmtpConnectionTestResponse | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<SmtpTestEmailResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [senderResult, setSenderResult] = useState<SmtpVerifySenderResponse | null>(null);

  const [logs, setLogs] = useState<EmailDeliveryLogPage | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logSearch, setLogSearch] = useState("");
  const [logStatus, setLogStatus] = useState("ALL");
  const [logType, setLogType] = useState("ALL");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const s = await apiClient.smtp.settings();
      setSettings(s);
      setDraft(toDraft(s));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const page = await apiClient.smtp.logs({
        page: logPage - 1,
        size: logPageSize,
        q: logSearch.trim() || undefined,
        status: logStatus,
        type: logType,
        from: logFrom || undefined,
        // Inclusive end date: everything before the next midnight (UTC).
        to: logTo ? new Date(new Date(`${logTo}T00:00:00Z`).getTime() + 86_400_000).toISOString() : undefined,
      });
      setLogs(page);
      setLogsError(null);
    } catch (error) {
      setLogsError(errorMessage(error));
    } finally {
      setLogsLoading(false);
    }
  }, [logPage, logPageSize, logSearch, logStatus, logType, logFrom, logTo]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handle = setTimeout(() => void loadLogs(), 250);
    return () => clearTimeout(handle);
  }, [loadLogs]);

  const validate = (d: Draft) => {
    const errs: Record<string, string> = {};
    if (!d.host.trim()) errs.host = "Enter your email provider server address.";
    if (!d.port || d.port < 1 || d.port > 65535) errs.port = "Port must be between 1 and 65535.";
    if (!d.username.trim()) errs.username = "Account username is required.";
    if (!settings?.credentials_configured && !newCredential.trim()) {
      errs.credential = "Enter an API key or App Password to complete setup.";
    }
    if (newCredential.trim() && settings && !settings.encryption_key_configured) {
      errs.credential = "The server has no SMTP_CREDENTIAL_ENCRYPTION_KEY, so a password cannot be stored from here.";
    }
    if (!isValidEmail(d.from_email)) errs.from_email = "Enter a valid sender email address.";
    if (d.reply_to_email && !isValidEmail(d.reply_to_email)) errs.reply_to_email = "Enter a valid reply-to email.";
    if (d.rate_limit_per_minute < 1 || d.rate_limit_per_minute > 10000) errs.rate_limit_per_minute = "Use 1 to 10000.";
    if (d.retry_attempts < 1 || d.retry_attempts > 5) errs.retry_attempts = "Use 1 to 5 attempts.";
    if (d.retry_wait_seconds < 0 || d.retry_wait_seconds > 30) errs.retry_wait_seconds = "Use 0 to 30 seconds.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const commitSave = async () => {
    if (!draft || !settings) return;
    setSaving(true);
    const body: UpdateSmtpSettingsRequest = {
      ...draft,
      expected_version: settings.version,
      ...(newCredential.trim() ? { password: newCredential } : {}),
    };
    try {
      const saved = await apiClient.smtp.save(body);
      setSettings(saved);
      setDraft(toDraft(saved));
      setNewCredential("");
      setConnResult(null);
      toast.success("SMTP settings saved. Run Test Connection to verify them.");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length) {
        const fieldErrs: Record<string, string> = {};
        error.fieldErrors.forEach((f) => {
          fieldErrs[f.field === "password" ? "credential" : f.field] = f.message;
        });
        setErrors(fieldErrs);
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !validate(draft)) return;
    if (newCredential.trim()) setConfirmSaveOpen(true);
    else void commitSave();
  };

  const handleProviderChange = (provider: Provider) => {
    const preset = PROVIDER_PRESETS[provider];
    setDraft((prev) =>
      prev ? { ...prev, provider, host: preset.host || prev.host, port: preset.port, encryption: preset.encryption } : prev,
    );
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    try {
      const result = await apiClient.smtp.testConnection();
      setConnResult(result);
      await loadSettings();
      if (result.status === "CONNECTED") toast.success(`Connected to ${result.host}:${result.port}`);
      else toast.error(`Connection test: ${result.status.replace(/_/g, " ")}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTestingConn(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!isValidEmail(testRecipient)) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }
    setSendingTestEmail(true);
    try {
      const result = await apiClient.smtp.sendTestEmail(testRecipient.trim());
      setTestEmailResult(result);
      if (result.accepted) toast.success(`Accepted by the SMTP server for ${result.recipient}`);
      else toast.error(`Test email ${result.status.replace(/_/g, " ").toLowerCase()}`);
      setLogPage(1);
      void loadLogs();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleVerifySender = async () => {
    setVerifying(true);
    try {
      const result = await apiClient.smtp.verifySender(draft?.from_email || undefined);
      setSenderResult(result);
      if (result.accepted) toast.success("Sender accepted by the SMTP server");
      else toast.error("Sender not accepted");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  const unsavedChanges = settings && draft ? JSON.stringify(toDraft(settings)) !== JSON.stringify(draft) || !!newCredential : false;
  const connectionStatus = settings?.connection_status ?? "NOT_TESTED";

  if (loadError && !settings) {
    return (
      <div className="space-y-5">
        <PageHeader title="SMTP Email" description="Configure your outbound email service." />
        <SurfaceCard className="p-5 text-sm text-rose-700 dark:text-rose-300">
          Could not load SMTP settings: {loadError}
          <div className="mt-3">
            <AdminButton variant="outline" size="sm" onClick={() => void loadSettings()}>
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </AdminButton>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  if (!settings || !draft) {
    return (
      <div className="space-y-5">
        <PageHeader title="SMTP Email" description="Configure your outbound email service." />
        <SurfaceCard className="p-5 text-sm text-[var(--color-text-secondary)]">Loading SMTP settings…</SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="SMTP Email"
        description="Configure your outbound email service, sender identity, delivery limits, and connection readiness."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/super-admin/security-keys">
              <AdminButton variant="outline" size="sm">
                <KeyRound className="w-3.5 h-3.5" />
                Platform Keys &amp; JWT
              </AdminButton>
            </Link>
            <StatusBadge
              label={`Connection: ${connectionStatus.replace(/_/g, " ")}`}
              tone={getStatusTone(connectionStatus)}
              dot
            />
          </div>
        }
      />

      <SurfaceCard className="p-4 text-xs text-[var(--color-text-secondary)] flex flex-wrap gap-x-6 gap-y-1">
        <span>
          <strong className="text-[var(--color-text-primary)]">Live delivery.</strong> Every action below talks to the
          configured SMTP server. Status shows only what the server actually answered.
        </span>
        <span>
          Settings source:{" "}
          <strong className="text-[var(--color-text-primary)]">
            {settings.settings_source === "DATABASE" ? "saved in this panel" : "server environment (SMTP_*)"}
          </strong>
        </span>
        {settings.problem && <span className="text-rose-600 dark:text-rose-300">{settings.problem}</span>}
      </SurfaceCard>

      <form onSubmit={handleSaveSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
        <SurfaceCard className="xl:col-span-7 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Mail Provider &amp; Security</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose a provider preset or enter custom server details
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Lock className="w-3.5 h-3.5" /> Password never displayed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Email Provider"
              value={draft.provider}
              disabled={!canConfigure}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              options={[
                { label: "Google Workspace / Gmail", value: "GMAIL" },
                { label: "SendGrid", value: "SENDGRID" },
                { label: "Amazon SES", value: "AWS_SES" },
                { label: "Postmark", value: "POSTMARK" },
                { label: "Mailgun", value: "MAILGUN" },
                { label: "Custom Mail Server", value: "SMTP_CUSTOM" },
              ]}
            />
            <AdminInput
              label="SMTP Host"
              value={draft.host}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, host: e.target.value })}
              error={errors.host}
            />
            <div className="grid grid-cols-2 gap-2">
              <AdminInput
                label="Port"
                type="number"
                value={draft.port}
                disabled={!canConfigure}
                onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })}
                error={errors.port}
              />
              <AdminSelect
                label="Encryption"
                value={draft.encryption}
                disabled={!canConfigure}
                onChange={(e) => setDraft({ ...draft, encryption: e.target.value })}
                options={[
                  { label: "STARTTLS (587)", value: "TLS" },
                  { label: "SSL/TLS (465)", value: "SSL" },
                  { label: "None (localhost only)", value: "NONE" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminInput
              label="Account Username"
              value={draft.username}
              disabled={!canConfigure}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              error={errors.username || errors.encryption}
            />
            <AdminInput
              label="API Key / Password"
              type="password"
              showPasswordToggle
              autoComplete="new-password"
              value={newCredential}
              disabled={!canConfigure}
              onChange={(e) => setNewCredential(e.target.value)}
              placeholder={settings.credentials_configured ? "•••••••• (leave blank to keep)" : "Provider key or Gmail App Password"}
              helperText={passwordSourceLabel(settings)}
              error={errors.credential}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
            <AdminInput
              label="Sender Name"
              value={draft.from_name}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, from_name: e.target.value })}
              error={errors.from_name}
            />
            <AdminInput
              label="Sender Email"
              type="email"
              value={draft.from_email}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, from_email: e.target.value })}
              error={errors.from_email}
            />
            <AdminInput
              label="Reply-To Email"
              type="email"
              value={draft.reply_to_email}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, reply_to_email: e.target.value })}
              error={errors.reply_to_email}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
            <AdminInput
              label="Sending Limit (per minute)"
              type="number"
              min={1}
              max={10000}
              value={draft.rate_limit_per_minute}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, rate_limit_per_minute: Number(e.target.value) })}
              error={errors.rate_limit_per_minute}
            />
            <AdminInput
              label="Retry Attempts"
              type="number"
              min={1}
              max={5}
              value={draft.retry_attempts}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, retry_attempts: Number(e.target.value) })}
              error={errors.retry_attempts}
            />
            <AdminInput
              label="Retry Wait (seconds)"
              type="number"
              min={0}
              max={30}
              value={draft.retry_wait_seconds}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, retry_wait_seconds: Number(e.target.value) })}
              error={errors.retry_wait_seconds}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            {unsavedChanges && (
              <span className="mr-auto text-[11px] text-amber-700 dark:text-amber-300">
                Unsaved changes. Test Connection uses the saved settings.
              </span>
            )}
            <AdminButton type="button" variant="outline" isLoading={testingConn} permissionLocked={!canConfigure} onClick={handleTestConnection}>
              <Wifi className="w-3.5 h-3.5" />
              Test Connection
            </AdminButton>
            <AdminButton type="submit" variant="primary" isLoading={saving} permissionLocked={!canConfigure}>
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </AdminButton>
          </div>
        </SurfaceCard>

        <div className="xl:col-span-5 space-y-4 min-w-0">
          <SurfaceCard className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                Connection Status
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {settings.last_tested_at ? `Last tested ${formatDateTime(settings.last_tested_at)}` : "Never tested"}
              </span>
            </div>
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                connectionStatus === "CONNECTED"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-text-primary)]"
                  : connectionStatus === "NOT_TESTED"
                    ? "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
              }`}
            >
              {connectionStatus === "CONNECTED" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className={`w-4 h-4 shrink-0 mt-0.5 ${connectionStatus === "NOT_TESTED" ? "opacity-50" : "text-rose-500"}`} />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{connectionStatus.replace(/_/g, " ")}</p>
                <p className="text-[11px] opacity-90 mt-0.5 break-words">
                  {settings.last_test_message || "Click Test Connection to connect, negotiate TLS and authenticate."}
                </p>
                {connResult && (
                  <p className="text-[11px] opacity-80 mt-1 break-words">
                    {connResult.host}:{connResult.port} · {connResult.encryption} · {connResult.latency_ms} ms
                    {connResult.server_response ? ` · server: ${connResult.server_response}` : ""}
                  </p>
                )}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Send Test Email</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Sends the ProWise SMTP Email Verification message through the saved settings and logs the result.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <AdminInput
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="recipient@company.com"
              />
              <AdminButton type="button" variant="secondary" isLoading={sendingTestEmail} permissionLocked={!canConfigure} onClick={handleSendTestEmail}>
                <Send className="w-3.5 h-3.5" />
                Send Test
              </AdminButton>
            </div>
            {testEmailResult && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-[11px]">
                <dt className="text-[var(--color-text-muted)]">Result</dt>
                <dd>
                  <StatusBadge label={testEmailResult.status.replace(/_/g, " ")} tone={getStatusTone(testEmailResult.status)} dot />
                </dd>
                <dt className="text-[var(--color-text-muted)]">Recipient</dt>
                <dd className="break-all">{testEmailResult.recipient}</dd>
                <dt className="text-[var(--color-text-muted)]">Sender</dt>
                <dd className="break-all">{testEmailResult.sender ?? "—"}</dd>
                <dt className="text-[var(--color-text-muted)]">Provider</dt>
                <dd>{testEmailResult.provider}</dd>
                <dt className="text-[var(--color-text-muted)]">Attempted</dt>
                <dd>
                  {formatDateTime(testEmailResult.attempted_at)} ({testEmailResult.attempts} attempt
                  {testEmailResult.attempts === 1 ? "" : "s"})
                </dd>
                <dt className="text-[var(--color-text-muted)]">Message ID</dt>
                <dd className="break-all">{testEmailResult.message_id ?? "—"}</dd>
                <dt className="text-[var(--color-text-muted)]">SMTP reply</dt>
                <dd className="break-all">{testEmailResult.smtp_response ?? "—"}</dd>
                {testEmailResult.error && (
                  <>
                    <dt className="text-rose-600">Error</dt>
                    <dd className="break-words text-rose-700 dark:text-rose-300">{testEmailResult.error}</dd>
                  </>
                )}
                <dd className="col-span-2 mt-1 text-[var(--color-text-muted)]">{testEmailResult.note}</dd>
              </dl>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Verify Sender Identity</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Asks the SMTP server whether it accepts {draft.from_email || "the sender email"} (nothing is sent).
                </p>
              </div>
              <AdminButton type="button" variant="outline" size="sm" isLoading={verifying} permissionLocked={!canConfigure} onClick={handleVerifySender}>
                <BadgeCheck className="w-3.5 h-3.5" />
                Verify
              </AdminButton>
            </div>
            {senderResult && (
              <div
                className={`rounded-xl border p-3 text-[11px] ${
                  senderResult.accepted
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                }`}
              >
                <p className="font-semibold">
                  {senderResult.sender_email}: {senderResult.accepted ? "accepted" : "not accepted"} (
                  {senderResult.connection_status.replace(/_/g, " ")})
                </p>
                <p className="mt-0.5 break-words">{senderResult.detail}</p>
                {senderResult.smtp_response && <p className="mt-0.5 opacity-80 break-all">Server: {senderResult.smtp_response}</p>}
              </div>
            )}
          </SurfaceCard>
        </div>
      </form>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Email Delivery Logs</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Every email the platform attempted, with the SMTP server&apos;s reply. SMTP accepted is not proof of inbox delivery.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{logs?.total ?? 0} entries</span>
            <AdminButton variant="outline" size="xs" isLoading={logsLoading} onClick={() => void loadLogs()}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            <AdminButton
              variant="outline"
              size="xs"
              permissionLocked={!can("system.export")}
              disabled={!logs?.items.length}
              onClick={() => {
                const rows = logs?.items ?? [];
                exportRowsToCsv(
                  "prowise-email-delivery-log.csv",
                  ["Recipient", "Sender", "Subject", "Type", "Provider", "Status", "Attempts", "SMTP Response", "Error", "Message ID", "Created", "Sent"],
                  rows.map((l) => [
                    l.recipient,
                    l.sender ?? "",
                    l.subject,
                    l.email_type ?? "",
                    l.provider ?? "",
                    l.status,
                    l.attempts,
                    l.smtp_response ?? "",
                    l.error_message ?? "",
                    l.message_id ?? "",
                    l.created_at,
                    l.sent_at ?? "",
                  ]),
                );
                toast.success(`Exported ${rows.length} log entr${rows.length === 1 ? "y" : "ies"} (current page)`);
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </AdminButton>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <AdminInput
            placeholder="Search recipient, subject, message ID"
            value={logSearch}
            onChange={(e) => {
              setLogSearch(e.target.value);
              setLogPage(1);
            }}
          />
          <AdminSelect
            value={logStatus}
            onChange={(e) => {
              setLogStatus(e.target.value);
              setLogPage(1);
            }}
            options={STATUS_FILTERS.map((s) => ({ label: s === "ALL" ? "All statuses" : s.replace(/_/g, " "), value: s }))}
          />
          <AdminSelect
            value={logType}
            onChange={(e) => {
              setLogType(e.target.value);
              setLogPage(1);
            }}
            options={TYPE_FILTERS.map((t) => ({ label: t === "ALL" ? "All email types" : t.replace(/_/g, " "), value: t }))}
          />
          <AdminInput
            type="date"
            aria-label="From date"
            value={logFrom}
            onChange={(e) => {
              setLogFrom(e.target.value);
              setLogPage(1);
            }}
          />
          <AdminInput
            type="date"
            aria-label="To date"
            value={logTo}
            onChange={(e) => {
              setLogTo(e.target.value);
              setLogPage(1);
            }}
          />
        </div>

        {logsError && <div className="px-5 py-3 text-xs text-rose-700 dark:text-rose-300">Could not load logs: {logsError}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 hidden md:table-cell">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">SMTP Response / Error</th>
                <th className="px-4 py-3 hidden lg:table-cell text-right">Created / Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {logs?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    No email delivery attempts match these filters.
                  </td>
                </tr>
              )}
              {logs?.items.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--color-hover)] transition-colors align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {getOrgInitials(log.recipient)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-text-primary)] truncate max-w-[200px]">{log.recipient}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px]">
                          from {log.sender ?? "—"} · {log.provider ?? "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--color-text-primary)] font-semibold">{log.subject}</div>
                    {log.message_id && <div className="text-[10px] text-[var(--color-text-muted)] break-all">{log.message_id}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[var(--color-text-secondary)]">
                    {(log.email_type ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={log.status.replace(/_/g, " ")} tone={getStatusTone(log.status)} dot />
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {log.attempts} attempt{log.attempts === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell max-w-[320px] break-words text-[11px]">
                    {log.smtp_response && <div className="text-[var(--color-text-secondary)]">{log.smtp_response}</div>}
                    {log.error_message && <div className="text-rose-700 dark:text-rose-300">{log.error_message}</div>}
                    {!log.smtp_response && !log.error_message && <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-right text-[var(--color-text-muted)] whitespace-nowrap">
                    <div>{formatDateTime(log.created_at)}</div>
                    <div className="text-[10px]">{log.sent_at ? `sent ${formatDateTime(log.sent_at)}` : "not sent"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          currentPage={logPage}
          totalItems={logs?.total ?? 0}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={(n) => {
            setLogPageSize(n);
            setLogPage(1);
          }}
        />
      </SurfaceCard>

      <ConfirmActionModal
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        title="Replace the SMTP password?"
        description="The new password is encrypted on the server and replaces the stored one. It is never shown again. This change is recorded in the audit log."
        confirmLabel="Save & Replace Password"
        variant="primary"
        onConfirm={() => void commitSave()}
      />
    </div>
  );
}
