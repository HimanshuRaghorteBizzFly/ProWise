"use client";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { MyTasksView } from "@/components/work/ReviewViews";

import React, { useEffect, useState } from "react";
=======
import React, { useMemo, useState } from "react";
import Link from "next/link";
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
import { useParams } from "next/navigation";
import { CheckSquare, Search } from "lucide-react";

<<<<<<< HEAD
function PreviewDeveloperTasksPage() {
=======
import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminInput, EmptyStateView, PageFrame, SegmentTabs, StatusBadge, SurfaceCard } from "@/components/delivery/DeliveryUI";
import { DevGate, WorkStateBadge, dateText, isOverdue } from "@/components/developer/DevUI";
import { useMyWorkItems } from "@/components/developer/useDeveloperData";
import type { WorkItemDto } from "@/types/work";

type Filter = "OPEN" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED" | "ALL";

const MATCH: Record<Filter, (w: WorkItemDto) => boolean> = {
  OPEN: (w) => w.state !== "DONE" && w.state !== "CANCELLED",
  TODO: (w) => w.state === "TODO",
  IN_PROGRESS: (w) => w.state === "IN_PROGRESS",
  IN_REVIEW: (w) => w.state === "IN_REVIEW",
  DONE: (w) => w.state === "DONE",
  BLOCKED: (w) => w.blocked,
  ALL: () => true,
};

/**
 * My Tasks: Structured work where the caller is the primary assignee or a collaborator. Individual projects have no
 * compulsory tasks; their progress is the check-in on Progress & Tracker.
 */
export default function DeveloperTasksPage() {
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const work = useMyWorkItems();
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [search, setSearch] = useState("");

  return (
    <PanelLayout title="My Tasks">
      <PageFrame
        crumbs={[{ label: "Developer", href: `${base}/dashboard` }, { label: "My Tasks" }]}
        title="My Tasks"
        description="Structured work assigned to you. Open a task to start it, submit evidence for review, see dependencies and raise blockers."
      >
        <DevGate state={work} what="Your tasks" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
          {(items) => <TaskList items={items} base={base} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} />}
        </DevGate>
      </PageFrame>
    </PanelLayout>
  );
}

<<<<<<< HEAD
/** Task 3.3: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function DeveloperTasksPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/developer`;
  return previewEnabled() ? <PreviewDeveloperTasksPage /> : (
    <MyTasksView crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
=======
function TaskList({ items, base, filter, setFilter, search, setSearch }: {
  items: WorkItemDto[];
  base: string;
  filter: Filter;
  setFilter: (f: Filter) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const count = (f: Filter) => items.filter(MATCH[f]).length;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(MATCH[filter])
      .filter((w) => !q || w.title.toLowerCase().includes(q) || w.key.toLowerCase().includes(q));
  }, [items, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <SegmentTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "OPEN", label: "Open", count: count("OPEN") },
            { value: "TODO", label: "To do", count: count("TODO") },
            { value: "IN_PROGRESS", label: "In progress", count: count("IN_PROGRESS") },
            { value: "IN_REVIEW", label: "In review", count: count("IN_REVIEW") },
            { value: "BLOCKED", label: "Blocked", count: count("BLOCKED") },
            { value: "DONE", label: "Done", count: count("DONE") },
            { value: "ALL", label: "All", count: items.length },
          ]}
        />
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
          <AdminInput aria-label="Search tasks" placeholder="Search key or title" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyStateView
          icon={CheckSquare}
          title={items.length === 0 ? "No tasks assigned" : "No tasks match"}
          description={items.length === 0
            ? "When a planner assigns Structured work to you it appears here."
            : "Change the filter or search to see other tasks."}
        />
      ) : (
        <SurfaceCard className="p-0 overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]" aria-label="Tasks">
            {visible.map((w) => (
              <li key={w.id}>
                <Link href={`${base}/tasks/${w.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-[var(--color-hover)]">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{w.key}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{w.type}</span>
                      {w.dependency_flag && <StatusBadge label="Prerequisite reopened" tone="warning" />}
                    </span>
                    <span className="block text-sm font-medium truncate">{w.title}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-[11px]">
                    {w.due_on && (
                      <span className={isOverdue(w.due_on, w.state) ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-[var(--color-text-muted)]"}>
                        {isOverdue(w.due_on, w.state) ? "Overdue · " : "Due "}{dateText(w.due_on)}
                      </span>
                    )}
                    <WorkStateBadge state={w.state} blocked={w.blocked} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}
    </div>
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
  );
}
