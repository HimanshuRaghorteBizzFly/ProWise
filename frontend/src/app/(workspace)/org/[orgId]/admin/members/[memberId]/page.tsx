"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Activity, Mail, MapPin, ShieldAlert, UsersRound } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, LinkRow, NotFoundState, PageFrame, Panel, StatPill, StatusBadge, SurfaceCard, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { AuditSeverityBadge, MemberStatusBadge, OrgGate, RoleChip, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { MemberAccessPanel } from "@/components/org-console/OrgWidgets";

export default function AdminMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const member = useOrgConsoleStore((s) => s.members.find((m) => m.id === memberId));
  const audit = useOrgConsoleStore((s) => s.audit);
  const back = { href: href("members"), label: "Back to members" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Members", href: href("members") }, { label: member?.name ?? "Member" }];

  if (status === "ready" && !member) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Member"><NotFoundState what="Member" back={back} /></PageFrame></OrgGate>;
  }
  const events = audit.filter((e) => e.category !== "SETTINGS" && (e.actorId === memberId || (member && e.target.includes(member.name))));
  const checks = member
    ? [
        { label: "MFA enrolled", ok: member.mfa },
        { label: "Active in last 7 days", ok: new Date(member.lastActiveAt).getTime() > new Date("2026-11-13T00:00:00Z").getTime() },
        { label: "Company email domain", ok: member.email.endsWith("@acmehealth.io") },
        { label: "In at least one team", ok: member.teamIds.length > 0 || ["role-owner", "role-admin", "role-viewer", "role-security", "role-delivery-director"].includes(member.roleId) },
      ]
    : [];

  return (
    <OrgGate family="admin" need="member.disable">
      <PageFrame crumbs={crumbs} back={back} title={member?.name ?? "Member"} description={member ? `${member.title} · joined ${formatDate(member.joinedAt, true)}` : undefined} status={status} onRetry={retry} skeleton="detail">
        {member && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <SurfaceCard className="p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <Avatar person={member} size="lg" />
                <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2"><RoleChip role={lk.role(member.roleId)} /><MemberStatusBadge status={member.status} /></div>
                  <p className="flex flex-wrap justify-center sm:justify-start gap-3 text-[11px] text-[var(--color-text-secondary)]"><span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email}</span><span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{member.location}</span></p>
                </div>
              </SurfaceCard>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Last active" value={timeAgo(member.lastActiveAt)} />
                <StatPill label="MFA" value={member.mfa ? "On" : "Off"} tone={member.mfa ? "success" : "danger"} />
                <StatPill label="Teams" value={member.teamIds.length} />
                <StatPill label="Joined" value={formatDate(member.joinedAt, true)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel title="Access health" icon={ShieldAlert} iconTone="rose">
                  <ul className="space-y-2">
                    {checks.map((c) => (
                      <li key={c.label} className="flex items-center justify-between gap-2 text-xs"><span>{c.label}</span><StatusBadge label={c.ok ? "OK" : "Fix"} tone={c.ok ? "success" : "danger"} /></li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Teams" icon={UsersRound} iconTone="violet">
                  <div className="space-y-0.5">
                    {member.teamIds.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Not in a team.</p>}
                    {member.teamIds.map((id) => {
                      const t = lk.team(id);
                      return t ? <LinkRow key={id} href={href(`teams/${id}`)}><span className="h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: t.color }} /><span className="text-xs font-semibold truncate flex-1">{t.name}</span></LinkRow> : null;
                    })}
                  </div>
                </Panel>
              </div>
              <Panel title="Audit trail" icon={Activity} iconTone="teal">
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
            <MemberAccessPanel family="admin" member={member} />
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
