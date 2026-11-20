"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Scale, UserPlus, Users } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  ButtonLink,
  EmptyStateView,
  PageFrame,
  Panel,
  ProgressBar,
  StatusBadge,
  SurfaceCard,
  useDemoLoad,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, HorizontalBarChart } from "@/components/delivery/DeliveryCharts";

export default function ManagerWorkloadPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const allProjects = useDeliveryStore((s) => s.projects);
  const people = useDeliveryStore((s) => s.people);
  const tasks = useDeliveryStore((s) => s.tasks);

  const team = useMemo(() => {
    if (forceEmpty) return [];
    const ids = new Set(allProjects.filter((p) => p.managerId === VIEWERS.manager.id).flatMap((p) => p.memberIds));
    return people
      .filter((p) => ids.has(p.id))
      .map((p) => ({
        ...p,
        pct: Math.round((p.assignedHours / p.capacityHours) * 100),
        open: tasks.filter((t) => t.assigneeId === p.id && t.status !== "DONE").length,
        projects: allProjects.filter((pr) => pr.memberIds.includes(p.id)).length,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [allProjects, people, tasks, forceEmpty]);

  const bands = [
    { name: "Over capacity", value: team.filter((p) => p.pct > 100).length, color: "#EF4444" },
    { name: "Near capacity", value: team.filter((p) => p.pct >= 85 && p.pct <= 100).length, color: "#F59E0B" },
    { name: "Healthy", value: team.filter((p) => p.pct >= 60 && p.pct < 85).length, color: "#10B981" },
    { name: "Has room", value: team.filter((p) => p.pct < 60).length, color: "#3B82F6" },
  ];

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "People" }, { label: "Team workload" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Team workload"
      description="Assigned hours against weekly capacity for everyone on your projects."
      status={status}
      onRetry={retry}
      actions={<ButtonLink href={href("team-assignments")}><UserPlus className="w-3.5 h-3.5" /> Assign work</ButtonLink>}
    >
      {team.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={Users} title="No team members" description="People appear here once they join one of your projects." /></SurfaceCard>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Utilisation" description="100% = full weekly capacity" icon={Users} iconTone="violet">
              <HorizontalBarChart data={team.map((p) => ({ name: p.name.split(" ")[0], value: p.pct, color: utilisationTone(p.pct).color }))} valueLabel="Utilisation" />
            </Panel>
            <Panel title="Capacity bands" icon={Scale} iconTone="amber">
              <DonutChart data={bands} centerLabel="people" />
            </Panel>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {team.map((p) => {
              const u = utilisationTone(p.pct);
              return (
                <Link key={p.id} href={href(`workload/${p.id}`)} className="group block rounded-xl">
                  <SurfaceCard className="h-full p-4 space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40">
                    <div className="flex items-center gap-3">
                      <Avatar person={p} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{p.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{p.title} · {p.location}</p>
                      </div>
                      <StatusBadge label={u.label} tone={u.tone} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]"><span className="text-[var(--color-text-secondary)]">{p.assignedHours}h of {p.capacityHours}h</span><span className="font-bold tabular-nums" style={{ color: u.color }}>{p.pct}%</span></div>
                      <ProgressBar value={Math.min(100, p.pct)} color={u.color} />
                    </div>
                    <div className="flex gap-3 text-[11px] text-[var(--color-text-muted)]">
                      <span><b className="text-[var(--color-text-primary)]">{p.open}</b> open tasks</span>
                      <span><b className="text-[var(--color-text-primary)]">{p.projects}</b> projects</span>
                    </div>
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </PageFrame>
  );
}
