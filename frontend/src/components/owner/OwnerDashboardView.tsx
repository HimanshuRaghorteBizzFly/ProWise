import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  FolderKanban,
  Layers,
  Minus,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { OwnerChartFrame } from "@/components/owner/OwnerChartFrame";
import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import {
  formatLifecycle,
  formatUtcDate,
  getOwnerName,
  getProgressMethodLabel,
  getProgressValue,
} from "@/components/owner/project-format";
import { PERMISSION_KEYS } from "@/lib/permissions";
import type { PermissionGrant, PermissionKey } from "@/types/permission";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Project, ProjectHealth, User } from "@/types";

const HEALTH_SERIES: { health: ProjectHealth; label: string }[] = [
  { health: "ON_TRACK", label: "On Track" },
  { health: "AT_RISK", label: "At Risk" },
  { health: "DELAYED", label: "Delayed" },
  { health: "UNKNOWN", label: "Unknown" },
];

export interface OwnerDashboardViewProps {
  orgId: string;
  orgName: string;
  projects: Project[];
  users: User[];
  canViewProjects: boolean;
  /** Route family base, e.g. /org/{id}/admin. Defaults to the owner family. */
  basePath?: string;
  /** The viewer's effective permissions for the access snapshot. */
  access?: { grants: readonly PermissionGrant[]; scopeReported: boolean };
  /** When the shown data was loaded (UTC ISO). */
  dataAsOf?: string;
}

const ACCESS_HIGHLIGHTS: PermissionKey[] = [
  "org.manage",
  "member.invite",
  "role.manage",
  "project.create",
  "report.export",
  "audit.read",
];

function formatUtcTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function OwnerDashboardView({
  orgId,
  orgName,
  projects,
  users,
  canViewProjects,
  basePath = `/org/${orgId}/owner`,
  access,
  dataAsOf,
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

  const portfolioProjects = projects.filter((project) => !project.archived);
  const activeProjects = portfolioProjects.filter((project) => project.lifecycle === "ACTIVE");
  const attentionProjects = activeProjects.filter((project) => project.health !== "ON_TRACK");
  const unreportedProjects = portfolioProjects.filter(
    (project) => project.lastProgressMethod === "NOT_REPORTED",
  );
  const healthCounts = HEALTH_SERIES.map(({ health, label }) => ({
    label,
    count: activeProjects.filter((project) => project.health === health).length,
  }));
  const healthDescription = healthCounts.map(({ label, count }) => `${label}: ${count}`).join(", ");
  const portfolioHref = `${basePath}/projects`;
  const allowedKeys = access ? PERMISSION_KEYS.filter((key) => access.grants.some((grant) => grant.key === key)) : [];

  return (
    <div className="space-y-4">
      <div
        role="note"
        className="flex flex-col gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 sm:flex-row sm:items-center"
      >
        <Badge variant="outline" className="w-fit">
          Read-only fixture preview
        </Badge>
        <p className="text-sm text-app-text-secondary">
          {orgName} project data is seeded and is not a live organization summary. No dashboard action writes data.
        </p>
        {dataAsOf && (
          <p className="text-caption text-app-text-muted sm:ml-auto sm:whitespace-nowrap">
            Data as of <time dateTime={dataAsOf}>{formatUtcTime(dataAsOf)}</time>
          </p>
        )}
      </div>

      <section aria-label="Portfolio summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OwnerKpiCard
          label="Active projects"
          value={activeProjects.length}
          detail="Active lifecycle · organization-scoped fixture"
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <OwnerKpiCard
          label="Need attention"
          value={attentionProjects.length}
          detail="Distinct active projects with non-On-Track health"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <OwnerKpiCard
          label="Portfolio projects"
          value={portfolioProjects.length}
          detail="Non-archived fixture projects"
          icon={<Layers className="h-5 w-5" />}
        />
        <OwnerKpiCard
          label="Progress not reported"
          value={unreportedProjects.length}
          detail="Projects with no progress method in the fixture"
          icon={<CircleHelp className="h-5 w-5" />}
        />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <OwnerPanel
          title="Projects by health"
          description="Active projects only. Health labels and reasons are fixture values, not recalculated here."
        >
          {activeProjects.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No active projects in this workspace"
              description="There are no active project fixtures to summarize."
            />
          ) : (
            <OwnerChartFrame
              title="Active project health distribution"
              description="Each project is counted once; lifecycle and health remain separate."
            >
              <div
                role="img"
                aria-label={`Active projects by health: ${healthDescription}`}
                className="h-full w-full text-primary-600"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    accessibilityLayer
                    data={healthCounts}
                    margin={{ top: 8, right: 8, bottom: 4, left: -20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="currentColor" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-app-text-secondary" aria-label="Health counts">
                {healthCounts.map(({ label, count }) => (
                  <li key={label}>
                    {label}: <span className="font-semibold tabular-nums text-app-text-primary">{count}</span>
                  </li>
                ))}
              </ul>
            </OwnerChartFrame>
          )}
        </OwnerPanel>

        <OwnerPanel
          title="Portfolio progress"
          description="Individual and Structured progress are shown by method and are not combined into one percentage."
          actions={
            canViewProjects ? (
              <Link
                href={portfolioHref}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary-700 hover:bg-app-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Open portfolio <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : undefined
          }
        >
          {portfolioProjects.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No projects in this workspace"
              description="No project fixtures are available for this organization."
            />
          ) : (
            <OwnerTable label="Portfolio progress by project">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Project</TableHead>
                  <TableHead scope="col">Accountable owner</TableHead>
                  <TableHead scope="col">Lifecycle</TableHead>
                  <TableHead scope="col">Progress</TableHead>
                  <TableHead scope="col">Method</TableHead>
                  <TableHead scope="col">Target date</TableHead>
                  <TableHead scope="col">Evidence updated (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolioProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium text-app-text-primary">{project.name}</div>
                      <div className="text-caption text-app-text-secondary">{project.key}</div>
                    </TableCell>
                    <TableCell>{getOwnerName(project, users)}</TableCell>
                    <TableCell className="capitalize">{formatLifecycle(project.lifecycle)}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{getProgressValue(project)}</TableCell>
                    <TableCell>{getProgressMethodLabel(project)}</TableCell>
                    <TableCell>
                      <time dateTime={project.targetDate}>{project.targetDate}</time>
                    </TableCell>
                    <TableCell>{formatUtcDate(project.lastReportedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </OwnerTable>
          )}
        </OwnerPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <OwnerPanel
          title="Items needing attention"
          description="Active projects with fixture health other than On Track. Reasons are shown as supplied."
          actions={
            canViewProjects ? (
              <Link
                href={portfolioHref}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary-700 hover:bg-app-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Open portfolio <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : undefined
          }
        >
          {attentionProjects.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No active projects need attention"
              description="No active project fixture has a non-On-Track health label."
            />
          ) : (
            <ul className="space-y-3">
              {attentionProjects.map((project) => (
                <li key={project.id} className="rounded-lg border border-app-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <HealthBadge health={project.health} showIcon={false} />
                    <span className="text-caption font-semibold text-app-text-secondary">{project.key}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-app-text-primary">{project.name}</h3>
                  <p className="mt-1 text-sm text-app-text-secondary">
                    Accountable owner: {getOwnerName(project, users)}
                  </p>
                  <p className="mt-1 text-caption text-app-text-secondary">
                    <span className="mr-1 rounded border border-app-border px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-text-muted">
                      From the project record
                    </span>
                    Who can resolve: the accountable owner, or the project manager (
                    {users.find((user) => user.id === project.projectManagerId)?.name ?? "not in fixture"}) with project.edit.
                  </p>
                  {project.healthReasons.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-text-secondary">
                      {project.healthReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-app-text-secondary">No health reason is present in this fixture.</p>
                  )}
                  <p className="mt-2 text-caption text-app-text-muted">
                    Corrective next action is not provided in this fixture.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </OwnerPanel>

        <OwnerPanel
          title="Workload snapshot"
          description="Planned versus available hours by member and week."
        >
          <div className="space-y-2 text-sm text-app-text-secondary">
            <OwnerLaterBadge task="5.4" />
            <p>
              Planned and available hours are unknown, not zero. This fixture has no approved effort estimates or
              member capacity records.
            </p>
          </div>
        </OwnerPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <OwnerPanel
          title="Members and access snapshot"
          description="Membership and pending invitation counts."
        >
          <div className="space-y-2 text-sm text-app-text-secondary">
            <OwnerLaterBadge task="1.2" icon={<UsersRound aria-hidden="true" className="h-3.5 w-3.5" />} />
            <p>
              Counts and access details are withheld until a scoped member-read capability and the membership API are
              available. No invitation or membership actions are available in this preview.
            </p>
          </div>
        </OwnerPanel>

        <OwnerPanel
          title="Recent audit activity"
          description="Restricted organization audit facts."
        >
          <div className="space-y-2 text-sm text-app-text-secondary">
            <OwnerLaterBadge task="1.4" />
            <p>
              Audit records are not shown until the documented <code>audit.read</code> permission is available in the
              frontend and the audit API is built.
            </p>
          </div>
        </OwnerPanel>
      </div>

      {access && (
        <OwnerPanel
          title="Your access"
          description={`${allowedKeys.length} of ${PERMISSION_KEYS.length} documented permissions allowed for your active membership${
            access.scopeReported ? "" : " (scope not reported by API)"
          }.`}
          actions={
            <Link
              href={`${basePath}/access`}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:text-blue-300"
            >
              Open Access Map <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          }
        >
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ACCESS_HIGHLIGHTS.map((key) => {
              const allowed = allowedKeys.includes(key);
              return (
                <li key={key} className="flex items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm">
                  {allowed ? (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Minus aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-muted" />
                  )}
                  <code className="min-w-0 truncate text-caption text-app-text-primary">{key}</code>
                  <span className="ml-auto text-caption text-app-text-muted">{allowed ? "Allowed" : "Denied"}</span>
                </li>
              );
            })}
          </ul>
        </OwnerPanel>
      )}
    </div>
  );
}
