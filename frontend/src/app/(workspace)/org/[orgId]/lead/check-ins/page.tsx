"use client";

import React, { useState } from "react";
import { BellRing, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import {
  AdminButton,
  Avatar,
  DataTable,
  PageFrame,
  Panel,
  ProgressBar,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";
import type { CheckIn } from "@/mocks/delivery-dashboards";

type Filter = "OPEN" | "SUBMITTED" | "ALL";
const TONE = { DUE: "warning", OVERDUE: "danger", SUBMITTED: "success" } as const;
const LABEL = { DUE: "Due today", OVERDUE: "Overdue", SUBMITTED: "Submitted" } as const;

export default function TeamLeadCheckInsPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [reminded, setReminded] = useState<string[]>([]);
  const rows = t.checkIns.filter((c) => (filter === "ALL" ? true : filter === "OPEN" ? c.status !== "SUBMITTED" : c.status === "SUBMITTED"));

  const remind = (c: CheckIn) => {
    setReminded((r) => [...r, c.id]);
    toast.success(`Reminder sent to ${lk.person(c.memberId)?.name}`);
  };

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "My team" }, { label: "Check-ins" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Check-ins"
      description="Daily updates from your team. Times are shown in UTC."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Today's check-ins" icon={MessageSquareText} iconTone="teal">
          <DonutChart
            centerLabel="people"
            data={[
              { name: "Submitted", value: t.checkIns.filter((c) => c.status === "SUBMITTED").length, color: "#10B981" },
              { name: "Due", value: t.checkIns.filter((c) => c.status === "DUE").length, color: "#F59E0B" },
              { name: "Overdue", value: t.checkIns.filter((c) => c.status === "OVERDUE").length, color: "#EF4444" },
            ]}
          />
        </Panel>
        <div className="xl:col-span-2 space-y-3">
          <SegmentTabs<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "OPEN", label: "Outstanding", count: t.checkIns.filter((c) => c.status !== "SUBMITTED").length },
              { value: "SUBMITTED", label: "Submitted" },
              { value: "ALL", label: "All", count: t.checkIns.length },
            ]}
          />
          <SurfaceCard className="overflow-hidden">
            <DataTable
              rows={rows}
              rowHref={(c) => href(`team/${c.memberId}`)}
              empty={{ icon: MessageSquareText, title: "No check-ins here", description: "Nothing in this list right now." }}
              columns={[
                { key: "m", header: "Member", className: "w-[46%] md:w-[34%]", render: (c) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.person(c.memberId)} size="sm" /><span className="min-w-0"><span className="block font-semibold truncate">{lk.person(c.memberId)?.name}</span><span className="block text-[11px] text-[var(--color-text-muted)] truncate">{c.lastSummary}</span></span></span> },
                { key: "s", header: "Status", render: (c) => <StatusBadge label={LABEL[c.status]} tone={TONE[c.status]} dot /> },
                { key: "d", header: "Due (UTC)", hideBelow: "md", render: (c) => formatDateTime(c.dueAt) },
                { key: "c", header: "Confidence", hideBelow: "lg", render: (c) => <ProgressBar value={c.confidence} size="sm" showLabel /> },
                {
                  key: "a",
                  header: "",
                  hideBelow: "sm",
                  className: "w-[110px] text-right",
                  render: (c) =>
                    c.status !== "SUBMITTED" ? (
                      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <AdminButton size="xs" variant="subtle" disabled={reminded.includes(c.id)} onClick={() => remind(c)}>
                          <BellRing className="w-3 h-3" /> {reminded.includes(c.id) ? "Sent" : "Remind"}
                        </AdminButton>
                      </span>
                    ) : null,
                },
              ]}
            />
          </SurfaceCard>
        </div>
      </div>
    </PageFrame>
  );
}
