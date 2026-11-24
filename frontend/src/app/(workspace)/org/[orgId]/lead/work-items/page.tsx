"use client";

import { previewEnabled } from "@/lib/permissions";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks, UserPlus } from "lucide-react";
import type { TaskStatus } from "@/mocks/delivery-dashboards";
import {
  AdminSelect,
  Avatar,
  ButtonLink,
  EmptyStateView,
  FilterBar,
  PageFrame,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  SurfaceCard,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  dueLabel,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"];

function PreviewTeamLeadBoardPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);
  const [search, setSearch] = useState("");
  const [member, setMember] = useState("ALL");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return t.tasks
      .filter((x) => member === "ALL" || (member === "NONE" ? !x.assigneeId : x.assigneeId === member))
      .filter((x) => !q || x.title.toLowerCase().includes(q) || x.key.toLowerCase().includes(q))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [t.tasks, search, member]);

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Team work" }, { label: "Tasks by status" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Tasks by status"
      description="Your team's work grouped by state. Open a card to update or reassign it."
      status={status}
      onRetry={retry}
      skeleton="list"
      actions={<ButtonLink href={href("assignments")}><UserPlus className="w-3.5 h-3.5" /> Assign work</ButtonLink>}
    >
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search task or key"
        filters={
          <div className="w-full sm:w-52">
            <AdminSelect aria-label="Member" value={member} onChange={(e) => setMember(e.target.value)} options={[{ label: "Everyone", value: "ALL" }, { label: "Unassigned", value: "NONE" }, ...t.members.map((m) => ({ label: m.name, value: m.id }))]} />
          </div>
        }
        hasActiveFilters={Boolean(search) || member !== "ALL"}
        onResetFilters={() => { setSearch(""); setMember("ALL"); }}
      />

      {rows.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={ListChecks} title={t.tasks.length ? "No tasks match" : "No team work yet"} description={t.tasks.length ? "Try a different filter." : "Assign work to get the board going."} /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
          {COLUMNS.map((col) => {
            const items = rows.filter((x) => x.status === col);
            return (
              <section key={col} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-2 min-w-0">
                <header className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[col] }} />
                    {TASK_STATUS_LABEL[col]}
                  </span>
                  <span className="rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 text-[10px] font-semibold">{items.length}</span>
                </header>
                {items.length === 0 && <p className="py-4 text-center text-[11px] text-[var(--color-text-muted)]">Empty</p>}
                {items.map((x) => {
                  const d = dueLabel(x.dueDate, x.status === "DONE");
                  return (
                    <Link key={x.id} href={href(`work-items/${x.id}`)} className="block rounded-lg">
                      <SurfaceCard className="p-3 space-y-2 border-l-[3px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeftColor: TASK_STATUS_COLOR[col] }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-snug">{x.title}</p>
                          <Avatar person={lk.person(x.assigneeId)} size="sm" />
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{x.key} · {lk.project(x.projectId)?.name}</p>
                        {x.status !== "DONE" && <ProgressBar value={x.progress} size="sm" color={TASK_STATUS_COLOR[col]} />}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PriorityBadge priority={x.priority} />
                          <StatusBadge label={d.label} tone={d.tone} />
                        </div>
                      </SurfaceCard>
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function TeamLeadBoardPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  if (previewEnabled()) return <PreviewTeamLeadBoardPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <WorkItemsView crumbs={[{ label: "Team Lead", href: home }]} back={{ href: home, label: "Back to dashboard" }} title="Team work"
        itemHref={(entry) => `${home}/work-items/${entry.item.id}`} />
    </RequireAnyKey>
  );
}
