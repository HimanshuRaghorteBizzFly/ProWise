"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ClipboardCheck, FolderKanban, UserRound } from "lucide-react";

import {
  ButtonLink,
  EmptyStateView,
  ErrorBanner,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  PageSkeleton,
  Panel,
  ProgressBar,
} from "@/components/delivery/DeliveryUI";
import { usePortfolio } from "@/components/projects/useProjectApi";
import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { useAuthStore } from "@/store/auth-store";
import type { ProjectDto } from "@/types/api";

/**
 * Developer and Viewer dashboards on real data only: the projects the server lets this membership read (task 2.1
 * read rule, scoped to the active organization from the token and path). No sample names or numbers.
 */

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

function ProjectRows({ projects, href }: { projects: ProjectDto[]; href: (project: ProjectDto) => string }) {
  return (
    <div className="space-y-0.5">
      {projects.map((project) => (
        <LinkRow key={project.id} href={href(project)}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{project.key} · {project.name}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              {project.mode === "INDIVIDUAL" ? "Individual" : "Structured"} · {project.lifecycle.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
          {project.progress.percent === null ? (
            <span className="text-[11px] text-[var(--color-text-muted)]">Not reported</span>
          ) : (
            <div className="w-24"><ProgressBar value={project.progress.percent} size="sm" showLabel /></div>
          )}
        </LinkRow>
      ))}
    </div>
  );
}

export function DeveloperDashboardContent({ projects, email, base }: { projects: ProjectDto[]; email: string; base: string }) {
  const mine = projects.filter((project) => project.mode === "INDIVIDUAL"
    && project.accountable?.email?.toLowerCase() === email.toLowerCase());
  return (
    <>
      <KpiGrid>
        <KpiTile label="Projects you can open" value={projects.length} icon={FolderKanban} tone="blue" footer="Assigned to you" href={`${base}/dashboard`} />
        <KpiTile label="You report progress for" value={mine.length} icon={UserRound} tone="emerald" footer="Individual projects" href={`${base}/checkins`} />
      </KpiGrid>
      <Panel title="Your projects" icon={FolderKanban}
        description="Individual projects take your check-ins. Structured work (tasks, reviews) comes with tasks 3.1 to 3.5.">
        {projects.length === 0 ? (
          <EmptyStateView icon={FolderKanban} title="No projects yet"
            description="You are not assigned to a project in this workspace yet. Your project manager adds you." />
        ) : (
          <ProjectRows projects={projects} href={(project) => project.mode === "INDIVIDUAL"
            ? `${base}/projects/${encodeURIComponent(project.id)}/individual/check-ins`
            : `${base}/projects/${encodeURIComponent(project.id)}/individual`} />
        )}
      </Panel>
      {mine.length > 0 && (
        <div><ButtonLink href={`${base}/checkins`}><ClipboardCheck className="w-3.5 h-3.5" /> Submit a check-in</ButtonLink></div>
      )}
      <Panel title="Coming later" icon={ClipboardCheck}>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between gap-2"><span>My tasks and sprints</span><OwnerLaterBadge task="3.1" /></li>
          <li className="flex items-center justify-between gap-2"><span>Code reviews and feedback</span><OwnerLaterBadge task="3.3" /></li>
          <li className="flex items-center justify-between gap-2"><span>Repositories and GitHub activity</span><OwnerLaterBadge task="4.1" /></li>
          <li className="flex items-center justify-between gap-2"><span>Deadlines and reminders</span><OwnerLaterBadge task="5.2" /></li>
        </ul>
      </Panel>
    </>
  );
}

export function ViewerDashboardContent({ projects, base }: { projects: ProjectDto[]; base: string }) {
  return (
    <>
      <KpiGrid>
        <KpiTile label="Projects you can view" value={projects.length} icon={FolderKanban} tone="blue" footer="Read-only" href={`${base}/dashboard`} />
      </KpiGrid>
      <Panel title="Projects" icon={FolderKanban} description="Read-only. Progress shows only what was reported and approved.">
        {projects.length === 0 ? (
          <EmptyStateView icon={FolderKanban} title="No projects shared with you"
            description="Nothing has been shared with you in this workspace yet." />
        ) : (
          <ProjectRows projects={projects} href={() => `${base}/dashboard`} />
        )}
      </Panel>
      <Panel title="Coming later" icon={FolderKanban}>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between gap-2"><span>Schedule health</span><OwnerLaterBadge task="5.1" /></li>
          <li className="flex items-center justify-between gap-2"><span>Timelines and milestones</span><OwnerLaterBadge task="5.4" /></li>
          <li className="flex items-center justify-between gap-2"><span>Reports</span><OwnerLaterBadge task="5.5" /></li>
        </ul>
      </Panel>
    </>
  );
}

function usePermittedProjects() {
  const orgId = useOrgId();
  return { orgId, portfolio: usePortfolio(orgId, {}) };
}

export function LiveDeveloperDashboard() {
  const { orgId, portfolio } = usePermittedProjects();
  const email = useAuthStore((state) => state.currentUser.email);
  const orgName = useAuthStore((state) => (state.currentOrg.id === orgId ? state.currentOrg.name : ""));
  const base = `/org/${orgId}/developer`;
  return (
    <PageFrame crumbs={[{ label: "Developer" }, { label: "Dashboard" }]} title={orgName || "My work"}
      description="Your projects and check-ins in this workspace.">
      {portfolio.state.kind === "loading" ? <PageSkeleton variant="list" />
        : portfolio.state.kind !== "ready" ? <ErrorBanner message="Your projects could not be loaded."
          onRetry={portfolio.state.kind === "error" ? portfolio.state.retry : undefined} />
          : <DeveloperDashboardContent projects={portfolio.state.data} email={email} base={base} />}
    </PageFrame>
  );
}

export function LiveViewerDashboard() {
  const { orgId, portfolio } = usePermittedProjects();
  const orgName = useAuthStore((state) => (state.currentOrg.id === orgId ? state.currentOrg.name : ""));
  const base = `/org/${orgId}/viewer`;
  return (
    <PageFrame crumbs={[{ label: "Viewer" }, { label: "Dashboard" }]} title={orgName || "Overview"}
      description="Read-only view of the projects shared with you.">
      {portfolio.state.kind === "loading" ? <PageSkeleton variant="list" />
        : portfolio.state.kind !== "ready" ? <ErrorBanner message="Projects could not be loaded."
          onRetry={portfolio.state.kind === "error" ? portfolio.state.retry : undefined} />
          : <ViewerDashboardContent projects={portfolio.state.data} base={base} />}
    </PageFrame>
  );
}
