"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Hourglass } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  EmptyStateView,
  PageFrame,
  Panel,
  PriorityBadge,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
  formatWaiting,
  hoursSince,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { HorizontalBarChart } from "@/components/delivery/DeliveryCharts";

const color = (h: number) => (h >= 96 ? "#EF4444" : h >= 48 ? "#F59E0B" : "#10B981");

export default function ReviewerWaitingPage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allReviews = useDeliveryStore((s) => s.reviews);
  const rows = useMemo(
    () =>
      forceEmpty
        ? []
        : allReviews
            .filter((r) => r.reviewerId === VIEWERS.reviewer.id && r.status === "PENDING")
            .map((r) => ({ ...r, waited: hoursSince(r.submittedAt) }))
            .sort((a, b) => b.waited - a.waited),
    [allReviews, forceEmpty]
  );

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Waiting longest" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Waiting longest"
      description="Oldest submissions first. Green < 48h, amber 48–96h, red > 96h."
      status={status}
      onRetry={retry}
    >
      {rows.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={Hourglass} title="Nothing waiting" description="Every submission has a decision." /></SurfaceCard>
      ) : (
        <>
          <Panel title="Hours waiting" icon={Hourglass} iconTone="amber">
            <HorizontalBarChart unit="h" valueLabel="Waiting" data={rows.map((r) => ({ name: r.code, value: r.waited, color: color(r.waited) }))} />
          </Panel>
          <ol className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {rows.map((r, i) => (
              <li key={r.id}>
                <Link href={href(`reviews/${r.id}`)} className="block rounded-xl">
                  <SurfaceCard className="h-full p-4 space-y-3 border-t-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ borderTopColor: color(r.waited) }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-7 w-7 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{lk.task(r.taskId)?.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.code} · {lk.project(r.projectId)?.name}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold tabular-nums shrink-0" style={{ color: color(r.waited) }}>{formatWaiting(r.waited)}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{r.summary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                      <span className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]"><Avatar person={lk.person(r.submittedById)} size="sm" />{formatDateTime(r.submittedAt)}</span>
                      <span className="flex gap-1.5"><PriorityBadge priority={r.priority} />{r.round > 1 && <StatusBadge label={`Round ${r.round}`} tone="violet" />}</span>
                    </div>
                  </SurfaceCard>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </PageFrame>
  );
}
