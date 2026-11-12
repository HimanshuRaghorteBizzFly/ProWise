"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileWarning,
  ShieldCheck,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { SubscriptionRecord } from "../_types";
import { exportRowsToCsv, formatShortDate } from "../_services/operator-service";
import {
  BulkSelectionBar,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
  OpModal,
  OpSelect,
  OpTextarea,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type SubSortField = "orgName" | "planName" | "status" | "seatsUsed" | "renewalDate";

export default function OperatorSubscriptionStatusPage() {
  const subscriptions = usePlatformOperatorStore((s) => s.subscriptions);
  const updateSubscriptionNote = usePlatformOperatorStore((s) => s.updateSubscriptionNote);
  const { can } = useOperatorPermissions();
  const canTriage = can("billing.triage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SubSortField>("orgName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [noteTarget, setNoteTarget] = useState<SubscriptionRecord | null>(null);
  const [noteText, setNoteText] = useState("");

  const activeCount = useMemo(
    () => subscriptions.filter((s) => s.status === "Active" || s.status === "Trial").length,
    [subscriptions]
  );
  const pastDueOrSuspended = useMemo(
    () => subscriptions.filter((s) => s.status === "Past Due" || s.status === "Suspended").length,
    [subscriptions]
  );

  const handleSort = (field: SubSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "seatsUsed" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = subscriptions.filter((s) => {
      const matchesQ =
        !q ||
        s.orgName.toLowerCase().includes(q) ||
        s.planName.toLowerCase().includes(q) ||
        s.supportNote.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "planName") cmp = a.planName.localeCompare(b.planName);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "seatsUsed") cmp = a.seatsUsed - b.seatsUsed;
      else cmp = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [subscriptions, search, statusFilter, sortField, sortDir]);

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
    filtered.map((s) => s.id),
    paginated.map((s) => s.id)
  );

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTarget) return;
    updateSubscriptionNote(noteTarget.id, noteText.trim());
    toast.success(`Support note updated for ${noteTarget.orgName}.`);
    setNoteTarget(null);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-subscription-status-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Organization", "Plan", "Cycle", "Status", "Seats Used", "Seats Limit", "Renewal Date", "Support Note"],
      filtered.map((s, i) => [
        i + 1,
        s.orgName,
        s.planName,
        s.billingCycle,
        s.status,
        s.seatsUsed,
        s.seatsLimit,
        s.renewalDate,
        s.supportNote,
      ])
    );
    toast.success(`Exported ${filtered.length} subscription record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Status"
        badge="Read-Only + Support Notes"
        demoLabel="Delegated Billing Monitoring"
        description="Monitor organization subscription health, license seat headroom, and upcoming renewals to assist customers proactively."
        actions={
          <Link href="/platform-operator/payment-failures">
            <OpButton variant="outline" size="sm">
              <FileWarning className="w-3.5 h-3.5" />
              Payment Failures
            </OpButton>
          </Link>
        }
      />

      <DemoDataBanner
        title="Role Boundary"
        description="Plan upgrades, pricing changes, refunds, and suspensions are governed exclusively by Super Admin. Platform Operators monitor status and add support coordination notes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active & Trial Accounts"
          value={activeCount}
          sublabel="Operating in good standing"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Past Due / Suspended"
          value={pastDueOrSuspended}
          sublabel="Requires customer payment follow-up"
          icon={AlertTriangle}
          tone={pastDueOrSuspended > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Total Monitored Subscriptions"
          value={subscriptions.length}
          sublabel="Across Starter, Growth, and Enterprise"
          icon={ShieldCheck}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, plan, or coordination note..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="w-44">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter subscription status"
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Active", value: "Active" },
                  { label: "Trial", value: "Trial" },
                  { label: "Past Due", value: "Past Due" },
                  { label: "Suspended", value: "Suspended" },
                  { label: "Cancelled", value: "Cancelled" },
                ]}
              />
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No subscriptions found"
            description="No subscription records match your current search or filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((s) => s.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const selectedList = subscriptions.filter((s) => selectedSet.has(s.id));
                    exportRowsToCsv(
                      `prowise-selected-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Organization", "Plan", "Cycle", "Status", "Seats Used", "Renewal Date", "Support Note"],
                      selectedList.map((s) => [
                        s.orgName,
                        s.planName,
                        s.billingCycle,
                        s.status,
                        s.seatsUsed,
                        s.renewalDate,
                        s.supportNote,
                      ])
                    );
                    toast.success(`Exported ${selectedList.length} selected subscription(s).`);
                  }}
                >
                  Export Selected ({selectedIds.length})
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
                        aria-label="Select all subscriptions on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Plan & Billing" active={sortField === "planName"} direction={sortDir} onSort={() => handleSort("planName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Seat Utilization" active={sortField === "seatsUsed"} direction={sortDir} onSort={() => handleSort("seatsUsed")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Renewal Date" active={sortField === "renewalDate"} direction={sortDir} onSort={() => handleSort("renewalDate")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Support Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((sub, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(sub.id);
                    const pct = Math.min(100, Math.round((sub.seatsUsed / sub.seatsLimit) * 100));
                    return (
                      <tr key={sub.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(sub.id)}
                            aria-label={`Select ${sub.orgName}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 min-w-[220px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(sub.orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">{sub.orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {sub.supportNote || "No support note"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <p className="font-medium text-[var(--color-text-primary)]">{sub.planName}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{sub.billingCycle}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={sub.status} tone={getStatusTone(sub.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 min-w-[140px]">
                          <div className="flex justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                            <span>
                              {sub.seatsUsed} / {sub.seatsLimit} seats
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatShortDate(sub.renewalDate)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <OpButton
                            variant="outline"
                            size="xs"
                            disabled={!canTriage}
                            onClick={() => {
                              setNoteTarget(sub);
                              setNoteText(sub.supportNote);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Note
                          </OpButton>
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

      <OpModal
        isOpen={Boolean(noteTarget)}
        onClose={() => setNoteTarget(null)}
        title={noteTarget ? `Support Note — ${noteTarget.orgName}` : "Support Note"}
        description="Share billing coordination context with fellow operators and Super Admin."
        maxWidth="md"
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
          <OpTextarea
            label="Operator Coordination Note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Customer confirmed corporate card replacement is scheduled for Friday..."
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setNoteTarget(null)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Save Note
            </OpButton>
          </div>
        </form>
      </OpModal>
    </div>
  );
}
