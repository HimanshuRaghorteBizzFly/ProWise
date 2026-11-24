"use client";

import React from "react";
import { Clock, FolderKanban, Mail, TrendingUp, Users, UsersRound } from "lucide-react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import {
  KpiGrid,
  KpiTile,
  LinkRow,
  Panel,
  ProgressBar,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import type { LiveDashboardData } from "@/lib/live-dashboard-data";
import { summarizeOrganizationDashboard } from "@/lib/live-dashboard-data";

type OrganizationData = Extract<LiveDashboardData, { kind: "organization" }>;

export function LiveOrganizationDashboard({
  data,
  href,
}: {
  data: OrganizationData;
  href: (path?: string) => string;
}) {
  const metrics = summarizeOrganizationDashboard(data);
  const pendingInvitations = data.invitations.filter((invite) => invite.status === "PENDING");

  return (
    <>
      <KpiGrid>
        <KpiTile
          label="Active members"
          value={metrics.activeMembers}
          icon={Users}
          tone="blue"
          chip={{ label: `${metrics.totalMembers} total`, tone: "info" }}
          footer="Member directory"
          href={href("members")}
        />
        <KpiTile
          label="Active teams"
          value={metrics.activeTeams}
          icon={UsersRound}
          tone="violet"
          chip={{ label: `${data.teams.length} total`, tone: "violet" }}
          footer="Teams"
          href={href("teams")}
        />
        <KpiTile
          label="Active projects"
          value={metrics.activeProjects}
          icon={FolderKanban}
          tone="emerald"
          chip={{ label: `${metrics.totalProjects} total`, tone: "info" }}
          footer="Portfolio"
          href={href("projects")}
        />
        <KpiTile
          label="Pending invitations"
          value={metrics.pendingInvitations}
          icon={Mail}
          tone="amber"
          chip={{ label: "Pending", tone: "warning" }}
          footer="Invitations"
          href={href("invitations")}
        />
        {metrics.averageReportedProgress !== null && (
          <KpiTile
            label="Reported progress"
            value={`${metrics.averageReportedProgress}%`}
            icon={TrendingUp}
            tone="teal"
            chip={{ label: `${metrics.projectsReportingProgress} projects`, tone: "success" }}
            footer="Portfolio"
            href={href("projects")}
          />
        )}
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
        <Panel title="Projects" description="Progress is shown only when reported in project records." icon={FolderKanban} action={{ label: "Portfolio", href: href("projects") }}>
          <div className="space-y-0.5">
            {data.projects.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No projects are stored for this organization.</p>
            )}
            {data.projects.map((project) => (
              <LinkRow key={project.id} href={href(`projects/${project.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{project.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {project.key} · {project.lifecycle.replace(/_/g, " ").toLowerCase()}
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

        <Panel title="Teams" icon={UsersRound} action={{ label: "All teams", href: href("teams") }}>
          <div className="space-y-0.5">
            {data.teams.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No teams are stored for this organization.</p>
            )}
            {data.teams.map((team) => (
              <LinkRow key={team.id} href={href(`teams/${team.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{team.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {team.status.toLowerCase()} · {team.members.length} members
                  </p>
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)]">{team.lead_email ?? "No lead assigned"}</span>
              </LinkRow>
            ))}
          </div>
        </Panel>

        <Panel title="Pending invitations" icon={Mail} iconTone="amber" action={{ label: "Invitations", href: href("invitations") }}>
          <div className="space-y-0.5">
            {pendingInvitations.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No pending invitations.</p>
            )}
            {pendingInvitations.map((invite) => (
              <LinkRow key={invite.id} href={href(`invitations/${invite.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{invite.email}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{invite.role_name}</p>
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Expires {formatDateTime(invite.expires_at)}
                </span>
              </LinkRow>
            ))}
          </div>
        </Panel>

        <Panel title="Coming later" description="These parts have no backend yet, so no numbers are shown." icon={Clock}>
          <ul className="space-y-2 text-xs" data-testid="dashboard-later">
            {LATER_PARTS.map((part) => (
              <li key={part.label} className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">{part.label}</span>
                <OwnerLaterBadge task={part.task} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

/** Owner dashboard parts without a backend yet: labelled, never filled with sample numbers. */
const LATER_PARTS = [
  { label: "Schedule health and risks", task: "5.1" },
  { label: "Reminders, approvals and escalations", task: "5.2" },
  { label: "Portfolio search and My Work", task: "5.3" },
  { label: "Timelines and planned workload", task: "5.4" },
  { label: "Reports and CSV exports", task: "5.5" },
] as const;
