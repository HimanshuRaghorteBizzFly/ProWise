"use client";

import { FolderKanban, FolderPlus, ListTodo, TrendingUp } from "lucide-react";
import { useParams } from "next/navigation";

import {
  ButtonLink,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  ProgressBar,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLiveDashboardData, summarizeProjectManagerDashboard } from "@/lib/live-dashboard-data";

export default function ManagerDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const href = useRoleHref("manager");
  const { status, data, errorMessage, retry } = useLiveDashboardData("manager", orgId);
  const projects = data?.kind === "manager" ? data.projects : [];
  const metrics = summarizeProjectManagerDashboard(projects);

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Dashboard" }]}
      title="Project portfolio"
      description="Live projects, reported progress, and persisted task counts."
      badge="Project Manager"
      status={status}
      errorMessage={errorMessage}
      onRetry={retry}
      actions={<ButtonLink href={href("create-project")}><FolderPlus className="w-3.5 h-3.5" /> Create project</ButtonLink>}
    >
      <KpiGrid>
        <KpiTile
          label="Active projects"
          value={metrics.activeProjects}
          icon={FolderKanban}
          tone="blue"
          chip={{ label: `${metrics.totalProjects} total`, tone: "info" }}
          footer="Portfolio"
          href={href("projects")}
        />
        <KpiTile
          label="Persisted work items"
          value={metrics.tasks}
          icon={ListTodo}
          tone="violet"
          footer="Projects"
          href={href("projects")}
        />
        {metrics.averageReportedProgress !== null && (
          <KpiTile
            label="Reported progress"
            value={`${metrics.averageReportedProgress}%`}
            icon={TrendingUp}
            tone="emerald"
            chip={{ label: `${metrics.projectsReportingProgress} projects`, tone: "success" }}
            footer="Progress records"
            href={href("projects")}
          />
        )}
      </KpiGrid>

      <Panel title="Projects" description="Completion is developer-reported, not inferred from activity or task counts." icon={FolderKanban} action={{ label: "All projects", href: href("projects") }}>
        <div className="space-y-0.5">
          {projects.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No projects are stored for this organization.</p>
          )}
          {projects.map((project) => (
            <LinkRow key={project.id} href={href(`projects/${project.id}`)}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{project.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {project.key} · {project.lifecycle.replace(/_/g, " ")} · {project.task_count} work items
                  {project.team_name ? ` · ${project.team_name}` : ""}
                </p>
              </div>
              {project.progress.percent === null ? (
                <span className="text-[11px] text-[var(--color-text-muted)]">Not reported</span>
              ) : (
                <div className="w-24">
                  <ProgressBar value={project.progress.percent} size="sm" showLabel />
                </div>
              )}
            </LinkRow>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
