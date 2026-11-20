"use client";

import React, { useMemo } from "react";
import {
  Activity,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Mail,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { MEMBER_GROWTH, ORG_TODAY, ORG_VIEWERS } from "@/mocks/org-console";
import {
  Avatar,
  AvatarStack,
  ButtonLink,
  DataTable,
  Dot,
  HealthBadge,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  ProgressBar,
  SeverityBadge,
  formatDate,
  useDemoLoad,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, TrendAreaChart } from "@/components/delivery/DeliveryCharts";
import { Progress3DChart } from "@/components/org-console/Progress3DChart";
import { AuditSeverityBadge, OrgGate, SYNC_COLOR, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerDashboardPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const s = useOrgConsoleStore();

  const m = useMemo(() => {
    const members = forceEmpty ? [] : s.members;
    const projects = forceEmpty ? [] : s.projects;
    const active = members.filter((x) => x.status === "ACTIVE");
    const live = projects.filter((p) => p.status === "ACTIVE");
    const onTrack = projects.filter((p) => p.health === "ON_TRACK").length;
    const byRole = s.roles
      .map((r) => ({ name: r.name, value: members.filter((x) => x.roleId === r.id).length, color: r.color }))
      .filter((x) => x.value > 0);
    return {
      members,
      projects,
      active,
      live,
      noMfa: active.filter((x) => !x.mfa).length,
      healthPct: projects.length ? Math.round((onTrack / projects.length) * 100) : 0,
      avg: live.length ? Math.round(live.reduce((t, p) => t + p.progress, 0) / live.length) : 0,
      pending: s.invitations.filter((i) => i.status === "PENDING"),
      risks: forceEmpty ? [] : [...s.risks].sort((a, b) => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(a.severity) - ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(b.severity)),
      byRole,
      failing: s.repositories.filter((r) => r.status === "FAILED" || r.status === "PAUSED"),
    };
  }, [s, forceEmpty]);

  return (
    <OrgGate family="owner">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Dashboard" }]}
        title={s.settings.name}
        description={`Welcome back, ${ORG_VIEWERS.owner.name.split(" ")[0]}. The whole company on ${formatDate(ORG_TODAY, true)}.`}
        badge="Organization Owner"
        status={status}
        onRetry={retry}
        actions={
          <>
            <ButtonLink href={href("teams/new")} variant="outline"><UsersRound className="w-3.5 h-3.5" /> New team</ButtonLink>
            <ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>
          </>
        }
      >
        <KpiGrid>
          <KpiTile label="Members" value={m.active.length} icon={Users} tone="blue" chip={{ label: `${m.members.length} total`, tone: "info" }} meta={<><span className="inline-flex items-center gap-1"><Dot className="bg-rose-500" />{m.members.filter((x) => x.status !== "ACTIVE").length} inactive</span><span>•</span><span>{m.noMfa} without MFA</span></>} footer="Member directory" href={href("members")} />
          <KpiTile label="Teams" value={s.teams.length} icon={UsersRound} tone="violet" chip={{ label: `${Math.round(s.teams.reduce((t, x) => t + x.memberIds.length, 0) / Math.max(1, s.teams.length))} avg size`, tone: "violet" }} meta={<span>{s.teams.map((t) => t.name.split(" ")[0]).join(" · ")}</span>} footer="Teams" href={href("teams")} />
          <KpiTile label="Active projects" value={m.live.length} icon={FolderKanban} tone="emerald" chip={{ label: `${m.avg}% avg`, tone: "success" }} meta={<span>{m.projects.length} in portfolio · {m.projects.filter((p) => p.status === "COMPLETED").length} completed</span>} footer="Portfolio" href={href("projects")} />
          <KpiTile label="Organization health" value={`${m.healthPct}%`} icon={HeartPulse} tone="teal" chip={{ label: `${m.projects.filter((p) => p.health === "OFF_TRACK").length} off track`, tone: "danger" }} meta={<span>Share of projects on track</span>} footer="Health & risks" href={href("health")} />
          <KpiTile label="Open risks" value={m.risks.length} icon={ShieldAlert} tone="rose" chip={{ label: `${m.risks.filter((r) => r.severity === "CRITICAL").length} critical`, tone: "danger" }} meta={<span>{m.risks.filter((r) => r.severity === "HIGH").length} high severity</span>} footer="Risk register" href={href("health")} />
          <KpiTile label="Pending invitations" value={m.pending.length} icon={Mail} tone="amber" chip={{ label: "Awaiting", tone: "warning" }} meta={<span>{s.invitations.filter((i) => i.status === "EXPIRED").length} expired</span>} footer="Invitations" href={href("invitations")} />
        </KpiGrid>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
          <Panel className="xl:col-span-2" title="Progress per project" description="Approved progress across the whole portfolio" icon={TrendingUp} iconTone="emerald" action={{ label: "Portfolio", href: href("projects") }}>
            {m.projects.length ? (
              <Progress3DChart projects={m.projects} />
            ) : (
              <p className="py-10 text-center text-xs text-[var(--color-text-muted)]">No projects yet.</p>
            )}
          </Panel>
          <Panel title="Project health" icon={HeartPulse} iconTone="teal" action={{ label: "Details", href: href("health") }}>
            <DonutChart
              centerLabel="projects"
              data={[
                { name: "On track", value: m.projects.filter((p) => p.health === "ON_TRACK").length, color: "#10B981" },
                { name: "At risk", value: m.projects.filter((p) => p.health === "AT_RISK").length, color: "#F59E0B" },
                { name: "Off track", value: m.projects.filter((p) => p.health === "OFF_TRACK").length, color: "#EF4444" },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
          <Panel title="Member growth" description="Members and invitations sent, last 6 months" icon={Users}>
            <TrendAreaChart data={MEMBER_GROWTH} xKey="month" series={[{ key: "members", label: "Members", color: "#3B82F6" }, { key: "invites", label: "Invites sent", color: "#F59E0B", dashed: true }]} height={210} />
          </Panel>
          <Panel title="Members by role" icon={ShieldAlert} iconTone="violet" action={{ label: "Roles", href: href("roles-permissions") }}>
            <DonutChart data={m.byRole} centerLabel="members" height={190} />
          </Panel>
          <Panel title="GitHub integration" description={`${s.github.account} · webhook success ${s.github.webhookHealth}%`} icon={GitBranch} iconTone="cyan" action={{ label: "Integrations", href: href("integrations") }} className="lg:col-span-2 2xl:col-span-1">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)] mb-3">
              {(["HEALTHY", "SYNCING", "PAUSED", "FAILED"] as const).map((st) => {
                const n = s.repositories.filter((r) => r.status === st).length;
                return n ? <span key={st} title={`${st}: ${n}`} style={{ width: `${(n / s.repositories.length) * 100}%`, backgroundColor: SYNC_COLOR[st] }} /> : null;
              })}
            </div>
            <div className="space-y-0.5">
              {m.failing.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">All repositories syncing.</p>}
              {m.failing.map((r) => (
                <LinkRow key={r.id} href={href(`integrations/${r.id}`)}>
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{r.fullName}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.error}</p></div>
                  <SyncStatusBadge status={r.status} />
                </LinkRow>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
          <Panel title="Top risks" icon={ShieldAlert} iconTone="rose" action={{ label: "All", href: href("health") }}>
            <div className="space-y-0.5">
              {m.risks.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open risks.</p>}
              {m.risks.slice(0, 5).map((r) => (
                <LinkRow key={r.id} href={href(`projects/${r.projectId}`)}>
                  <Avatar person={lk.member(r.ownerId)} size="sm" />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{r.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.project(r.projectId)?.name}</p></div>
                  <SeverityBadge severity={r.severity} />
                </LinkRow>
              ))}
            </div>
          </Panel>
          <Panel title="Teams" icon={UsersRound} iconTone="violet" action={{ label: "All teams", href: href("teams") }}>
            <div className="space-y-0.5">
              {s.teams.map((t) => (
                <LinkRow key={t.id} href={href(`teams/${t.id}`)}>
                  <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{t.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">Lead {lk.member(t.leadId)?.name} · {s.projects.filter((p) => p.teamId === t.id).length} projects</p></div>
                  <AvatarStack people={t.memberIds.map((id) => lk.member(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))} max={3} />
                </LinkRow>
              ))}
            </div>
          </Panel>
          <Panel title="Security & audit" icon={Activity} iconTone="amber" action={{ label: "Audit log", href: href("audit-logs") }} className="lg:col-span-2 2xl:col-span-1">
            <div className="space-y-0.5">
              {s.audit.slice(0, 5).map((e) => (
                <LinkRow key={e.id} href={href(`audit-logs/${e.id}`)}>
                  <Avatar person={lk.member(e.actorId)} size="sm" />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{lk.member(e.actorId)?.name} {e.action}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{e.target} · {timeAgo(e.at)}</p></div>
                  <AuditSeverityBadge severity={e.severity} />
                </LinkRow>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Portfolio at a glance" description="Click a project to open it" icon={FolderKanban} bodyClassName="p-0" action={{ label: "Open portfolio", href: href("projects") }}>
          <DataTable
            rows={m.projects}
            rowHref={(p) => href(`projects/${p.id}`)}
            empty={{ icon: FolderKanban, title: "No projects", description: "Projects created by managers appear here." }}
            columns={[
              { key: "n", header: "Project", className: "w-[46%] md:w-[30%]", render: (p) => <div className="flex items-center gap-2.5 min-w-0"><span className="h-8 w-8 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: p.color }}>{p.code}</span><div className="min-w-0"><p className="font-semibold truncate">{p.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.team(p.teamId)?.name}</p></div></div> },
              { key: "h", header: "Health", hideBelow: "sm", render: (p) => <HealthBadge health={p.health} /> },
              { key: "p", header: "Progress", render: (p) => <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} showLabel /> },
              { key: "m", header: "Manager", hideBelow: "lg", render: (p) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.member(p.managerId)} size="sm" /><span className="truncate">{lk.member(p.managerId)?.name}</span></span> },
              { key: "d", header: "Due", hideBelow: "md", render: (p) => formatDate(p.dueDate, true) },
            ]}
          />
        </Panel>
      </PageFrame>
    </OrgGate>
  );
}
