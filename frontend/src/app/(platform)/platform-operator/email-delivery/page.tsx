"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { operatorApi } from "../_services/operator-api";
import { OperatorResourceStatus, rowsOf, useOperatorResource } from "../_components/OperatorLive";
import { formatDateTime } from "../_services/operator-service";
import {
  FilterBar,
  KpiCard,
  OpButton,
  OpSelect,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/OperatorPrimitives";

const STATUSES = ["ALL", "SMTP_ACCEPTED", "FAILED", "NOT_SENT", "PROCESSING", "QUEUED", "RETRY_PENDING"];

/**
 * Read-only view of the platform's real email delivery log. Operators can see what the SMTP server answered;
 * they cannot change SMTP settings or "retry" a logged email (account links are single use and never stored).
 */
export default function OperatorEmailDeliveryPage() {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { state, reload } = useOperatorResource(() => operatorApi.emailDelivery.list(status), `email-delivery:${status}`);
  const loading = state.status === "loading";
  const rows = useMemo(() => rowsOf(state), [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.recipient.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const accepted = rows.filter((r) => r.status === "SMTP_ACCEPTED").length;
  const failed = rows.filter((r) => r.status === "FAILED" || r.status === "NOT_SENT").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Delivery"
        liveData
        description="Every email the platform attempted and what the SMTP server answered. SMTP accepted is not proof of inbox delivery."
        actions={
          <OpButton variant="outline" size="sm" isLoading={loading} onClick={() => void reload()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Mail} label="Attempts shown" value={state.status === "ready" ? rows.length : "—"} />
        <KpiCard icon={CheckCircle2} label="Accepted by SMTP server" value={state.status === "ready" ? accepted : "—"} />
        <KpiCard icon={AlertTriangle} label="Failed or not sent" value={state.status === "ready" ? failed : "—"} />
      </div>

      <SurfaceCard className="overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search recipient or subject"
          filters={
            <OpSelect
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={STATUSES.map((s) => ({ label: s === "ALL" ? "All statuses" : s.replace(/_/g, " "), value: s }))}
            />
          }
        />

        {state.status !== "ready" || filtered.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: filtered } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={Mail}
            emptyTitle="No email delivery attempts"
            emptyDescription="Nothing matches these filters yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Error</th>
                  <th className="px-4 py-3 hidden md:table-cell text-right">Created / Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] break-all">
                      {row.recipient}
                      <div className="text-[10px] text-[var(--color-text-muted)]">{row.provider ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.subject}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={row.status.replace(/_/g, " ")} tone={getStatusTone(row.status)} dot />
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                        {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[11px] text-rose-700 dark:text-rose-300 max-w-[320px] break-words">
                      {row.error_message ?? row.error_code ?? ""}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-right text-[var(--color-text-muted)] whitespace-nowrap">
                      <div>{formatDateTime(row.created_at ?? "")}</div>
                      <div className="text-[10px]">{row.sent_at ? `sent ${formatDateTime(row.sent_at)}` : "not sent"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>
    </div>
  );
}
