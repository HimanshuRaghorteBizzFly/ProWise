"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Pencil, Users } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, LinkRow, NotFoundState, PageFrame, Panel, StatPill, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { MemberStatusBadge, OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { TeamForm } from "@/components/org-console/TeamForm";

export default function AdminTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const team = useOrgConsoleStore((s) => s.teams.find((t) => t.id === teamId));
  const projects = useOrgConsoleStore((s) => s.projects);
  const back = { href: href("teams"), label: "Back to teams" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Teams", href: href("teams") }, { label: team?.name ?? "Team" }];

  if (status === "ready" && !team) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Team"><NotFoundState what="Team" back={back} /></PageFrame></OrgGate>;
  }
  const people = team ? team.memberIds.map((id) => lk.member(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)) : [];

  return (
    <OrgGate family="admin" need="team.manage">
      <PageFrame crumbs={crumbs} back={back} title={team?.name ?? "Team"} description={team?.description} status={status} onRetry={retry} skeleton="detail">
        {team && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Lead" value={lk.member(team.leadId)?.name ?? "—"} />
              <StatPill label="Members" value={people.length} />
              <StatPill label="Inactive" value={people.filter((p) => p.status !== "ACTIVE").length} tone={people.some((p) => p.status !== "ACTIVE") ? "warning" : "success"} />
              <StatPill label="Projects" value={projects.filter((p) => p.teamId === team.id).length} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel title="Members" icon={Users} iconTone="violet">
                <div className="space-y-0.5">
                  {people.map((m) => (
                    <LinkRow key={m.id} href={href(`members/${m.id}`)}>
                      <Avatar person={m} size="sm" />
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{m.name}{m.id === team.leadId ? " · Lead" : ""}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{m.title}</p></div>
                      <MemberStatusBadge status={m.status} />
                    </LinkRow>
                  ))}
                </div>
              </Panel>
              <Panel className="xl:col-span-2" title="Manage lead & members" icon={Pencil} iconTone="blue"><TeamForm family="admin" team={team} /></Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
