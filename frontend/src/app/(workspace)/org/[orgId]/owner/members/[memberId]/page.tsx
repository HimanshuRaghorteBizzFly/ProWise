"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Activity, FolderKanban, Mail, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { PERMISSIONS } from "@/mocks/org-console";
import { Avatar, HealthBadge, LinkRow, NotFoundState, PageFrame, Panel, StatPill, StatusBadge, SurfaceCard, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { AuditSeverityBadge, MemberStatusBadge, OrgGate, RoleChip, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { MemberAccessPanel } from "@/components/org-console/OrgWidgets";

export default function OwnerMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const member = useOrgConsoleStore((s) => s.members.find((m) => m.id === memberId));
  const projects = useOrgConsoleStore((s) => s.projects);
  const audit = useOrgConsoleStore((s) => s.audit);
  const back = { href: href("members"), label: "Back to members" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Members", href: href("members") }, { label: member?.name ?? "Member" }];

  if (status === "ready" && !member) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Member"><NotFoundState what="Member" back={back} /></PageFrame></OrgGate>;
  }

  const role = lk.role(member?.roleId);
  const managed = projects.filter((p) => p.managerId === memberId);
  const events = audit.filter((e) => e.actorId === memberId || (member && e.target.includes(member.name)));

  return (
    <OrgGate family="owner" need="member.invite">
      <PageFrame crumbs={crumbs} back={back} title={member?.name ?? "Member"} description={member ? `${member.title} · joined ${formatDate(member.joinedAt, true)}` : undefined} status={status} onRetry={retry} skeleton="detail">
        {member && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <SurfaceCard className="p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <Avatar person={member} size="lg" />
                <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2"><RoleChip role={role} /><MemberStatusBadge status={member.status} />{member.mfa ? <StatusBadge label="MFA on" tone="success" /> : <StatusBadge label="MFA off" tone="danger" />}</div>
                  <p className="flex flex-wrap justify-center sm:justify-start gap-3 text-[11px] text-[var(--color-text-secondary)]">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{member.location}</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">{role?.description}</p>
                </div>
              </SurfaceCard>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Last active" value={timeAgo(member.lastActiveAt)} />
                <StatPill label="Teams" value={member.teamIds.length} />
                <StatPill label="Projects managed" value={managed.length} />
                <StatPill label="Permissions" value={role?.permissions.length ?? 0} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel title="Teams" icon={UsersRound} iconTone="violet">
                  <div className="space-y-0.5">
                    {member.teamIds.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Not in a team.</p>}
                    {member.teamIds.map((id) => {
                      const t = lk.team(id);
                      return t ? (
                        <LinkRow key={id} href={href(`teams/${id}`)}>
                          <span className="h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-xs font-semibold truncate flex-1">{t.name}</span>
                          {t.leadId === member.id && <StatusBadge label="Lead" tone="violet" />}
                        </LinkRow>
                      ) : null;
                    })}
                  </div>
                </Panel>
                <Panel title="Projects managed" icon={FolderKanban} iconTone="emerald">
                  <div className="space-y-0.5">
                    {managed.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No projects.</p>}
                    {managed.map((p) => (
                      <LinkRow key={p.id} href={href(`projects/${p.id}`)}>
                        <span className="text-xs font-semibold truncate flex-1">{p.name}</span>
                        <HealthBadge health={p.health} />
                      </LinkRow>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel title="Recent activity" icon={Activity} iconTone="amber">
                <div className="space-y-0.5">
                  {events.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No recorded activity.</p>}
                  {events.slice(0, 6).map((e) => (
                    <LinkRow key={e.id} href={href(`audit-logs/${e.id}`)}>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{lk.member(e.actorId)?.name} {e.action}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{e.target} · {timeAgo(e.at)}</p></div>
                      <AuditSeverityBadge severity={e.severity} />
                    </LinkRow>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <MemberAccessPanel family="owner" member={member} />
              <Panel title="Role details" icon={ShieldCheck} iconTone="violet" action={role ? { label: "Open role", href: href(`roles-permissions/${role.id}`) } : undefined}>
                <p className="text-xs text-[var(--color-text-secondary)]">{role?.permissions.length} of {PERMISSIONS.length} permissions. Open the role to see exactly what it can and cannot do.</p>
              </Panel>
            </div>
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
