"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Mail,
  MailWarning,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
  OpSelect,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type EmailDeliverySortField = "messageRef" | "recipient" | "channel" | "status" | "timestamp";

export default function OperatorEmailDeliveryPage() {
  const smtpHealth = usePlatformOperatorStore((s) => s.smtpHealth);
  const emailDeliveries = usePlatformOperatorStore((s) => s.emailDeliveries);
  const checkSmtpHealth = usePlatformOperatorStore((s) => s.checkSmtpHealth);
  const resendEmailDelivery = usePlatformOperatorStore((s) => s.resendEmailDelivery);
  const bulkResendEmails = usePlatformOperatorStore((s) => s.bulkResendEmails);
  const { can } = useOperatorPermissions();
  const canManage = can("communications.draft");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<EmailDeliverySortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [checking, setChecking] = useState(false);

  const bouncedCount = useMemo(
    () =>
      emailDeliveries.filter((e) => e.status === "Bounced" || e.status === "Failed").length,
    [emailDeliveries]
  );

  const handleSort = (field: EmailDeliverySortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = emailDeliveries.filter((item) => {
      const matchesQ =
        !q ||
        item.messageRef.toLowerCase().includes(q) ||
        item.recipient.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        (item.bounceReason || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "messageRef") cmp = a.messageRef.localeCompare(b.messageRef);
      else if (sortField === "recipient") cmp = a.recipient.localeCompare(b.recipient);
      else if (sortField === "channel") cmp = a.channel.localeCompare(b.channel);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [emailDeliveries, search, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filtered.map((e) => e.id),
    paginated.map((e) => e.id)
  );

  const handleCheckSmtp = () => {
    setChecking(true);
    setTimeout(() => {
      checkSmtpHealth();
      setChecking(false);
      toast.success("SMTP mail relay health check passed (simulated).");
    }, 300);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Delivery & SMTP Health"
        badge={smtpHealth.connectionState}
        demoLabel="Demo Delivery Telemetry"
        description="Monitor transactional email placement, investigate bounced or deferred messages, and verify mail relay readiness."
        actions={
          <OpButton variant="primary" size="sm" isLoading={checking} onClick={handleCheckSmtp}>
            <RefreshCw className="w-3.5 h-3.5" />
            Check Relay Health
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Credential Protection"
        description="Operators inspect delivery logs and requeue bounced emails. SMTP server passwords and API keys are securely hidden and governed by Super Admin."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Inbox Placement Rate"
          value={`${smtpHealth.inboxPlacementPct}%`}
          sublabel={smtpHealth.providerLabel}
          icon={Mail}
          tone="emerald"
        />
        <KpiCard
          label="Bounce Rate"
          value={`${smtpHealth.bounceRatePct}%`}
          sublabel={`${bouncedCount} undelivered message(s) in log`}
          icon={MailWarning}
          tone={bouncedCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Daily Emails Sent"
          value={smtpHealth.dailySent.toLocaleString()}
          sublabel={`Of ${smtpHealth.dailyQuota.toLocaleString()} daily relay limit`}
          icon={Send}
          tone="teal"
        />
        <KpiCard
          label="Relay Checks Passed"
          value={`${smtpHealth.checks.filter((c) => c.passed).length} / ${smtpHealth.checks.length}`}
          sublabel={`Checked ${formatDateTime(smtpHealth.lastCheckedAt)}`}
          icon={CheckCircle2}
          tone="blue"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Mail Relay Readiness Checklist
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {smtpHealth.checks.map((chk) => (
            <div
              key={chk.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[var(--color-text-primary)]">{chk.label}</strong>
                <StatusBadge
                  label={chk.passed ? "Passed" : "Issue"}
                  tone={chk.passed ? "success" : "danger"}
                />
              </div>
              <p className="text-[var(--color-text-secondary)]">{chk.detail}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search recipient, subject, or message ref..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="w-40">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter email status"
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Delivered", value: "Delivered" },
                  { label: "Bounced", value: "Bounced" },
                  { label: "Deferred", value: "Deferred" },
                  { label: "Failed", value: "Failed" },
                ]}
              />
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email logs found"
            description="No email delivery records match your filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((e) => e.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    const count = bulkResendEmails(selectedIds);
                    if (count > 0) toast.success(`Re-queued ${count} undelivered email(s).`);
                    else toast.info("Selected emails are already delivered.");
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resend Selected ({selectedIds.length})
                </OpButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected;
                        }}
                        onChange={toggleSelectPage}
                        aria-label="Select all email records on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Message Ref" active={sortField === "messageRef"} direction={sortDir} onSort={() => handleSort("messageRef")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Recipient & Subject" active={sortField === "recipient"} direction={sortDir} onSort={() => handleSort("recipient")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Channel" active={sortField === "channel"} direction={sortDir} onSort={() => handleSort("channel")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Timestamp" active={sortField === "timestamp"} direction={sortDir} onSort={() => handleSort("timestamp")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((item, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.messageRef}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 font-semibold whitespace-nowrap">{item.messageRef}</td>
                        <td className="py-3 px-3.5 min-w-[240px]">
                          <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            To: {item.recipient}
                          </p>
                          {item.bounceReason && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                              {item.bounceReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.channel} tone="neutral" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.status} tone={getStatusTone(item.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(item.timestamp)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          {item.status !== "Delivered" && (
                            <OpButton
                              variant="primary"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => {
                                resendEmailDelivery(item.id);
                                toast.success(`Re-sent ${item.messageRef} to ${item.recipient} (simulated).`);
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Resend
                            </OpButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
