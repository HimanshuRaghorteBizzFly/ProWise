"use client";

import React from "react";
import { useParams } from "next/navigation";
import { FolderKanban, Pencil, Users } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, HealthBadge, LinkRow, NotFoundState, PageFrame, Panel, ProgressBar, StatPill, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { MemberStatusBadge, OrgGate, RoleChip, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { TeamForm } from "@/components/org-console/TeamForm";

export default function OwnerTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const team = useOrgConsoleStore((s) => s.teams.find((t) => t.id === teamId));
  const projects = useOrgConsoleStore((s) => s.projects);
  const back = { href: href("teams"), label: "Back to teams" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Teams", href: href("teams") }, { label: team?.name ?? "Team" }];

  if (status === "ready" && !team) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Team"><NotFoundState what="Team" back={back} /></PageFrame></OrgGate>;
  }

  const tp = projects.filter((p) => p.teamId === teamId);

  return (
    <OrgGate family="owner" need="team.manage">
      <PageFrame crumbs={crumbs} back={back} title={team?.name ?? "Team"} description={team?.description} status={status} onRetry={retry} skeleton="detail">
        {team && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Lead" value={lk.member(team.leadId)?.name ?? "—"} />
              <StatPill label="Members" value={team.memberIds.length} />
              <StatPill label="Projects" value={tp.length} />
              <StatPill label="Created" value={formatDate(team.createdAt, true)} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Members" icon={Users} iconTone="violet">
                <div className="space-y-0.5">
                  {team.memberIds.map((id) => {
                    const m = lk.member(id);
                    return m ? (
                      <LinkRow key={id} href={href(`members/${id}`)}>
                        <Avatar person={m} size="sm" />
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{m.name}{id === team.leadId ? " · Lead" : ""}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{m.title}</p></div>
                        <span className="hidden sm:inline-flex"><RoleChip role={lk.role(m.roleId)} /></span>
                        <MemberStatusBadge status={m.status} />
                      </LinkRow>
                    ) : null;
                  })}
                </div>
              </Panel>
              <Panel title="Projects" icon={FolderKanban} iconTone="emerald">
                <div className="space-y-0.5">
                  {tp.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No projects assigned.</p>}
                  {tp.map((p) => (
                    <LinkRow key={p.id} href={href(`projects/${p.id}`)}>
                      <div className="min-w-0 flex-1 space-y-1"><p className="text-xs font-semibold truncate">{p.name}</p><ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} size="sm" /></div>
                      <HealthBadge health={p.health} />
                    </LinkRow>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel title="Edit lead & members" icon={Pencil} iconTone="blue"><TeamForm family="owner" team={team} /></Panel>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
