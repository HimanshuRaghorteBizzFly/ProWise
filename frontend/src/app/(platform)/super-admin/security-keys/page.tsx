"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Lock, Mail, ServerCog, ShieldAlert } from "lucide-react";
import { apiClient, type SmtpSettingsResponse } from "@/lib/api";
import { AdminButton, PageHeader, StatusBadge, SurfaceCard, getStatusTone } from "../_components/SuperAdminPrimitives";

/**
 * Platform secrets live only on the server (environment variables or a secret manager). This page never reads,
 * stores or displays a secret value; it documents what the server needs and shows live, non-secret status.
 */
const SERVER_SECRETS: { name: string; purpose: string; required: string }[] = [
  { name: "JWT_SIGNING_KEY", purpose: "Signs access tokens. Random, at least 32 bytes.", required: "Always" },
  { name: "DB_URL / DB_USERNAME / DB_PASSWORD", purpose: "PostgreSQL connection.", required: "Always" },
  { name: "SMTP_HOST / SMTP_PORT / SMTP_USERNAME", purpose: "Outgoing email server (fallback until saved in SMTP Email).", required: "Production" },
  { name: "SMTP_PASSWORD", purpose: "SMTP password or Gmail App Password (fallback until saved in SMTP Email).", required: "Production" },
  { name: "SMTP_FROM", purpose: "Default sender address.", required: "Production" },
  { name: "SMTP_CREDENTIAL_ENCRYPTION_KEY", purpose: "Encrypts an SMTP password saved from the SMTP Email page (AES-256-GCM).", required: "To save SMTP passwords in the panel" },
  { name: "FRONTEND_URL / CORS_ALLOWED_ORIGINS", purpose: "Links in emails and allowed browser origins.", required: "Production" },
  { name: "PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL", purpose: "First Super Admin (receives a setup link). Remove once active.", required: "First start only" },
];

const LEGACY_BROWSER_KEYS = ["prowise_platform_secrets", "prowise_smtp_password"];

export default function SuperAdminSecurityKeysPage() {
  const [smtp, setSmtp] = useState<SmtpSettingsResponse | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [removedLegacy, setRemovedLegacy] = useState(false);

  useEffect(() => {
    // Earlier versions of this page kept secrets in browser storage. Remove any copies left behind.
    try {
      let removed = false;
      for (const key of LEGACY_BROWSER_KEYS) {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed = true;
        }
      }
      setRemovedLegacy(removed);
    } catch {
      // storage unavailable: nothing to clean
    }
    apiClient.smtp
      .settings()
      .then(setSmtp)
      .catch((error: unknown) => setSmtpError(error instanceof Error ? error.message : "Could not load SMTP status."));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Keys & Secrets"
        description="Signing keys, database credentials and SMTP passwords are server-side secrets. They are never sent to or stored in the browser."
        actions={
          <Link href="/super-admin/email-settings">
            <AdminButton variant="outline" size="sm">
              <Mail className="w-3.5 h-3.5" />
              SMTP Email
            </AdminButton>
          </Link>
        }
      />

      {removedLegacy && (
        <SurfaceCard className="p-4 text-xs text-amber-800 dark:text-amber-200 border-amber-500/30 bg-amber-500/10">
          <ShieldAlert className="w-4 h-4 inline mr-1.5" />
          Secrets saved in this browser by an earlier version of this page were deleted. If any of them were real, rotate them.
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SurfaceCard className="xl:col-span-8 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
            <ServerCog className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Server configuration</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Set these as environment variables on the API server (locally in <code className="font-mono">backend/.env</code>, which is git-ignored).
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="py-2 pr-3">Variable</th>
                  <th className="py-2 pr-3">Purpose</th>
                  <th className="py-2">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {SERVER_SECRETS.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">{s.name}</td>
                    <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{s.purpose}</td>
                    <td className="py-2 text-[var(--color-text-muted)] whitespace-nowrap">{s.required}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Generate random keys on the server, for example <code className="font-mono">openssl rand -base64 48</code>. Never commit them or paste
            them into a browser.
          </p>
        </SurfaceCard>

        <div className="xl:col-span-4 space-y-4">
          <SurfaceCard className="p-4 sm:p-5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Mail className="w-4 h-4 text-blue-500" /> Outgoing email (live)
            </div>
            {smtpError && <p className="text-rose-700 dark:text-rose-300">{smtpError}</p>}
            {!smtp && !smtpError && <p className="text-[var(--color-text-muted)]">Loading…</p>}
            {smtp && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                <dt className="text-[var(--color-text-muted)]">Connection</dt>
                <dd>
                  <StatusBadge label={smtp.connection_status.replace(/_/g, " ")} tone={getStatusTone(smtp.connection_status)} dot />
                </dd>
                <dt className="text-[var(--color-text-muted)]">Server</dt>
                <dd className="break-all">
                  {smtp.host || "—"}:{smtp.port} ({smtp.encryption})
                </dd>
                <dt className="text-[var(--color-text-muted)]">Password</dt>
                <dd>{smtp.credentials_configured ? `configured (${smtp.password_source.toLowerCase()})` : "not configured"}</dd>
                <dt className="text-[var(--color-text-muted)]">Encryption key</dt>
                <dd>{smtp.encryption_key_configured ? "configured" : "missing (SMTP_CREDENTIAL_ENCRYPTION_KEY)"}</dd>
              </dl>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 space-y-2 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Lock className="w-4 h-4 text-emerald-500" /> Why nothing is editable here
            </div>
            <p>
              Anything a browser can read can leak. JWT signing keys and database passwords therefore stay on the server and are changed by
              redeploying with new environment values.
            </p>
            <p>
              <KeyRound className="w-3.5 h-3.5 inline mr-1" />
              The only secret you can enter in the admin UI is the SMTP password on the SMTP Email page. It is sent once over HTTPS,
              encrypted on the server and never returned.
            </p>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
