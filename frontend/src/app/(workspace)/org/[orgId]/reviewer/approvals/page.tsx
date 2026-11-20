"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { REVIEWER_WEEKLY_OUTCOMES, VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  EmptyStateView,
  PageFrame,
  Panel,
  ReviewStatusBadge,
  SegmentTabs,
  SurfaceCard,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart } from "@/components/delivery/DeliveryCharts";

type Filter = "APPROVED" | "CHANGES_REQUESTED";

export default function ReviewerOutcomesPage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allReviews = useDeliveryStore((s) => s.reviews);
  const [tab, setTab] = useState<Filter>("CHANGES_REQUESTED");
  const decided = useMemo(
    () => (forceEmpty ? [] : allReviews.filter((r) => r.reviewerId === VIEWERS.reviewer.id && r.status !== "PENDING")).sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")),
    [allReviews, forceEmpty]
  );
  const approved = decided.filter((r) => r.status === "APPROVED").length;
  const rows = decided.filter((r) => r.status === tab);

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Inspect" }, { label: "Outcomes" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Approved vs changes requested"
      description="How your decisions split, and the reasons you gave."
      status={status}
      onRetry={retry}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="All decisions" icon={ClipboardCheck} iconTone="emerald">
          <DonutChart
            centerLabel="decided"
            data={[
              { name: "Approved", value: approved, color: "#10B981" },
              { name: "Changes requested", value: decided.length - approved, color: "#F43F5E" },
            ]}
          />
        </Panel>
        <Panel className="xl:col-span-2" title="Per week" icon={CheckCircle2} iconTone="blue">
          <GroupedBarChart data={REVIEWER_WEEKLY_OUTCOMES} primaryLabel="Approved" secondaryLabel="Changes requested" primaryColor="#10B981" secondaryColor="#F43F5E" />
        </Panel>
      </div>
      <SegmentTabs<Filter>
        value={tab}
        onChange={setTab}
        options={[
          { value: "CHANGES_REQUESTED", label: "Changes requested", count: decided.length - approved },
          { value: "APPROVED", label: "Approved", count: approved },
        ]}
      />
      {rows.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={tab === "APPROVED" ? CheckCircle2 : RotateCcw} title="No decisions here" description="Decisions you make will be listed with their reasons." /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r) => (
            <Link key={r.id} href={href(`reviews/${r.id}`)} className="block rounded-xl">
              <SurfaceCard className={`h-full p-4 space-y-2.5 border-l-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${r.status === "APPROVED" ? "border-l-emerald-500" : "border-l-rose-500"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{lk.task(r.taskId)?.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{r.code} · round {r.round} · {lk.project(r.projectId)?.name}</p>
                  </div>
                  <ReviewStatusBadge status={r.status} />
                </div>
                <blockquote className="rounded-lg bg-[var(--color-app-bg)] border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">“{r.reason}”</blockquote>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1.5"><Avatar person={lk.person(r.submittedById)} size="sm" />{lk.person(r.submittedById)?.name}</span>
                  <span>{r.decidedAt ? formatDateTime(r.decidedAt) : ""}</span>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
