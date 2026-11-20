"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Search, Users } from "lucide-react";
import {
  Avatar,
  EmptyStateView,
  FilterBar,
  PageFrame,
  ProgressBar,
  StatusBadge,
  SurfaceCard,
  TASK_STATUS_COLOR,
  daysFromToday,
  useDemoLoad,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

export default function TeamLeadMembersPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const t = useLeadTeam(forceEmpty);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return t.members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.title.toLowerCase().includes(q) || m.skills.some((s) => s.toLowerCase().includes(q)));
  }, [t.members, search]);

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "My team" }, { label: "Members" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title={`${t.team.name} members`}
      description={t.team.focus}
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search name, role or skill" />
      {rows.length === 0 ? (
        <SurfaceCard>
          <EmptyStateView icon={t.members.length ? Search : Users} title={t.members.length ? "No one matches" : "No team members"} description={t.members.length ? "Try another name or skill." : "Members appear once they join your team."} />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4 gap-4">
          {rows.map((m) => {
            const u = utilisationTone(m.pct);
            const mine = t.tasks.filter((x) => x.assigneeId === m.id);
            const open = mine.filter((x) => x.status !== "DONE");
            const overdue = open.filter((x) => daysFromToday(x.dueDate) < 0).length;
            const checkIn = t.checkIns.find((c) => c.memberId === m.id);
            return (
              <Link key={m.id} href={href(`team/${m.id}`)} className="group block rounded-xl">
                <SurfaceCard className="relative h-full overflow-hidden p-4 space-y-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-violet-500/40">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: m.color }} />
                  <div className="flex items-center gap-3">
                    <Avatar person={m} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">{m.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{m.title} · {m.location}</p>
                    </div>
                    {m.id === t.team.leadId && <StatusBadge label="Lead" tone="violet" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-[var(--color-text-secondary)]">Load {m.assignedHours}h / {m.capacityHours}h</span><span className="font-bold" style={{ color: u.color }}>{m.pct}%</span></div>
                    <ProgressBar value={Math.min(100, m.pct)} color={u.color} size="sm" />
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]" title="Tasks by status">
                    {(["DONE", "IN_REVIEW", "IN_PROGRESS", "BLOCKED", "TODO"] as const).map((s) => {
                      const n = mine.filter((x) => x.status === s).length;
                      return n ? <span key={s} style={{ width: `${(n / mine.length) * 100}%`, backgroundColor: TASK_STATUS_COLOR[s] }} /> : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge label={`${open.length} open`} tone="info" />
                    {overdue > 0 && <StatusBadge label={`${overdue} overdue`} tone="danger" />}
                    {mine.some((x) => x.status === "BLOCKED") && <StatusBadge label="Blocked" tone="danger" dot />}
                  </div>
                  {checkIn && (
                    <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5">
                      <MessageSquareText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-teal-500" />
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">{checkIn.lastSummary}</p>
                    </div>
                  )}
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
