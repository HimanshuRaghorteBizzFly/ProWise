"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Search,
  Users,
  MessageSquareText,
  ListChecks,
  Layers,
  UserCheck,
  CalendarDays,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { useProjectStore } from "@/store/project-store";
import { VIEWERS, type DeliveryMode, type Health } from "@/mocks/delivery-dashboards";
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

type ModeFilter = "ALL" | DeliveryMode;

export default function TeamLeadProjectsPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();

  const deliveryProjects = useDeliveryStore((s) => s.projects);
  const deliveryTasks = useDeliveryStore((s) => s.tasks);
  const deliveryCheckIns = useDeliveryStore((s) => s.checkIns);

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("ALL");

  // Filter projects belonging to this Team Lead's squad (t-platform) or team members
  const teamProjects = useMemo(() => {
    if (forceEmpty) return [];
    return deliveryProjects.filter(
      (p) =>
        p.teamId === VIEWERS.lead.teamId ||
        p.memberIds.some((m) => m === VIEWERS.lead.id || m.startsWith("p-"))
    );
  }, [deliveryProjects, forceEmpty]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamProjects.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q);
      const matchesMode = modeFilter === "ALL" || p.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [teamProjects, search, modeFilter]);

  const individualCount = teamProjects.filter((p) => p.mode === "INDIVIDUAL").length;
  const structuredCount = teamProjects.filter((p) => p.mode === "STRUCTURED").length;
  const onTrackCount = teamProjects.filter((p) => p.health === "ON_TRACK").length;

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Team Projects" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Team Projects Portfolio"
      description="Track assigned team projects across Individual check-in and Structured milestone baseline modes."
      badge="Platform Squad"
      status={status}
      onRetry={retry}
      skeleton="list"
      actions={
        <div className="flex items-center gap-2">
          <ButtonLink href={href("check-ins")} variant="outline">
            <MessageSquareText className="w-3.5 h-3.5" /> Check-ins
          </ButtonLink>
          <ButtonLink href={href("work-items")}>
            <ListChecks className="w-3.5 h-3.5" /> Tasks by Status
          </ButtonLink>
        </div>
      }
    >
      {/* Metric summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SurfaceCard className="p-3">
          <span className="text-[11px] text-[var(--color-text-secondary)]">Total Squad Projects</span>
          <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{teamProjects.length}</div>
        </SurfaceCard>
        <SurfaceCard className="p-3 border-l-2 border-l-emerald-500">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Individual (Solo)</span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{individualCount}</div>
        </SurfaceCard>
        <SurfaceCard className="p-3 border-l-2 border-l-violet-500">
          <span className="text-[11px] text-violet-700 dark:text-violet-300 font-medium">Structured (Team)</span>
          <div className="text-xl font-bold text-violet-600 dark:text-violet-400 mt-0.5">{structuredCount}</div>
        </SurfaceCard>
        <SurfaceCard className="p-3 border-l-2 border-l-blue-500">
          <span className="text-[11px] text-[var(--color-text-secondary)]">Health: On Track</span>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{onTrackCount}</div>
        </SurfaceCard>
      </div>

      {/* Filter and search bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search project name, code or client..."
        filters={
          <SegmentTabs<ModeFilter>
            value={modeFilter}
            onChange={setModeFilter}
            options={[
              { value: "ALL", label: "All Projects", count: teamProjects.length },
              { value: "INDIVIDUAL", label: "Individual (Solo)", count: individualCount },
              { value: "STRUCTURED", label: "Structured (Team)", count: structuredCount },
            ]}
          />
        }
        hasActiveFilters={Boolean(search) || modeFilter !== "ALL"}
        onResetFilters={() => {
          setSearch("");
          setModeFilter("ALL");
        }}
      />

      {filteredProjects.length === 0 ? (
        <SurfaceCard>
          <EmptyStateView
            icon={FolderKanban}
            title={teamProjects.length ? "No projects match your filter" : "No squad projects yet"}
            description="Projects created by management for Platform Squad will appear here."
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const projectTasks = deliveryTasks.filter((t) => t.projectId === p.id);
            const d = dueLabel(p.dueDate);
            const isSolo = p.mode === "INDIVIDUAL";

            return (
              <SurfaceCard
                key={p.id}
                className={`p-4 flex flex-col justify-between transition-all duration-200 border-l-4 hover:-translate-y-0.5 hover:shadow-md ${
                  isSolo
                    ? "border-l-emerald-500 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-app-surface to-teal-500/5 hover:border-emerald-500/60"
                    : "border-l-violet-500 border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-app-surface to-indigo-500/5 hover:border-violet-500/60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                            isSolo
                              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                              : "text-violet-700 dark:text-violet-300 bg-violet-500/15 border-violet-500/30"
                          }`}
                        >
                          [{p.code}]
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-xs ${
                            isSolo
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                              : "bg-violet-500/20 text-violet-800 dark:text-violet-200 border-violet-500/30"
                          }`}
                        >
                          {isSolo ? "Individual (Solo)" : "Structured (Team)"}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[var(--color-text-primary)] mt-1.5 truncate">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                        Client: {p.client}
                      </p>
                    </div>
                    <HealthBadge health={p.health} />
                  </div>

                  {/* Mode-specific detail notice */}
                  <div
                    className={`my-2.5 p-2 rounded-lg border text-[11px] ${
                      isSolo
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                        : "bg-violet-500/10 border-violet-500/20 text-violet-800 dark:text-violet-200"
                    }`}
                  >
                    {isSolo ? (
                      <div className="flex items-center gap-1.5 font-medium">
                        <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Solo developer progress verified via periodic check-in submissions.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 font-medium">
                        <Layers className="w-3.5 h-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                        <span>Work breakdown with {projectTasks.length} tracked task items.</span>
                      </div>
                    )}
                  </div>

                  {/* Progress section */}
                  <div className="my-3 space-y-1">
                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                      <span>Progress</span>
                      <span
                        className={`font-bold tabular-nums ${
                          isSolo
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-violet-700 dark:text-violet-300"
                        }`}
                      >
                        {p.progress}%
                      </span>
                    </div>
                    <ProgressBar
                      value={p.progress}
                      planned={p.plannedProgress}
                      color={isSolo ? "#10B981" : "#8B5CF6"}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <AvatarStack people={p.memberIds.map((id) => lk.person(id)).filter(Boolean) as any} max={3} />
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {p.memberIds.length} {p.memberIds.length === 1 ? "member" : "members"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge label={d.label} tone={d.tone} />
                    {isSolo ? (
                      <Link
                        href={href("check-ins")}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <span>Check-ins</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link
                        href={href("work-items")}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:underline flex items-center gap-0.5"
                      >
                        <span>Tasks</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
