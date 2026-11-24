"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  Mail,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmailDeliveryLog, SmtpConfig, SmtpEncryption, SmtpProvider } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  SmtpCheckStep,
  exportRowsToCsv,
  formatDateTime,
  isValidEmail,
  simulateSmtpHandshake,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  BulkSelectionBar,
  ConfirmActionModal,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

function getEmailSourceBadgeClass(source: EmailDeliveryLog["source"]): string {
  if (source === "ANNOUNCEMENT") {
    return "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
  if (source === "INVOICE_REMINDER") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
  if (source === "TEMPLATE_TEST") {
    return "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300";
  }
  return "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

const PROVIDER_PRESETS: Record<SmtpProvider, { host: string; port: number; encryption: SmtpEncryption }> = {
  GMAIL: { host: "smtp.gmail.com", port: 587, encryption: "TLS" },
  SENDGRID: { host: "smtp.sendgrid.net", port: 587, encryption: "TLS" },
  AWS_SES: { host: "email-smtp.us-east-1.amazonaws.com", port: 587, encryption: "TLS" },
  POSTMARK: { host: "smtp.postmarkapp.com", port: 587, encryption: "TLS" },
  MAILGUN: { host: "smtp.mailgun.org", port: 587, encryption: "TLS" },
  SMTP_CUSTOM: { host: "mail.company.com", port: 465, encryption: "SSL" },
};

export default function SuperAdminSmtpEmailPage() {
  const smtpConfig = useSuperAdminStore((s) => s.smtpConfig);
  const emailLogs = useSuperAdminStore((s) => s.emailLogs);
  const saveSmtpConfig = useSuperAdminStore((s) => s.saveSmtpConfig);
  const recordSmtpTestResult = useSuperAdminStore((s) => s.recordSmtpTestResult);
  const sendSimulatedEmail = useSuperAdminStore((s) => s.sendSimulatedEmail);
  const deleteEmailLogs = useSuperAdminStore((s) => s.deleteEmailLogs);

  const { can } = useAdminPermissions();
  const canConfigure = can("smtp.configure");

  const [draft, setDraft] = useState<SmtpConfig>(smtpConfig);
  const [newCredential, setNewCredential] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("prowise_smtp_password") || "";
    }
    return "";
  });
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testingConn, setTestingConn] = useState(false);
  const [checkSteps, setCheckSteps] = useState<SmtpCheckStep[]>([]);
  const [testRecipient, setTestRecipient] = useState("superadmin@prowise.io");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(8);
  const [bulkDeleteLogsOpen, setBulkDeleteLogsOpen] = useState(false);

  const totalLogPages = Math.max(1, Math.ceil(emailLogs.length / logPageSize));
  const safeLogPage = Math.min(logPage, totalLogPages);
  const paginatedEmailLogs = useMemo(() => {
    const start = (safeLogPage - 1) * logPageSize;
    return emailLogs.slice(start, start + logPageSize);
  }, [emailLogs, safeLogPage, logPageSize]);

  const {
    selectedIds: selectedLogIds,
    setSelectedIds: setSelectedLogIds,
    selectedSet: selectedLogSet,
    allPageSelected: allLogsPageSelected,
    somePageSelected: someLogsPageSelected,
    toggleSelectPage: toggleSelectLogPage,
    toggleSelectOne: toggleSelectOneLog,
  } = useTableSelection(
    emailLogs.map((l) => l.id),
    paginatedEmailLogs.map((l) => l.id)
  );

  useEffect(() => {
    setDraft(smtpConfig);
  }, [smtpConfig]);

  const validate = (cfg: SmtpConfig) => {
    const errs: Record<string, string> = {};
    if (!cfg.host.trim()) errs.host = "Enter your email provider server address.";
    if (!cfg.port || cfg.port < 1 || cfg.port > 65535) errs.port = "Port must be between 1 and 65535.";
    if (!cfg.username.trim()) errs.username = "Account username is required.";
    if (!cfg.hasPasswordConfigured && !newCredential.trim()) {
      errs.credential = "Enter an API key or password to complete setup.";
    }
    if (!cfg.fromName.trim()) errs.fromName = "Sender display name is required.";
    if (!isValidEmail(cfg.fromEmail)) errs.fromEmail = "Enter a valid sender email address.";
    if (cfg.replyToEmail && !isValidEmail(cfg.replyToEmail)) errs.replyToEmail = "Enter a valid reply-to email.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const commitSave = () => {
    const rotated = Boolean(newCredential.trim());
    saveSmtpConfig(draft, rotated);
    if (newCredential.trim()) {
      try {
        localStorage.setItem("prowise_smtp_password", newCredential.trim());
      } catch {}
    }
    toast.success(
      rotated
        ? "Email gateway settings and credential saved successfully"
        : "Email delivery settings saved"
    );
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(draft)) return;
    if (newCredential.trim()) {
      setConfirmSaveOpen(true);
    } else {
      commitSave();
    }
  };

  const handleProviderChange = (provider: SmtpProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setDraft((prev) => ({
      ...prev,
      provider,
      host: preset.host,
      port: preset.port,
      encryption: preset.encryption,
      connectionStatus: "UNTESTED",
    }));
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    const res = await simulateSmtpHandshake(draft, newCredential);
    setCheckSteps(res.checks);
    recordSmtpTestResult(res.ok, res.message);
    setTestingConn(false);
    if (res.ok) toast.success("Simulated email connection test passed");
    else toast.error(res.message);
  };

  const handleSendTestEmail = async () => {
    if (!isValidEmail(testRecipient)) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }
    setSendingTestEmail(true);
    await new Promise((r) => setTimeout(r, 250));
    const res = sendSimulatedEmail({
      recipient: testRecipient.trim(),
      subject: `[ProWise Test] Email delivery verification from ${draft.fromName}`,
      source: "SMTP_TEST",
      detail: `Simulated test email sent to ${testRecipient.trim()}`,
    });
    setSendingTestEmail(false);
    if (res.ok) toast.success(`Simulated test email logged for ${testRecipient.trim()}`);
    else toast.error(res.error || "Simulated delivery failed");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="SMTP Email"
        description="Configure your outbound email service, sender identity, delivery limits, and connection readiness."
        simulationLabel="Simulated Mail Gateway"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/super-admin/security-keys">
              <AdminButton variant="outline" size="sm">
                <KeyRound className="w-3.5 h-3.5" />
                Platform Keys &amp; JWT
              </AdminButton>
            </Link>
            <StatusBadge
              label={`Connection: ${smtpConfig.connectionStatus}`}
              tone={getStatusTone(smtpConfig.connectionStatus)}
              dot
            />
          </div>
        }
      />

      <SimulationNotice
        title="Simulated Mail Delivery & Protected Credentials"
        description="Stored API keys and passwords are never displayed in the UI. Connection checks and test emails are simulated locally."
      />

      <form onSubmit={handleSaveSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
        <SurfaceCard className="xl:col-span-7 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Mail Provider &amp; Security
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose a managed provider preset or enter custom server details
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Lock className="w-3.5 h-3.5" /> Credentials Hidden
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Email Provider"
              value={draft.provider}
              disabled={!canConfigure}
              onChange={(e) => handleProviderChange(e.target.value as SmtpProvider)}
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
              label="Mail Server Address"
              value={draft.host}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, host: e.target.value, connectionStatus: "UNTESTED" })}
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
                onChange={(e) => setDraft({ ...draft, encryption: e.target.value as SmtpEncryption })}
                options={[
                  { label: "TLS (Recommended)", value: "TLS" },
                  { label: "SSL", value: "SSL" },
                  { label: "None", value: "NONE" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminInput
              label="Account Username"
              value={draft.username}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              error={errors.username}
            />
            <AdminInput
              label={
                smtpConfig.hasPasswordConfigured || newCredential
                  ? "API Key / Password (Click eye icon to view)"
                  : "API Key / Password"
              }
              type="password"
              value={newCredential}
              disabled={!canConfigure}
              onChange={(e) => setNewCredential(e.target.value)}
              placeholder="Enter provider key or Gmail App Password"
              helperText={
                smtpConfig.hasPasswordConfigured || newCredential
                  ? "Password stored securely • Toggle eye icon to view/verify plain text"
                  : undefined
              }
              error={errors.credential}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
            <AdminInput
              label="Sender Name"
              value={draft.fromName}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, fromName: e.target.value })}
              error={errors.fromName}
            />
            <AdminInput
              label="Sender Email"
              type="email"
              value={draft.fromEmail}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })}
              error={errors.fromEmail}
            />
            <AdminInput
              label="Reply-To Email"
              type="email"
              value={draft.replyToEmail}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, replyToEmail: e.target.value })}
              error={errors.replyToEmail}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
            <AdminInput
              label="Send Limit (per minute)"
              type="number"
              min={10}
              value={draft.rateLimitPerMinute}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, rateLimitPerMinute: Number(e.target.value) })}
            />
            <AdminInput
              label="Retry Attempts"
              type="number"
              min={0}
              max={10}
              value={draft.retryAttempts}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, retryAttempts: Number(e.target.value) })}
            />
            <AdminInput
              label="Retry Wait (seconds)"
              type="number"
              min={5}
              value={draft.retryBackoffSeconds}
              disabled={!canConfigure}
              onChange={(e) => setDraft({ ...draft, retryBackoffSeconds: Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={draft.trackOpens}
                disabled={!canConfigure}
                onChange={(e) => setDraft({ ...draft, trackOpens: e.target.checked })}
                className="accent-blue-600"
              />
              Track email opens
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={draft.trackClicks}
                disabled={!canConfigure}
                onChange={(e) => setDraft({ ...draft, trackClicks: e.target.checked })}
                className="accent-blue-600"
              />
              Track link clicks
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={draft.sandboxMode}
                disabled={!canConfigure}
                onChange={(e) => setDraft({ ...draft, sandboxMode: e.target.checked })}
                className="accent-blue-600"
              />
              Sandbox simulation mode
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton
              type="button"
              variant="outline"
              isLoading={testingConn}
              permissionLocked={!canConfigure}
              onClick={handleTestConnection}
            >
              <Wifi className="w-3.5 h-3.5" />
              Test Connection
            </AdminButton>
            <AdminButton type="submit" variant="primary" permissionLocked={!canConfigure}>
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </AdminButton>
          </div>
        </SurfaceCard>

        {/* Right: Plain-Language Readiness Checklist & Test Email */}
        <div className="xl:col-span-5 space-y-4 min-w-0">
          <SurfaceCard className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                Connection Readiness Checklist
              </span>
              {smtpConfig.lastTestedAt && (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Checked {formatDateTime(smtpConfig.lastTestedAt)}
                </span>
              )}
            </div>

            {checkSteps.length > 0 ? (
              <div className="space-y-2">
                {checkSteps.map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                      step.passed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-text-primary)]"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                    }`}
                  >
                    {step.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{step.label}</p>
                      <p className="text-[11px] opacity-90 mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs text-[var(--color-text-secondary)]">
                <CheckCircle2 className="w-4 h-4 inline mr-1.5 text-emerald-500" />
                {smtpConfig.lastTestMessage || "Click 'Test Connection' to verify your email gateway settings."}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Send Simulated Test Email
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Verify delivery routing and record a sample message in the dispatch log
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <AdminInput
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="recipient@company.com"
              />
              <AdminButton
                type="button"
                variant="secondary"
                isLoading={sendingTestEmail}
                permissionLocked={!canConfigure}
                onClick={handleSendTestEmail}
              >
                <Send className="w-3.5 h-3.5" />
                Send Test
              </AdminButton>
            </div>
          </SurfaceCard>
        </div>
      </form>

      {/* Recent Email Dispatch Log */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Simulated Email Delivery Log
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Recent test dispatches, invoice notices, and announcement broadcasts
              </p>
            </div>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">{emailLogs.length} events</span>
        </div>

        <BulkSelectionBar
          selectedCount={selectedLogIds.length}
          totalFilteredCount={emailLogs.length}
          onSelectAllMatching={() => setSelectedLogIds(emailLogs.map((l) => l.id))}
          onClear={() => setSelectedLogIds([])}
          actions={
            <>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={() => {
                  const targets = emailLogs.filter((l) => selectedLogSet.has(l.id));
                  exportRowsToCsv(
                    "prowise-email-delivery-log.csv",
                    ["Sr. No.", "Recipient", "Subject", "Source", "Status", "Sent At"],
                    targets.map((l, idx) => [
                      idx + 1,
                      l.recipient,
                      l.subject,
                      l.source,
                      l.status,
                      l.sentAt,
                    ])
                  );
                  toast.success(`Exported ${targets.length} email log entr${targets.length === 1 ? "y" : "ies"}`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
              <AdminButton
                variant="danger"
                size="xs"
                permissionLocked={!canConfigure}
                onClick={() => setBulkDeleteLogsOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </AdminButton>
            </>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allLogsPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someLogsPageSelected;
                    }}
                    onChange={toggleSelectLogPage}
                    aria-label="Select all email logs on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 hidden md:table-cell">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell text-right">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {paginatedEmailLogs.map((log, idx) => {
                const serialNumber = (safeLogPage - 1) * logPageSize + idx + 1;
                const isSelected = selectedLogSet.has(log.id);
                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-[var(--color-hover)] transition-colors ${
                      isSelected ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOneLog(log.id)}
                        aria-label={`Select email log for ${log.recipient}`}
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                      {serialNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {getOrgInitials(log.recipient.replace(/^audience:/i, ""))}
                        </div>
                        <span className="font-semibold text-[var(--color-text-primary)] truncate max-w-[180px]">
                          {log.recipient}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--color-text-primary)] font-semibold">{log.subject}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{log.detail}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${getEmailSourceBadgeClass(
                          log.source
                        )}`}
                      >
                        {log.source.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={log.status.replace(/_/g, " ")} tone={getStatusTone(log.status)} dot />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-right text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatDateTime(log.sentAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <PaginationBar
          currentPage={safeLogPage}
          totalItems={emailLogs.length}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={(n) => {
            setLogPageSize(n);
            setLogPage(1);
          }}
        />
      </SurfaceCard>

      <ConfirmActionModal
        isOpen={bulkDeleteLogsOpen}
        onClose={() => setBulkDeleteLogsOpen(false)}
        title={`Remove ${selectedLogIds.length} selected delivery log${selectedLogIds.length === 1 ? "" : "s"}?`}
        description="Selected simulated email log entries will be cleared from local delivery history."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={() => {
          const count = selectedLogIds.length;
          deleteEmailLogs(selectedLogIds);
          toast.success(`Removed ${count} email log entr${count === 1 ? "y" : "ies"}`);
          setSelectedLogIds([]);
        }}
      />

      <ConfirmActionModal
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        title="Rotate Email Gateway Credential?"
        description="Saving replaces the stored mail server password or API key. This sensitive change is recorded in the audit log."
        confirmLabel="Save & Rotate Credential"
        variant="primary"
        onConfirm={commitSave}
      />
    </div>
  );
}
