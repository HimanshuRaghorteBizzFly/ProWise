"use client";

import React from "react";
import { BarChart3, Scale, UserPlus, Users } from "lucide-react";
import {
  Avatar,
  ButtonLink,
  DataTable,
  PageFrame,
  Panel,
  ProgressBar,
  StatusBadge,
  daysFromToday,
  useDemoLoad,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

export default function TeamLeadWorkloadPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const t = useLeadTeam(forceEmpty);
  const rows = t.members.map((m) => {
    const open = t.tasks.filter((x) => x.assigneeId === m.id && x.status !== "DONE");
    return { ...m, open: open.length, openHours: open.reduce((s, x) => s + x.estimateHours, 0), overdue: open.filter((x) => daysFromToday(x.dueDate) < 0).length };
  });

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "My team" }, { label: "Workload" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Team workload"
      description="Balance work before anyone tips over capacity."
      status={status}
      onRetry={retry}
      actions={<ButtonLink href={href("assignments")}><UserPlus className="w-3.5 h-3.5" /> Rebalance</ButtonLink>}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Assigned vs capacity (hours / week)" icon={BarChart3} iconTone="violet">
          <GroupedBarChart data={rows.map((m) => ({ label: m.name.split(" ")[0], primary: m.assignedHours, secondary: m.capacityHours }))} primaryLabel="Assigned" secondaryLabel="Capacity" primaryColor="#8B5CF6" secondaryColor="#CBD5E1" unit="h" height={250} />
        </Panel>
        <Panel title="Load bands" icon={Scale} iconTone="amber">
          <DonutChart
            centerLabel="people"
            data={[
              { name: "Over", value: rows.filter((m) => m.pct > 100).length, color: "#EF4444" },
              { name: "Near", value: rows.filter((m) => m.pct >= 85 && m.pct <= 100).length, color: "#F59E0B" },
              { name: "Healthy", value: rows.filter((m) => m.pct >= 60 && m.pct < 85).length, color: "#10B981" },
              { name: "Room", value: rows.filter((m) => m.pct < 60).length, color: "#3B82F6" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Members" description="Open a member to see their tasks" icon={Users} bodyClassName="p-0">
        <DataTable
          rows={rows}
          rowHref={(m) => href(`team/${m.id}`)}
          empty={{ icon: Users, title: "No members", description: "Your team has no members yet." }}
          columns={[
            { key: "n", header: "Member", className: "w-[46%] md:w-[30%]", render: (m) => <span className="flex items-center gap-2 min-w-0"><Avatar person={m} size="sm" /><span className="min-w-0"><span className="block font-semibold truncate">{m.name}</span><span className="block text-[11px] text-[var(--color-text-muted)] truncate">{m.title}</span></span></span> },
            { key: "l", header: "Load", render: (m) => <ProgressBar value={Math.min(100, m.pct)} color={utilisationTone(m.pct).color} size="sm" showLabel /> },
            { key: "b", header: "Band", hideBelow: "sm", render: (m) => <StatusBadge label={utilisationTone(m.pct).label} tone={utilisationTone(m.pct).tone} /> },
            { key: "o", header: "Open tasks", hideBelow: "md", render: (m) => <span className="tabular-nums">{m.open} · {m.openHours}h</span> },
            { key: "d", header: "Overdue", hideBelow: "lg", render: (m) => (m.overdue ? <StatusBadge label={`${m.overdue}`} tone="danger" /> : <span className="text-[var(--color-text-muted)]">—</span>) },
          ]}
        />
      </Panel>
    </PageFrame>
  );
}
