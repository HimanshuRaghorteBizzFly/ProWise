"use client";

import React, { useMemo } from "react";
import {
  CheckCircle2,
  Clock3,
  FileSearch,
  GitPullRequestArrow,
  Hourglass,
  PlayCircle,
  RotateCcw,
  Timer,
  TrendingDown,
} from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { DEMO_TODAY, REVIEWER_TURNAROUND_HOURS, REVIEWER_WEEKLY_OUTCOMES, VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  ButtonLink,
  EVIDENCE_LABEL,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  PriorityBadge,
  ReviewStatusBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
  formatWaiting,
  hoursSince,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GaugeRing, GroupedBarChart, TrendAreaChart } from "@/components/delivery/DeliveryCharts";

export default function ReviewerDashboardPage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allReviews = useDeliveryStore((s) => s.reviews);
  const allEvidence = useDeliveryStore((s) => s.evidence);

  const m = useMemo(() => {
    const reviews = forceEmpty ? [] : allReviews.filter((r) => r.reviewerId === VIEWERS.reviewer.id);
    const pending = reviews.filter((r) => r.status === "PENDING").map((r) => ({ ...r, waited: hoursSince(r.submittedAt) })).sort((a, b) => b.waited - a.waited);
    const approved = reviews.filter((r) => r.status === "APPROVED");
    const changes = reviews.filter((r) => r.status === "CHANGES_REQUESTED");
    const decided = [...approved, ...changes].sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
    const ids = new Set(reviews.map((r) => r.id));
    const toInspect = (forceEmpty ? [] : allEvidence).filter((e) => ids.has(e.reviewId) && e.status === "TO_INSPECT");
    const byProject = new Map<string, number>();
    pending.forEach((r) => byProject.set(r.projectId, (byProject.get(r.projectId) ?? 0) + 1));
    return {
      pending,
      approved,
      changes,
      decided,
      toInspect,
      stale: pending.filter((r) => r.waited >= 48),
      rate: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
      byProject: Array.from(byProject.entries()).map(([id, value]) => ({ name: lk.project(id)?.name ?? id, value, color: lk.project(id)?.color ?? "#94A3B8" })),
    };
  }, [allReviews, allEvidence, forceEmpty, lk]);

  const turnaround = REVIEWER_TURNAROUND_HOURS[REVIEWER_TURNAROUND_HOURS.length - 1].value;
  const prevTurnaround = REVIEWER_TURNAROUND_HOURS[REVIEWER_TURNAROUND_HOURS.length - 2].value;
  const maxWait = Math.max(1, ...m.pending.map((r) => r.waited));
  const next = m.pending[0];

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Dashboard" }]}
      title="Review desk"
      description={`${VIEWERS.reviewer.name} · ${formatDate(DEMO_TODAY, true)} — ${m.pending.length} submissions waiting, ${m.stale.length} over 48 hours.`}
      badge="QA Reviewer"
      status={status}
      onRetry={retry}
      actions={
        next ? (
          <ButtonLink href={href(`reviews/${next.id}`)}>
            <PlayCircle className="w-3.5 h-3.5" /> Start oldest review
          </ButtonLink>
        ) : undefined
      }
    >
      <KpiGrid>
        <KpiTile label="In my queue" value={m.pending.length} icon={GitPullRequestArrow} tone="blue" chip={{ label: `${m.pending.filter((r) => r.priority === "CRITICAL").length} critical`, tone: "danger" }} meta={<span>{m.pending.filter((r) => r.round > 1).length} re-submissions</span>} footer="Review queue" href={href("queue")} />
        <KpiTile label="Waiting > 48h" value={m.stale.length} icon={Hourglass} tone="amber" chip={{ label: next ? formatWaiting(next.waited) : "—", tone: "warning" }} meta={<span>Longest wait in queue</span>} footer="Waiting longest" href={href("waiting")} />
        <KpiTile label="Approved" value={m.approved.length} icon={CheckCircle2} tone="emerald" chip={{ label: `${m.rate}% rate`, tone: "success" }} meta={<span>First-pass and re-reviews</span>} footer="Outcomes" href={href("approvals")} />
        <KpiTile label="Changes requested" value={m.changes.length} icon={RotateCcw} tone="rose" chip={{ label: "with reasons", tone: "neutral" }} meta={<span>Returned to developers</span>} footer="Outcomes" href={href("approvals")} />
        <KpiTile label="Evidence to inspect" value={m.toInspect.length} icon={FileSearch} tone="violet" chip={{ label: "Unverified", tone: "violet" }} meta={<span>PRs, test runs, screenshots</span>} footer="Inspect evidence" href={href("evidence")} />
        <KpiTile label="Avg turnaround" value={`${turnaround}h`} icon={Timer} tone="teal" chip={{ label: `${turnaround - prevTurnaround}h vs last wk`, tone: turnaround <= prevTurnaround ? "success" : "warning" }} meta={<span>Submit → decision, this week</span>} footer="Review history" href={href("history")} />
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Panel className="xl:col-span-2" title="Waiting longest" description="Oldest submissions first — open one to decide" icon={Hourglass} iconTone="amber" action={{ label: "All waiting", href: href("waiting") }}>
          <div className="space-y-1">
            {m.pending.length === 0 && <p className="py-8 text-center text-xs text-[var(--color-text-muted)]">Queue is empty. Great work.</p>}
            {m.pending.slice(0, 6).map((r) => {
              const task = lk.task(r.taskId);
              const pct = Math.round((r.waited / maxWait) * 100);
              const color = r.waited >= 96 ? "#EF4444" : r.waited >= 48 ? "#F59E0B" : "#10B981";
              return (
                <LinkRow key={r.id} href={href(`reviews/${r.id}`)}>
                  <Avatar person={lk.person(r.submittedById)} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate">{r.code} · {task?.title}</p>
                      <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color }}>{formatWaiting(r.waited)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex"><PriorityBadge priority={r.priority} /></span>
                </LinkRow>
              );
            })}
          </div>
        </Panel>
        <Panel title="Approval rate" description="Approved share of decided reviews" icon={CheckCircle2} iconTone="emerald">
          <GaugeRing value={m.rate} color="#10B981" label="approved" size={140} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 py-2"><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{m.approved.length}</p><p className="text-[10px] text-[var(--color-text-muted)]">Approved</p></div>
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 py-2"><p className="text-lg font-bold text-rose-600 dark:text-rose-400">{m.changes.length}</p><p className="text-[10px] text-[var(--color-text-muted)]">Changes</p></div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
        <Panel title="Weekly outcomes" description="Approved vs changes requested" icon={GitPullRequestArrow} iconTone="emerald">
          <GroupedBarChart data={REVIEWER_WEEKLY_OUTCOMES} primaryLabel="Approved" secondaryLabel="Changes requested" primaryColor="#10B981" secondaryColor="#F43F5E" height={220} />
        </Panel>
        <Panel title="Turnaround" description="Average hours from submit to decision" icon={TrendingDown} iconTone="teal">
          <TrendAreaChart data={REVIEWER_TURNAROUND_HOURS} xKey="label" unit="h" series={[{ key: "value", label: "Hours", color: "#14B8A6" }]} height={220} />
        </Panel>
        <Panel title="Queue by project" icon={Clock3} iconTone="blue" className="lg:col-span-2 2xl:col-span-1">
          {m.byProject.length ? <DonutChart data={m.byProject} centerLabel="waiting" /> : <p className="py-10 text-center text-xs text-[var(--color-text-muted)]">Nothing waiting.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <Panel title="Evidence to inspect" description="Attached proof not yet verified" icon={FileSearch} iconTone="violet" action={{ label: "All evidence", href: href("evidence") }}>
          <div className="space-y-0.5">
            {m.toInspect.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">All evidence inspected.</p>}
            {m.toInspect.slice(0, 6).map((e) => (
              <LinkRow key={e.id} href={href(`evidence/${e.id}`)}>
                <span className="rounded-md bg-violet-500/12 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">{EVIDENCE_LABEL[e.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{e.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{e.source}</p>
                </div>
              </LinkRow>
            ))}
          </div>
        </Panel>
        <Panel title="Recent decisions" icon={RotateCcw} iconTone="rose" action={{ label: "History", href: href("history") }}>
          <div className="space-y-0.5">
            {m.decided.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No decisions yet.</p>}
            {m.decided.slice(0, 5).map((r) => (
              <LinkRow key={r.id} href={href(`reviews/${r.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{r.code} · {lk.task(r.taskId)?.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.decidedAt ? formatDateTime(r.decidedAt) : ""} · {r.reason}</p>
                </div>
                <ReviewStatusBadge status={r.status} />
              </LinkRow>
            ))}
          </div>
        </Panel>
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)]">
        <StatusBadge label="Read-only" tone="neutral" className="mr-1.5" />
        QA reviewers approve or request changes. Creating projects and assigning work stay with managers and team leads.
      </p>
    </PageFrame>
  );
}
