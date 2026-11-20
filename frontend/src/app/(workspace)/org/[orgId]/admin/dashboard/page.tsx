"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  FolderKanban,
  GitBranch,
  GitPullRequestArrow,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_TODAY, ORG_VIEWERS, PERMISSIONS, SYNC_EVENTS } from "@/mocks/org-console";
import {
  Avatar,
  ButtonLink,
  Dot,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  StatusBadge,
  formatDate,
  useDemoLoad,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GaugeRing, GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { Progress3DChart } from "@/components/org-console/Progress3DChart";
import { AuditSeverityBadge, InviteStatusBadge, MemberStatusBadge, OrgGate, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { actorPermissions } from "@/components/org-console/role-rules";

export default function AdminDashboardPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const s = useOrgConsoleStore();

  const m = useMemo(() => {
    const members = forceEmpty ? [] : s.members;
    const pending = forceEmpty ? [] : s.invitations.filter((i) => i.status === "PENDING");
    const attention = members.filter((x) => x.status === "SUSPENDED" || (x.status === "ACTIVE" && !x.mfa));
    const repos = forceEmpty ? [] : s.repositories;
    const mine = actorPermissions("admin", s.roles);
    return {
      members,
      pending,
      attention,
      repos,
      healthy: repos.filter((r) => r.status === "HEALTHY").length,
      failing: repos.filter((r) => r.status === "FAILED" || r.status === "PAUSED"),
      expiring: pending.filter((i) => new Date(i.expiresAt).getTime() - new Date(`${ORG_TODAY}T00:00:00Z`).getTime() < 3 * 86400000),
      mine,
      week: s.audit.filter((e) => e.at >= "2026-11-14").length,
    };
  }, [s, forceEmpty]);

  const syncPct = m.repos.length ? Math.round((m.healthy / m.repos.length) * 100) : 0;

  return (
    <OrgGate family="admin">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Dashboard" }]}
        title="Operations desk"
        description={`${ORG_VIEWERS.admin.name} · ${s.settings.name} · ${formatDate(ORG_TODAY, true)}. People, access and integrations at a glance.`}
        badge="Org Admin"
        status={status}
        onRetry={retry}
        actions={
          <>
            <ButtonLink href={href("integrations/connect")} variant="outline"><GitBranch className="w-3.5 h-3.5" /> Connect repository</ButtonLink>
            <ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>
          </>
        }
      >
        <KpiGrid>
          <KpiTile label="Active members" value={m.members.filter((x) => x.status === "ACTIVE").length} icon={Users} tone="blue" chip={{ label: `${m.members.length} total`, tone: "info" }} meta={<><span className="inline-flex items-center gap-1"><Dot className="bg-slate-400" />{m.members.filter((x) => x.status === "DISABLED").length} disabled</span><span>•</span><span>{m.members.filter((x) => x.status === "SUSPENDED").length} suspended</span></>} footer="Members" href={href("members")} />
          <KpiTile label="Pending invitations" value={m.pending.length} icon={Mail} tone="amber" chip={{ label: `${m.expiring.length} expiring`, tone: "warning" }} meta={<span>Within 3 days</span>} footer="Invitations" href={href("invitations")} />
          <KpiTile label="Needs attention" value={m.attention.length} icon={AlertTriangle} tone="rose" chip={{ label: "MFA / suspended", tone: "danger" }} meta={<span>{m.members.filter((x) => x.status === "ACTIVE" && !x.mfa).length} without MFA</span>} footer="Review members" href={href("members")} />
          <KpiTile label="Teams" value={s.teams.length} icon={UsersRound} tone="violet" chip={{ label: `${s.teams.reduce((t, x) => t + x.memberIds.length, 0)} seats`, tone: "violet" }} meta={<span>{s.teams.map((t) => t.name.split(" ")[0]).join(" · ")}</span>} footer="Manage teams" href={href("teams")} />
          <KpiTile label="Repository sync" value={`${m.healthy}/${m.repos.length}`} icon={GitBranch} tone="cyan" chip={{ label: `${m.failing.length} need action`, tone: m.failing.length ? "danger" : "success" }} meta={<span>Webhook success {s.github.webhookHealth}%</span>} footer="Integrations & sync" href={href("integrations")} />
          <KpiTile label="Audit events (7d)" value={m.week} icon={Activity} tone="teal" chip={{ label: `${s.audit.filter((e) => e.severity === "CRITICAL").length} critical`, tone: "danger" }} meta={<span>Members, roles, integrations</span>} footer="Audit activity" href={href("audit-logs")} />
        </KpiGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
          <Panel title="Member status" icon={Users} action={{ label: "Members", href: href("members") }}>
            <DonutChart
              centerLabel="members"
              data={[
                { name: "Active", value: m.members.filter((x) => x.status === "ACTIVE").length, color: "#10B981" },
                { name: "Suspended", value: m.members.filter((x) => x.status === "SUSPENDED").length, color: "#EF4444" },
                { name: "Disabled", value: m.members.filter((x) => x.status === "DISABLED").length, color: "#94A3B8" },
                { name: "Invited", value: m.pending.length, color: "#F59E0B" },
              ]}
            />
          </Panel>
          <Panel title="Sync health" description="Repositories syncing cleanly" icon={GitBranch} iconTone="cyan" action={{ label: "Sync status", href: href("integrations") }}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <GaugeRing value={syncPct} color={syncPct >= 80 ? "#10B981" : "#F59E0B"} label="healthy" size={120} />
              <div className="w-full space-y-0.5 min-w-0">
                {m.failing.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">All repositories healthy.</p>}
                {m.failing.map((r) => (
                  <LinkRow key={r.id} href={href(`integrations/${r.id}`)}>
                    <span className="text-[11px] font-mono font-semibold truncate flex-1">{r.fullName.split("/")[1]}</span>
                    <SyncStatusBadge status={r.status} />
                  </LinkRow>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Webhook deliveries" description="This week" icon={GitPullRequestArrow} iconTone="emerald" className="lg:col-span-2 2xl:col-span-1">
            <GroupedBarChart data={SYNC_EVENTS} primaryLabel="Delivered" secondaryLabel="Failed" primaryColor="#10B981" secondaryColor="#F43F5E" height={200} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
          <Panel className="xl:col-span-2" title="Members needing attention" description="Suspended accounts and members without MFA" icon={AlertTriangle} iconTone="rose" action={{ label: "All members", href: href("members") }}>
            {m.attention.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Nobody needs attention.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                {m.attention.map((x) => (
                  <LinkRow key={x.id} href={href(`members/${x.id}`)}>
                    <Avatar person={x} size="sm" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{x.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{x.status === "SUSPENDED" ? "Suspended" : "MFA not enrolled"} · {lk.role(x.roleId)?.name}</p></div>
                    <MemberStatusBadge status={x.status} />
                  </LinkRow>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Your access" description="What you can manage as Org Admin" icon={ShieldCheck} iconTone="blue" action={{ label: "Roles", href: href("roles-permissions") }}>
            <GaugeRing value={Math.round((m.mine.length / PERMISSIONS.length) * 100)} color="#3B82F6" label={`${m.mine.length} of ${PERMISSIONS.length}`} size={120} />
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <StatusBadge label="Invite & disable" tone="success" />
              <StatusBadge label="Assign roles" tone="success" />
              <StatusBadge label="Org settings" tone="neutral" />
              <StatusBadge label="Ownership" tone="neutral" />
            </div>
          </Panel>
        </div>

        <Panel title="Progress per project" description="Approved progress, coloured by project health" icon={FolderKanban} iconTone="emerald" action={{ label: "Projects", href: href("projects") }}>
          {s.projects.length && !forceEmpty ? (
            <Progress3DChart projects={s.projects} />
          ) : (
            <p className="py-10 text-center text-xs text-[var(--color-text-muted)]">No projects yet.</p>
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
          <Panel title="Pending invitations" icon={Mail} iconTone="amber" action={{ label: "All", href: href("invitations") }}>
            <div className="space-y-0.5">
              {m.pending.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No pending invitations.</p>}
              {m.pending.map((i) => (
                <LinkRow key={i.id} href={href(`invitations/${i.id}`)}>
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{i.email}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.role(i.roleId)?.name} · sent {timeAgo(i.sentAt)}</p></div>
                  <InviteStatusBadge status={i.status} />
                </LinkRow>
              ))}
            </div>
          </Panel>
          <Panel title="Recent audit activity" icon={Activity} iconTone="teal" action={{ label: "Audit", href: href("audit-logs") }}>
            <div className="space-y-0.5">
              {s.audit.filter((e) => e.category !== "SETTINGS").slice(0, 5).map((e) => (
                <LinkRow key={e.id} href={href(`audit-logs/${e.id}`)}>
                  <Avatar person={lk.member(e.actorId)} size="sm" />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{lk.member(e.actorId)?.name} {e.action}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{timeAgo(e.at)}</p></div>
                  <AuditSeverityBadge severity={e.severity} />
                </LinkRow>
              ))}
            </div>
          </Panel>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
