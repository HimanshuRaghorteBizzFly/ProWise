"use client";

import React, { useMemo } from "react";
import { Plus, UsersRound } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, AvatarStack, ButtonLink, DataTable, PageFrame, Panel, StatusBadge, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { HorizontalBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function AdminTeamsPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.teams);
  const projects = useOrgConsoleStore((s) => s.projects);
  const teams = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);

  return (
    <OrgGate family="admin" need="team.manage">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Teams" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Teams"
        description="Create teams and keep their leads and members up to date."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("teams/new")}><Plus className="w-3.5 h-3.5" /> New team</ButtonLink>}
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <Panel title="Members per team" icon={UsersRound} iconTone="violet">
            <HorizontalBarChart unit="" valueLabel="Members" data={teams.map((t) => ({ name: t.name.split(" ")[0], value: t.memberIds.length, color: t.color }))} />
          </Panel>
          <SurfaceCard className="xl:col-span-2 overflow-hidden">
            <DataTable
              rows={teams}
              rowHref={(t) => href(`teams/${t.id}`)}
              empty={{ icon: UsersRound, title: "No teams", description: "Create the first team." }}
              columns={[
                { key: "n", header: "Team", className: "w-[50%] md:w-[34%]", render: (t) => <span className="flex items-center gap-2.5 min-w-0"><span className="h-8 w-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} /><span className="min-w-0"><span className="block font-semibold truncate">{t.name}</span><span className="block text-[11px] text-[var(--color-text-muted)] truncate">{t.description}</span></span></span> },
                { key: "l", header: "Lead", hideBelow: "sm", render: (t) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.member(t.leadId)} size="sm" /><span className="truncate">{lk.member(t.leadId)?.name}</span></span> },
                { key: "m", header: "Members", render: (t) => <AvatarStack people={t.memberIds.map((id) => lk.member(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))} max={3} /> },
                { key: "p", header: "Projects", hideBelow: "lg", render: (t) => <StatusBadge label={`${projects.filter((p) => p.teamId === t.id).length}`} tone="info" /> },
              ]}
            />
          </SurfaceCard>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
