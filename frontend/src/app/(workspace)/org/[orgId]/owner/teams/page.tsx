"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { BarChart3, Plus, UsersRound } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, AvatarStack, ButtonLink, EmptyStateView, HealthBadge, PageFrame, Panel, StatusBadge, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerTeamsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.teams);
  const projects = useOrgConsoleStore((s) => s.projects);
  const teams = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);

  return (
    <OrgGate family="owner" need="team.manage">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Teams" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Teams"
        description="How the company is organized, and what each team delivers."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("teams/new")}><Plus className="w-3.5 h-3.5" /> New team</ButtonLink>}
      >
        {teams.length === 0 ? (
          <SurfaceCard><EmptyStateView icon={UsersRound} title="No teams yet" description="Create a team to group people and projects." /></SurfaceCard>
        ) : (
          <>
            <Panel title="Team size vs projects" icon={BarChart3} iconTone="violet">
              <GroupedBarChart data={teams.map((t) => ({ label: t.name.split(" ")[0], primary: t.memberIds.length, secondary: projects.filter((p) => p.teamId === t.id).length }))} primaryLabel="Members" secondaryLabel="Projects" primaryColor="#8B5CF6" secondaryColor="#10B981" height={200} />
            </Panel>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              {teams.map((t) => {
                const tp = projects.filter((p) => p.teamId === t.id);
                const people = t.memberIds.map((id) => lk.member(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
                return (
                  <Link key={t.id} href={href(`teams/${t.id}`)} className="group block rounded-xl">
                    <SurfaceCard className="relative h-full overflow-hidden p-4 space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-violet-500/40">
                      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: t.color }} />
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">{t.name}</p><StatusBadge label={`${t.memberIds.length} people`} tone="violet" /></div>
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{t.description}</p>
                      <div className="flex items-center gap-2 text-[11px]"><Avatar person={lk.member(t.leadId)} size="sm" />Lead <b>{lk.member(t.leadId)?.name}</b></div>
                      <div className="flex flex-wrap gap-1.5">{tp.length === 0 ? <span className="text-[11px] text-[var(--color-text-muted)]">No projects</span> : tp.map((p) => <HealthBadge key={p.id} health={p.health} />)}</div>
                      <div className="pt-2 border-t border-[var(--color-border)]"><AvatarStack people={people} max={6} /></div>
                    </SurfaceCard>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
