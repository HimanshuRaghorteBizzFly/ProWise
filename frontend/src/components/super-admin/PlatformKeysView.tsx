"use client";

import React from "react";
import Link from "next/link";
import { KeyRound, Lock, Mail, RefreshCw, ServerCog, ShieldAlert } from "lucide-react";
import type { SmtpSettingsResponse } from "@/lib/api";
import type { PlatformKeyItem, PlatformKeysResponse } from "@/types/admin";
import {
  AdminButton,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, mutedCellClass, type ResourceState } from "./admin-resource";

/**
 * The value shown for one setting. A secret never shows a value, even if a misbehaving server sent one: only its
 * configured / missing status is displayed.
 */
export function displayedKeyValue(item: PlatformKeyItem): string {
  if (item.secret) return "";
  return item.value ?? "";
}

export interface PlatformKeysViewProps {
  keys: ResourceState<PlatformKeysResponse>;
  smtp: ResourceState<SmtpSettingsResponse>;
  removedLegacy: boolean;
  onRetryKeys: () => void;
  onRetrySmtp: () => void;
}

/** Read-only status of server-side settings. No inputs, no edit, no generate: keys are managed on the server. */
export function PlatformKeysView({ keys, smtp, removedLegacy, onRetryKeys, onRetrySmtp }: PlatformKeysViewProps) {
  const rows = keys.status === "ready" ? keys.data.keys ?? [] : [];
  const missingRequired = rows.filter((k) => k.required && !k.configured).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Keys & Secrets"
        description="Signing keys, database credentials and SMTP passwords are server-side settings. This page shows only whether each one is configured; secret values never reach the browser."
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetryKeys}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            <Link href="/super-admin/email-settings">
              <AdminButton variant="outline" size="sm">
                <Mail className="w-3.5 h-3.5" />
                SMTP Email
              </AdminButton>
            </Link>
          </>
        }
      />

      {removedLegacy && (
        <SurfaceCard className="p-4 text-xs text-amber-800 dark:text-amber-200 border-amber-500/30 bg-amber-500/10">
          <ShieldAlert className="w-4 h-4 inline mr-1.5" />
          Secrets saved in this browser by an earlier version of this page were deleted. If any of them were real, rotate them.
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SurfaceCard className="xl:col-span-8 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <ServerCog className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Server configuration</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Set as environment variables on the API server. {keys.status === "ready" && missingRequired > 0
                  ? `${missingRequired} required setting${missingRequired === 1 ? " is" : "s are"} missing.`
                  : ""}
              </p>
            </div>
          </div>
          <ResourceStatus
            state={keys}
            isEmpty={(d) => (d.keys ?? []).length === 0}
            onRetry={onRetryKeys}
            emptyIcon={KeyRound}
            emptyTitle="No settings reported"
            emptyDescription="The server returned no configuration entries."
          />
          {rows.length > 0 && (
            <AdminTable label="Server settings" headers={["Variable", "Category", "Purpose", "Required", "Status", "Value"]}>
              {rows.map((item) => {
                const value = displayedKeyValue(item);
                return (
                  <tr key={item.key}>
                    <td className={`${cellClass} font-mono text-[11px] whitespace-nowrap`}>{item.key}</td>
                    <td className={`${mutedCellClass} whitespace-nowrap`}>{item.category}</td>
                    <td className={mutedCellClass}>{item.purpose}</td>
                    <td className={`${mutedCellClass} whitespace-nowrap`}>{item.required ? "Required" : "Optional"}</td>
                    <td className={cellClass}>
                      <StatusBadge
                        label={item.configured ? "Configured" : "Missing"}
                        tone={item.configured ? "success" : item.required ? "danger" : "neutral"}
                        dot
                      />
                    </td>
                    <td className={`${mutedCellClass} font-mono text-[11px] break-all`}>
                      {item.secret ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Lock className="w-3 h-3" /> Secret (not shown)
                        </span>
                      ) : value ? (
                        value
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </AdminTable>
          )}
          <p className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
            Generate random keys on the server, for example <code className="font-mono">openssl rand -base64 48</code>, and
            redeploy. Never commit them or paste them into a browser.
          </p>
        </SurfaceCard>

        <div className="xl:col-span-4 space-y-4">
          <SurfaceCard className="p-4 sm:p-5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Mail className="w-4 h-4 text-blue-500" /> Outgoing email (live)
            </div>
            {smtp.status === "loading" && <p className="text-[var(--color-text-muted)]">Loading SMTP status...</p>}
            {smtp.status === "error" && (
              <div className="space-y-2">
                <p className="text-rose-700 dark:text-rose-300">{smtp.message}</p>
                <AdminButton variant="outline" size="xs" onClick={onRetrySmtp}>
                  Retry
                </AdminButton>
              </div>
            )}
            {smtp.status === "ready" && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                <dt className="text-[var(--color-text-muted)]">Connection</dt>
                <dd>
                  <StatusBadge
                    label={smtp.data.connection_status.replace(/_/g, " ")}
                    tone={getStatusTone(smtp.data.connection_status)}
                    dot
                  />
                </dd>
                <dt className="text-[var(--color-text-muted)]">Server</dt>
                <dd className="break-all">
                  {smtp.data.host || "-"}:{smtp.data.port} ({smtp.data.encryption})
                </dd>
                <dt className="text-[var(--color-text-muted)]">Password</dt>
                <dd>
                  {smtp.data.credentials_configured
                    ? `configured (${smtp.data.password_source.toLowerCase()})`
                    : "not configured"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Encryption key</dt>
                <dd>{smtp.data.encryption_key_configured ? "configured" : "missing (SMTP_CREDENTIAL_ENCRYPTION_KEY)"}</dd>
              </dl>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 space-y-2 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Lock className="w-4 h-4 text-emerald-500" /> Why nothing is editable here
            </div>
            <p>
              Anything a browser can read can leak. JWT signing keys and database passwords therefore stay on the server and
              are changed by redeploying with new environment values.
            </p>
            <p>
              <KeyRound className="w-3.5 h-3.5 inline mr-1" />
              The only secret you can enter in the admin UI is the SMTP password on the SMTP Email page. It is sent once over
              HTTPS, encrypted on the server and never returned.
            </p>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
