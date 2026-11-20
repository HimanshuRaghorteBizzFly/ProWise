"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleHelp,
  FolderKanban,
  GitBranch,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { OwnerChartFrame } from "@/components/owner/OwnerChartFrame";
import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { formatLifecycle, getOwnerName, getProgressMethodLabel, getProgressValue } from "@/components/owner/project-format";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { HealthBadge } from "@/components/ui/health-badge";
import type {
  AuditRecord,
  InvitationRow,
  OrgMember,
  PortfolioData,
  RepositoryRow,
  TeamRow,
} from "@/lib/fixtures/org-admin";
import type { PermissionKey } from "@/types/permission";
import type { Project, ProjectHealth } from "@/types";

const HEALTH: { key: ProjectHealth; label: string; color: string }[] = [
  { key: "ON_TRACK", label: "On track", color: "#10B981" },
  { key: "AT_RISK", label: "At risk", color: "#F59E0B" },
  { key: "DELAYED", label: "Delayed", color: "#EF4444" },
  { key: "UNKNOWN", label: "Unknown", color: "#94A3B8" },
];

const LINK_CLASS =
  "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-700 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:text-blue-300 motion-reduce:transition-none";

export interface OwnerDashboardViewProps extends Partial<PortfolioData> {
  orgId: string;
  orgName: string;
  projects?: Project[];
  canViewProjects: boolean;
  basePath?: string;
  access?: { grants: readonly { key: PermissionKey }[]; scopeReported: boolean };
  dataAsOf?: string;
  members?: OrgMember[];
  invitations?: InvitationRow[];
  teams?: TeamRow[];
  repositories?: RepositoryRow[];
  audit?: AuditRecord[];
  can?: (key: PermissionKey) => boolean;
}

function CompactTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] shadow-xl">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((item, index) => (
        <p key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <strong className="tabular-nums">{item.value}</strong>
        </p>
      ))}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-app-border px-3 py-5 text-center text-sm text-app-text-secondary">{children}</p>;
}

