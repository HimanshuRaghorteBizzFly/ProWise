"use client";

import React, { useMemo, useState } from "react";
import { Download, FileStack } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type ReviewStatus } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  Avatar,
  DataTable,
  FilterBar,
  PageFrame,
  ReviewStatusBadge,
  SegmentTabs,
  SurfaceCard,
  formatDateTime,
  hoursSince,
  formatWaiting,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { downloadCsv, generateCsv } from "@/lib/csv";

type Filter = "ALL" | ReviewStatus;

export default function ReviewerHistoryPage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allReviews = useDeliveryStore((s) => s.reviews);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const mine = useMemo(
    () => (forceEmpty ? [] : allReviews.filter((r) => r.reviewerId === VIEWERS.reviewer.id)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [allReviews, forceEmpty]
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((r) => (filter === "ALL" || r.status === filter) && (!q || r.code.toLowerCase().includes(q) || (lk.task(r.taskId)?.title.toLowerCase().includes(q) ?? false)));
  }, [mine, search, filter, lk]);

  const turnaround = (submittedAt: string, decidedAt?: string) =>
    decidedAt ? formatWaiting(Math.max(0, hoursSince(submittedAt) - hoursSince(decidedAt))) : "—";

  const exportCsv = () => {
    downloadCsv(
      "review-history.csv",
      generateCsv(
        ["Code", "Task", "Developer", "Status", "Submitted (UTC)", "Decided (UTC)", "Reason"],
        rows.map((r) => [r.code, lk.task(r.taskId)?.title ?? "", lk.person(r.submittedById)?.name ?? "", r.status, r.submittedAt, r.decidedAt ?? "", r.reason ?? ""])
      )
    );
    toast.success(`Exported ${rows.length} reviews`);
  };

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Records" }, { label: "Review history" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Review history"
      description="Every review assigned to you, newest first."
      status={status}
      onRetry={retry}
      skeleton="list"
      actions={<AdminButton variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="w-3.5 h-3.5" /> Export CSV</AdminButton>}
    >
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search code or task" hasActiveFilters={Boolean(search) || filter !== "ALL"} onResetFilters={() => { setSearch(""); setFilter("ALL"); }} />
      <SegmentTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "ALL", label: "All", count: mine.length },
          { value: "PENDING", label: "Pending", count: mine.filter((r) => r.status === "PENDING").length },
          { value: "APPROVED", label: "Approved", count: mine.filter((r) => r.status === "APPROVED").length },
          { value: "CHANGES_REQUESTED", label: "Changes", count: mine.filter((r) => r.status === "CHANGES_REQUESTED").length },
        ]}
      />
      <SurfaceCard className="overflow-hidden">
        <DataTable
          rows={rows}
          rowHref={(r) => href(`reviews/${r.id}`)}
          empty={{ icon: FileStack, title: mine.length ? "No reviews match" : "No history yet", description: mine.length ? "Adjust the search or filter." : "Reviews you handle will be recorded here." }}
          columns={[
            { key: "t", header: "Review", className: "w-[52%] md:w-[34%]", render: (r) => <div className="min-w-0"><p className="font-semibold truncate">{lk.task(r.taskId)?.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.code} · round {r.round}</p></div> },
            { key: "s", header: "Outcome", render: (r) => <ReviewStatusBadge status={r.status} /> },
            { key: "d", header: "Developer", hideBelow: "md", render: (r) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.person(r.submittedById)} size="sm" /><span className="truncate">{lk.person(r.submittedById)?.name}</span></span> },
            { key: "sub", header: "Submitted", hideBelow: "lg", render: (r) => formatDateTime(r.submittedAt) },
            { key: "ta", header: "Turnaround", hideBelow: "sm", render: (r) => <span className="tabular-nums">{turnaround(r.submittedAt, r.decidedAt)}</span> },
          ]}
        />
      </SurfaceCard>
    </PageFrame>
  );
}
