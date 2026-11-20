"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, FolderKanban, FolderPlus, OctagonAlert, Search, Users } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type Health } from "@/mocks/delivery-dashboards";
import {
  AvatarStack,
  ButtonLink,
  EmptyStateView,
  FilterBar,
  HealthBadge,
  PageFrame,
  ProgressBar,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  dueLabel,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

type HealthFilter = "ALL" | Health;

export default function ManagerPortfolioPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const tasks = useDeliveryStore((s) => s.tasks);
  const blockers = useDeliveryStore((s) => s.blockers);
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<HealthFilter>("ALL");

  const mine = useMemo(
    () => (forceEmpty ? [] : allProjects.filter((p) => p.managerId === VIEWERS.manager.id)),
    [allProjects, forceEmpty]
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter(
      (p) =>
        (health === "ALL" || p.health === health) &&
        (!q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    );
  }, [mine, search, health]);

  const count = (h: Health) => mine.filter((p) => p.health === h).length;

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Portfolio" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Project portfolio"
      description="Every project you manage, with health, approved progress and next deadline."
      status={status}
      onRetry={retry}
      skeleton="list"
      actions={
        <ButtonLink href={href("create-project")}>
          <FolderPlus className="w-3.5 h-3.5" /> Create project
        </ButtonLink>
      }
    >
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search project, client or code"
        filters={
          <SegmentTabs<HealthFilter>
            value={health}
            onChange={setHealth}
            options={[
              { value: "ALL", label: "All", count: mine.length },
              { value: "ON_TRACK", label: "On track", count: count("ON_TRACK") },
              { value: "AT_RISK", label: "At risk", count: count("AT_RISK") },
              { value: "OFF_TRACK", label: "Off track", count: count("OFF_TRACK") },
            ]}
          />
        }
        hasActiveFilters={Boolean(search) || health !== "ALL"}
        onResetFilters={() => {
          setSearch("");
          setHealth("ALL");
        }}
      />

      {rows.length === 0 ? (
        <SurfaceCard>
          <EmptyStateView
            icon={mine.length ? Search : FolderKanban}
            title={mine.length ? "No projects match" : "No projects yet"}
            description={mine.length ? "Try a different search or health filter." : "Create your first project to start tracking delivery."}
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-4">
          {rows.map((p) => {
            const projectTasks = tasks.filter((t) => t.projectId === p.id);
            const open = projectTasks.filter((t) => t.status !== "DONE").length;
            const blocked = blockers.filter((b) => b.projectId === p.id && b.status === "OPEN").length;
            const next = p.milestones.find((ms) => ms.status !== "DONE");
            const due = dueLabel(next?.dueDate ?? p.dueDate);
            const team = p.memberIds.map((id) => lk.person(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
            return (
              <Link key={p.id} href={href(`projects/${p.id}`)} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <SurfaceCard className="relative h-full overflow-hidden p-4 space-y-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: p.color }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-10 w-10 rounded-xl text-xs font-bold text-white flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: p.color }}>
                        {p.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{p.client}</p>
                      </div>
                    </div>
                    <HealthBadge health={p.health} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-secondary)]">Progress (plan {p.plannedProgress}%)</span>
                      <span className="font-bold tabular-nums">{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--color-app-bg)] border border-[var(--color-border)] py-1.5">
                      <p className="text-sm font-bold tabular-nums">{open}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Open tasks</p>
                    </div>
                    <div className="rounded-lg bg-[var(--color-app-bg)] border border-[var(--color-border)] py-1.5">
                      <p className={`text-sm font-bold tabular-nums ${blocked ? "text-rose-600 dark:text-rose-400" : ""}`}>{blocked}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Blockers</p>
                    </div>
                    <div className="rounded-lg bg-[var(--color-app-bg)] border border-[var(--color-border)] py-1.5">
                      <p className="text-sm font-bold tabular-nums">{p.budgetUsed}%</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Budget</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-[var(--color-text-secondary)]">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{next ? next.name : "Final delivery"}</span>
                    </div>
                    <StatusBadge label={due.label} tone={due.tone} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <AvatarStack people={team} />
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                      {blocked > 0 ? <OctagonAlert className="w-3 h-3 text-rose-500" /> : <Users className="w-3 h-3" />}
                      {p.mode === "INDIVIDUAL" ? "Individual" : "Structured"}
                    </span>
                  </div>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