function ProjectLink({ project, users, basePath }: { project: Project; users: PortfolioData["users"]; basePath: string }) {
  return (
    <Link
      href={`${basePath}/projects/${project.id}`}
      className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-app-text-primary group-hover:text-blue-700 dark:group-hover:text-blue-300">
          {project.name}
        </span>
        <span className="mt-1 block truncate text-xs text-app-text-secondary">
          {project.key} · {getOwnerName(project, users)} · {getProgressMethodLabel(project)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <HealthBadge health={project.health} showIcon={false} />
        <ArrowRight className="h-4 w-4 text-app-text-muted" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function OwnerDashboardView({
  orgId,
  orgName,
  projects = [],
  users = [],
  teams = [],
  members = [],
  invitations = [],
  repositories = [],
  audit = [],
  canViewProjects,
  basePath = `/org/${orgId}/owner`,
  access,
  dataAsOf,
  can = () => true,
}: OwnerDashboardViewProps) {
  if (!canViewProjects) {
    return (
      <OwnerPageState
        state="forbidden"
        requiredPermission="project.read"
        description="This dashboard preview only shows project data when project viewing is permitted."
      />
    );
  }

  const portfolio = projects.filter((project) => !project.archived);
  const activeProjects = portfolio.filter((project) => project.lifecycle === "ACTIVE");
  const attention = activeProjects.filter((project) => project.health === "AT_RISK" || project.health === "DELAYED");
  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "PENDING");
  const activeTeams = teams.filter((team) => !team.archived);
  const connectedRepositories = repositories.filter((repository) => repository.syncStatus === "SYNCED");
  const healthCounts = HEALTH.map(({ key, label, color }) => ({
    label,
    count: activeProjects.filter((project) => project.health === key).length,
    color,
  }));
  const portfolioHref = `${basePath}/projects`;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Organization overview"
        description={`A delivery and access snapshot for ${orgName}. Progress is shown by the project’s own reporting method; GitHub activity never determines completion.`}
        simulationLabel="Sample data"
        actions={
          <>
            <Link href={`${basePath}/projects/new`} className={LINK_CLASS}>
              Create project <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
            <Link href={`${basePath}/invitations/new`} className={LINK_CLASS}>
              Invite member <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      <section aria-label="Organization key metrics" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Link href={portfolioHref} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="Active projects"
            value={activeProjects.length}
            detail={`${portfolio.length} in portfolio`}
            icon={<FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
        <Link href={`${basePath}/members`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="Active members"
            value={can("role.manage") ? activeMembers.length : "—"}
            detail={can("role.manage") ? `${members.length} total memberships` : "Access restricted"}
            icon={<Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
        <Link href={`${basePath}/teams`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="Active teams"
            value={can("team.manage") ? activeTeams.length : "—"}
            detail={can("team.manage") ? `${teams.length} teams total` : "Access restricted"}
            icon={<UsersRound className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
        <Link href={`${basePath}/invitations`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="Pending invites"
            value={can("member.invite") ? pendingInvitations.length : "—"}
            detail={can("member.invite") ? "Awaiting acceptance" : "Access restricted"}
            icon={<Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
        <Link href={`${basePath}/health`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="Need attention"
            value={attention.length}
            detail="At-risk or delayed active projects"
            icon={<AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
        <Link href={`${basePath}/integrations`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <OwnerKpiCard
            label="GitHub repositories"
            value={can("repo.read") ? connectedRepositories.length : "—"}
            detail={can("repo.read") ? `${repositories.length} linked repositories` : "Access restricted"}
            icon={<GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          />
        </Link>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <OwnerPanel
          title="Project health"
          description="Health is read from project records and is separate from progress."
          actions={<Link href={`${basePath}/health`} className={LINK_CLASS}>View health <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {activeProjects.length === 0 ? (
            <EmptyHint>No active project health data is available.</EmptyHint>
          ) : (
            <div className="grid min-w-0 grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.8fr)]">
              <OwnerChartFrame title="Active projects by health" description="Counts by current project health.">
                <div role="img" aria-label={healthCounts.map((item) => `${item.label}: ${item.count}`).join(", ")} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={healthCounts} dataKey="count" nameKey="label" innerRadius="54%" outerRadius="82%" paddingAngle={3} stroke="var(--color-surface)" strokeWidth={2}>
                        {healthCounts.map((item) => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                      <Tooltip content={<CompactTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </OwnerChartFrame>
              <ul className="space-y-2" aria-label="Project health legend">
                {healthCounts.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-app-text-secondary">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-app-text-primary">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </OwnerPanel>

        <OwnerPanel
          title="Portfolio overview"
          description="Active project counts by lifecycle. Progress remains attributed to the project’s configured method."
          actions={<Link href={portfolioHref} className={LINK_CLASS}>Open portfolio <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {portfolio.length === 0 ? (
            <EmptyHint>No projects are available in this organization.</EmptyHint>
          ) : (
            <>
              <OwnerChartFrame title="Projects by lifecycle" description={`${portfolio.length} non-archived projects in the portfolio.`}>
                <div role="img" aria-label="Project count by lifecycle" className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED"].map((stage) => ({
                      stage: formatLifecycle(stage as Project["lifecycle"]),
                      projects: portfolio.filter((project) => project.lifecycle === stage).length,
                    }))} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CompactTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                      <Bar dataKey="projects" name="Projects" fill="#3B82F6" radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </OwnerChartFrame>
              <p className="mt-2 text-xs text-app-text-muted">
                Data as of {dataAsOf ? new Date(dataAsOf).toLocaleString() : "the current sample"}.
              </p>
            </>
          )}
        </OwnerPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <OwnerPanel
          title="Projects requiring attention"
          description="Prioritize recorded risk before reviewing delivery progress."
          actions={<Link href={`${basePath}/health`} className={LINK_CLASS}>Review risks <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {attention.length === 0 ? (
            <EmptyHint>No active project is currently marked at risk or delayed.</EmptyHint>
          ) : (
            <ul className="space-y-2">
              {attention.slice(0, 4).map((project) => (
                <li key={project.id}>
                  <ProjectLink project={project} users={users} basePath={basePath} />
                  {project.healthReasons[0] && <p className="mt-1 px-3 text-xs text-app-text-secondary">{project.healthReasons[0]}</p>}
                  <p className="mt-1 px-3 text-xs text-app-text-muted">
  <span className="mr-1 rounded border border-app-border px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-text-muted">
    From the project record
  </span>
  Who can resolve: {getOwnerName(project, users)} or the project manager (
  {users.find((user) => user.id === project.projectManagerId)?.name ?? "not reported"}).
</p>
                </li>
              ))}
            </ul>
          )}
        </OwnerPanel>

        <OwnerPanel
          title="Portfolio progress"
          description="Individual and Structured values are presented using their own progress methods."
          actions={<Link href={portfolioHref} className={LINK_CLASS}>All projects <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {portfolio.length === 0 ? (
            <EmptyHint>No project progress to display.</EmptyHint>
          ) : (
            <ul className="space-y-2">
              {portfolio.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <Link href={`${basePath}/projects/${project.id}`} className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2.5 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-app-text-primary">{project.name}</span>
                      <span className="block truncate text-xs text-app-text-secondary">{formatLifecycle(project.lifecycle)} · {getProgressMethodLabel(project)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">{getProgressValue(project)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OwnerPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <OwnerPanel
          title="People & teams"
          description="Organization membership and active team overview."
          actions={<Link href={`${basePath}/members`} className={LINK_CLASS}>Directory <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {!can("role.manage") ? <EmptyHint>Membership details are not available to this access level.</EmptyHint> : members.length === 0 ? (
            <EmptyHint>No members are listed yet.</EmptyHint>
          ) : (
            <ul className="space-y-2">
              {members.slice(0, 4).map((member) => (
                <li key={member.id}>
                  <Link href={`${basePath}/members/${member.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-app-border px-3 py-2 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-app-text-primary">{member.displayName}</span>
                      <span className="block truncate text-xs text-app-text-secondary">{member.roleLabel ?? member.email}</span>
                    </span>
                    <StatusBadge label={member.status.toLowerCase()} tone={member.status === "ACTIVE" ? "success" : "warning"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {can("team.manage") && (
            <div className="mt-4 border-t border-app-border pt-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted"><UsersRound className="h-3.5 w-3.5" aria-hidden="true" /> Teams</h3>
              {!activeTeams.length ? <EmptyHint>No active teams found.</EmptyHint> : (
                <ul className="space-y-1">
                  {activeTeams.slice(0, 3).map((team) => (
                    <li key={team.id}>
                      <Link href={`${basePath}/teams/${team.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-app-text-primary hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">
                        <span className="truncate">{team.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-app-text-muted">{team.memberNames.length} members</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </OwnerPanel>

        <OwnerPanel
          title="Invitations & integrations"
          description="Outstanding invitations and GitHub connection health."
          actions={<Link href={`${basePath}/invitations`} className={LINK_CLASS}>Invitations <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted"><Mail className="h-3.5 w-3.5" aria-hidden="true" /> Pending invitations</h3>
              {!can("member.invite") ? <EmptyHint>Invitation details are not available.</EmptyHint> : pendingInvitations.length === 0 ? <EmptyHint>No pending invitations.</EmptyHint> : (
                <ul className="space-y-2">
                  {pendingInvitations.slice(0, 3).map((invitation) => (
                    <li key={invitation.id} className="min-w-0">
                      <Link href={`${basePath}/invitations/${invitation.id}`} className="block rounded-lg border border-app-border px-3 py-2 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">
                      <p className="truncate text-sm font-medium text-app-text-primary">{invitation.email}</p>
                      <p className="mt-1 text-xs text-app-text-secondary">{invitation.roleLabel} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-app-border pt-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted"><GitBranch className="h-3.5 w-3.5" aria-hidden="true" /> GitHub</h3>
              {!can("repo.read") ? <EmptyHint>Integration details are not available.</EmptyHint> : repositories.length === 0 ? <EmptyHint>No repositories connected.</EmptyHint> : (
                <ul className="space-y-2">
                  {repositories.slice(0, 3).map((repository) => (
                    <li key={repository.id} className="min-w-0">
                      <Link href={`${basePath}/integrations/${repository.id}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">
                      <span className="truncate text-sm text-app-text-primary">{repository.fullName}</span>
                      <StatusBadge label={repository.syncStatus.toLowerCase()} tone={repository.syncStatus === "SYNCED" ? "success" : repository.syncStatus === "FAILED" ? "danger" : "warning"} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </OwnerPanel>

        <OwnerPanel
          title="Security & audit"
          description="Recent organization audit records, not GitHub activity."
          actions={<Link href={`${basePath}/audit-logs`} className={LINK_CLASS}>Audit log <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          {!can("audit.read") ? <EmptyHint>Audit records are not available to this access level.</EmptyHint> : audit.length === 0 ? (
            <EmptyHint>No audit events are recorded.</EmptyHint>
          ) : (
            <ul className="space-y-3">
              {audit.slice(0, 4).map((entry) => (
                <li key={entry.id} className="min-w-0 border-b border-app-border pb-3 last:border-0 last:pb-0">
                  <Link href={`${basePath}/audit-logs/${entry.id}`} className="flex min-w-0 gap-3 rounded-lg p-1 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300"><Activity className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-app-text-primary">{entry.action}</span>
                    <span className="mt-0.5 block text-xs text-app-text-secondary">{entry.actorEmail} · {entry.targetType}</span>
                    <time className="mt-1 block text-[11px] text-app-text-muted" dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString()}</time>
                  </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`${basePath}/roles-permissions`} className={`${LINK_CLASS} mt-3`}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Roles & access
          </Link>
        </OwnerPanel>
      </div>

      {access && (
        <OwnerPanel
          title="Your access"
          description={`${access.grants.length} of ${PERMISSION_KEYS.length} permissions are effective for your active organization membership${access.scopeReported ? "" : " (scope not reported by the API)"}.`}
          actions={<Link href={`${basePath}/access`} className={LINK_CLASS}>Open access map <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        >
          <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {PERMISSION_KEYS.slice(0, 6).map((key) => (
              <li key={key} className="flex min-w-0 items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <code className="truncate text-app-text-primary">{key}</code>
              </li>
            ))}
          </ul>
        </OwnerPanel>
      )}

      <div className="flex items-center gap-2 text-xs text-app-text-muted">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Dashboard uses organization-scoped sample data through the existing fixture adapters.
        {!portfolio.length && <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      </div>
    </div>
  );
}
