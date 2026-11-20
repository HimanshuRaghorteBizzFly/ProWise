import React from "react";
import Link from "next/link";
import { AlertTriangle, CircleCheck, CircleHelp, Clock3, ShieldCheck } from "lucide-react";

import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import {
  DEADLINE_LABELS,
  deadlineStatus,
  formatDateOnly,
  getOwnerName,
  getUserName,
} from "@/components/owner/project-format";
import { HealthBadge } from "@/components/ui/health-badge";
import type { Project, ProjectHealth, User } from "@/types";
import type { PermissionKey } from "@/types/permission";

export interface HealthRisksViewProps {
  projects: Project[];
  users: User[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  basePath?: string;
  now?: string;
}

const KPIS: { health: ProjectHealth; label: string; icon: React.ReactNode }[] = [
  { health: "ON_TRACK", label: "On track", icon: <CircleCheck className="h-5 w-5" /> },
  { health: "AT_RISK", label: "At risk", icon: <AlertTriangle className="h-5 w-5" /> },
  { health: "DELAYED", label: "Delayed", icon: <Clock3 className="h-5 w-5" /> },
  { health: "UNKNOWN", label: "Unknown", icon: <CircleHelp className="h-5 w-5" /> },
];

export function HealthRisksView({ projects, users, source, can, basePath, now }: HealthRisksViewProps) {
  const header = (
    <PageHeader
      title="Health & risks"
      description="Active projects whose health is not On Track, with the reasons recorded and who can act. Health labels here are recorded values, not recalculated."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={<OwnerLaterBadge task="5.1" icon={<ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />} />}
    />
  );

  if (!can("project.read")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="project.read" description="Viewing project health requires project.read." />
      </div>
    );
  }

  const active = projects.filter((project) => !project.archived && project.lifecycle === "ACTIVE");
  const attention = active.filter((project) => project.health !== "ON_TRACK");
  const unreported = projects.filter((project) => !project.archived && project.lastProgressMethod === "NOT_REPORTED");

  return (
    <div className="space-y-4">
      {header}

      <section aria-label="Health of active projects" className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {KPIS.map(({ health, label, icon }) => (
          <OwnerKpiCard
            key={health}
            label={label}
            value={active.filter((project) => project.health === health).length}
            detail="Active projects"
            icon={icon}
          />
        ))}
      </section>

      <p role="note" className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-secondary">
        Explainable health (causes calculated from the working calendar, cadence and dependencies) arrives with task 5.1.
        Until then, reasons are shown exactly as recorded and nothing is inferred from Git activity or elapsed time.
      </p>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <OwnerPanel title="Need attention" description={`${attention.length} active project${attention.length === 1 ? "" : "s"}`}>
          {attention.length === 0 ? (
            <OwnerPageState state="empty" title="No active projects need attention" description="Every active project is recorded as On Track." />
          ) : (
            <ul className="space-y-3">
              {attention.map((project) => {
                const status = deadlineStatus(project, now);
                return (
                  <li key={project.id} className="rounded-lg border border-app-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <HealthBadge health={project.health} showIcon={false} />
                      <span className="text-caption font-semibold text-app-text-secondary">{project.key}</span>
                      {status === "overdue" && <StatusBadge label={DEADLINE_LABELS.overdue} tone="danger" />}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-app-text-primary">
                      {basePath ? <Link href={`${basePath}/projects/${project.id}`} className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{project.name}</Link> : project.name}
                    </h3>
                    {project.healthReasons.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-text-secondary">
                        {project.healthReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-app-text-secondary">No reason recorded.</p>
                    )}
                    {project.temporaryHealthOverride && (
                      <p className="mt-2 text-caption text-app-text-muted">
                        Temporary override recorded: {project.temporaryHealthOverride.reason}
                      </p>
                    )}
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-caption sm:grid-cols-[auto_minmax(0,1fr)]">
                      <dt className="text-app-text-muted">Target date</dt>
                      <dd className="text-app-text-primary">{formatDateOnly(project.targetDate, project.timezone)}</dd>
                      <dt className="text-app-text-muted">Who can resolve</dt>
                      <dd className="text-app-text-primary">
                        <span className="mr-1 rounded border border-app-border px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-text-muted">
                          From the project record
                        </span>
                        {getOwnerName(project, users)} (accountable owner) or {getUserName(project.projectManagerId, users)} (project
                        manager, with project.edit)
                      </dd>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </OwnerPanel>

        <OwnerPanel title="Progress not reported" description="Projects with no recorded progress method.">
          {unreported.length === 0 ? (
            <OwnerPageState state="empty" title="Every project has reported progress" description="No project is missing a progress record." />
          ) : (
            <ul className="space-y-2">
              {unreported.map((project) => (
                <li key={project.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                  <span className="block text-caption font-semibold text-app-text-secondary">{project.key}</span>
                  {basePath ? <Link href={`${basePath}/projects/${project.id}`} className="text-app-text-primary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{project.name}</Link> : <span className="text-app-text-primary">{project.name}</span>}
                  <span className="block text-caption text-app-text-muted">Owner: {getOwnerName(project, users)}</span>
                </li>
              ))}
            </ul>
          )}
        </OwnerPanel>
      </div>
    </div>
  );
}
