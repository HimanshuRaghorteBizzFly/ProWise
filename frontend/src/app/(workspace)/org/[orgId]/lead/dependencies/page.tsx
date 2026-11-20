"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import {
  EmptyStateView,
  PageFrame,
  Panel,
  StatusBadge,
  SurfaceCard,
  TaskStatusBadge,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";
import type { Dependency } from "@/mocks/delivery-dashboards";

const KIND: Record<Dependency["kind"], string> = { BLOCKS: "Blocks", NEEDS_INPUT: "Needs input", SHARED_COMPONENT: "Shared component" };

export default function TeamLeadDependenciesPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);
  const deps = forceEmpty ? [] : t.dependencies;

  const TaskChip = ({ id }: { id: string }) => {
    const task = lk.task(id);
    const mine = t.isTeamTask(id);
    const inner = (
      <div className={`rounded-lg border p-2.5 min-w-0 transition-colors ${mine ? "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-violet-500/40" : "border-dashed border-[var(--color-border)]"}`}>
        <p className="text-[11px] font-bold">{task?.key}</p>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{mine ? task?.title : "Another team"}</p>
        {mine && task && <div className="mt-1"><TaskStatusBadge status={task.status} /></div>}
      </div>
    );
    return mine ? <Link href={href(`work-items/${id}`)} className="block min-w-0 flex-1">{inner}</Link> : <div className="min-w-0 flex-1">{inner}</div>;
  };

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Team work" }, { label: "Dependencies" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Dependencies"
      description="Links between your team's tasks and work owned by other teams."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <Panel title="By state" icon={Network} iconTone="cyan">
          <DonutChart
            centerLabel="links"
            data={[
              { name: "At risk", value: deps.filter((d) => d.status === "AT_RISK").length, color: "#EF4444" },
              { name: "Open", value: deps.filter((d) => d.status === "OPEN").length, color: "#F59E0B" },
              { name: "Resolved", value: deps.filter((d) => d.status === "RESOLVED").length, color: "#10B981" },
            ]}
          />
        </Panel>
        <div className="xl:col-span-2 space-y-3">
          {deps.length === 0 ? (
            <SurfaceCard><EmptyStateView icon={Network} title="No dependencies" description="Your team's tasks are independent right now." /></SurfaceCard>
          ) : (
            deps.map((d) => (
              <SurfaceCard key={d.id} className="p-3.5 space-y-2.5 transition-all duration-200 hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge label={KIND[d.kind]} tone="info" />
                    {d.external && <StatusBadge label="Cross-team" tone="violet" />}
                  </div>
                  <StatusBadge label={d.status === "AT_RISK" ? "At risk" : d.status === "OPEN" ? "Open" : "Resolved"} tone={d.status === "AT_RISK" ? "danger" : d.status === "OPEN" ? "warning" : "success"} dot />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <TaskChip id={d.fromTaskId} />
                  <ArrowRight className="w-4 h-4 shrink-0 self-center rotate-90 sm:rotate-0 text-[var(--color-text-muted)]" />
                  <TaskChip id={d.toTaskId} />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)]">{d.note}</p>
              </SurfaceCard>
            ))
          )}
        </div>
      </div>
    </PageFrame>
  );
}
