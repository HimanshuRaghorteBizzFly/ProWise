"use client";

import { previewEnabled } from "@/lib/permissions";
import { BlockersView, BlockerDetailView, DependenciesPageView } from "@/components/work/DependencyViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useState } from "react";
import Link from "next/link";
import { OctagonAlert, ShieldCheck } from "lucide-react";
import {
  Avatar,
  EmptyStateView,
  KpiGrid,
  KpiTile,
  PageFrame,
  SegmentTabs,
  SeverityBadge,
  StatusBadge,
  SurfaceCard,
  daysFromToday,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

function PreviewTeamLeadBlockersPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);
  const [tab, setTab] = useState<"OPEN" | "RESOLVED">("OPEN");
  const open = t.blockers.filter((b) => b.status === "OPEN");
  const rows = t.blockers.filter((b) => b.status === tab).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
  const oldest = open.length ? Math.max(...open.map((b) => -daysFromToday(b.raisedAt))) : 0;

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Team work" }, { label: "Blockers" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Team blockers"
      description="Impediments raised on your team's tasks. Open one to resolve it with a note."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <KpiGrid>
        <KpiTile label="Open" value={open.length} icon={OctagonAlert} tone="rose" footer="Needs action" href={href("blockers")} />
        <KpiTile label="Critical" value={open.filter((b) => b.severity === "CRITICAL").length} icon={OctagonAlert} tone="pink" footer="Escalate" href={href("blockers")} />
        <KpiTile label="Oldest" value={`${oldest}d`} icon={OctagonAlert} tone="amber" footer="Days open" href={href("blockers")} />
        <KpiTile label="Resolved" value={t.blockers.length - open.length} icon={ShieldCheck} tone="emerald" footer="This sprint" href={href("blockers")} />
      </KpiGrid>
      <SegmentTabs<"OPEN" | "RESOLVED"> value={tab} onChange={setTab} options={[{ value: "OPEN", label: "Open", count: open.length }, { value: "RESOLVED", label: "Resolved", count: t.blockers.length - open.length }]} />
      {rows.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={ShieldCheck} title={tab === "OPEN" ? "No open blockers" : "Nothing resolved yet"} description="The team is moving freely." /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {rows.map((b) => (
            <Link key={b.id} href={href(`blockers/${b.id}`)} className="block rounded-xl">
              <SurfaceCard className="h-full p-4 space-y-2.5 border-l-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ borderLeftColor: b.status === "RESOLVED" ? "#10B981" : b.severity === "CRITICAL" ? "#E11D48" : b.severity === "HIGH" ? "#F97316" : "#F59E0B" }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{b.title}</p>
                  {b.status === "OPEN" ? <SeverityBadge severity={b.severity} /> : <StatusBadge label="Resolved" tone="success" />}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">{b.resolution ?? b.note}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1.5"><Avatar person={lk.person(b.raisedById)} size="sm" />Raised by {lk.person(b.raisedById)?.name}</span>
                  <span>{lk.task(b.taskId)?.key} · {formatDate(b.raisedAt)} · {Math.abs(daysFromToday(b.raisedAt))}d</span>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

/** Task 3.4: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function TeamLeadBlockersPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  if (previewEnabled()) return <PreviewTeamLeadBlockersPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <BlockersView crumbs={[{ label: "Team Lead", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        detailHref={(entry) => `${home}/blockers/${entry.blocker.id}`} />
    </RequireAnyKey>
  );
}
