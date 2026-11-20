"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FileCode2, FileSearch, FileText, Film, FlaskConical, Image as ImageIcon } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type Evidence, type EvidenceType } from "@/mocks/delivery-dashboards";
import {
  EVIDENCE_LABEL,
  EmptyStateView,
  PageFrame,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { cn } from "@/lib/utils";

const ICON: Record<EvidenceType, { icon: React.ElementType; cls: string }> = {
  PULL_REQUEST: { icon: FileCode2, cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
  TEST_REPORT: { icon: FlaskConical, cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  SCREENSHOT: { icon: ImageIcon, cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  DEMO_VIDEO: { icon: Film, cls: "bg-pink-500/12 text-pink-600 dark:text-pink-400" },
  DOCUMENT: { icon: FileText, cls: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
};
const STATUS = { TO_INSPECT: ["To inspect", "violet"], VERIFIED: ["Verified", "success"], FLAGGED: ["Flagged", "danger"] } as const;

type Filter = "ALL" | Evidence["status"];

export default function ReviewerEvidencePage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const reviews = useDeliveryStore((s) => s.reviews);
  const allEvidence = useDeliveryStore((s) => s.evidence);
  const [filter, setFilter] = useState<Filter>("TO_INSPECT");

  const items = useMemo(() => {
    if (forceEmpty) return [];
    const mine = new Set(reviews.filter((r) => r.reviewerId === VIEWERS.reviewer.id).map((r) => r.id));
    return allEvidence.filter((e) => mine.has(e.reviewId)).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [reviews, allEvidence, forceEmpty]);
  const rows = items.filter((e) => filter === "ALL" || e.status === filter);
  const count = (s: Evidence["status"]) => items.filter((e) => e.status === s).length;

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Inspect" }, { label: "Evidence" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Evidence"
      description="Proof attached to submissions. Git activity is evidence only — it never sets completion."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <SegmentTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "TO_INSPECT", label: "To inspect", count: count("TO_INSPECT") },
          { value: "FLAGGED", label: "Flagged", count: count("FLAGGED") },
          { value: "VERIFIED", label: "Verified", count: count("VERIFIED") },
          { value: "ALL", label: "All", count: items.length },
        ]}
      />
      {rows.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={FileSearch} title="Nothing here" description={items.length ? "No evidence in this state." : "Evidence appears once developers submit work."} /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-4">
          {rows.map((e) => {
            const I = ICON[e.type];
            const review = reviews.find((r) => r.id === e.reviewId);
            const [label, tone] = STATUS[e.status];
            return (
              <Link key={e.id} href={href(`evidence/${e.id}`)} className="group block rounded-xl">
                <SurfaceCard className="h-full p-4 space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-violet-500/40">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", I.cls)}><I.icon className="w-5 h-5" /></span>
                    <StatusBadge label={label} tone={tone} dot />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-400">{e.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{EVIDENCE_LABEL[e.type]} · {e.source}</p>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{e.detail}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {e.stats.slice(0, 3).map((s) => <span key={s.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px]"><b>{s.value}</b> {s.label}</span>)}
                  </div>
                  <p className="pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] truncate">
                    {review?.code} · {lk.task(review?.taskId)?.key} · added {formatDateTime(e.addedAt)}
                  </p>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
