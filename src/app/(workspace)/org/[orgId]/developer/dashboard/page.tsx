"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, CheckSquare, FolderGit2, GitPullRequest, MessageSquareWarning } from "lucide-react";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { EmptyStateView, KpiGrid, KpiTile, PageFrame, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DecisionBadge, DevGate, SectionGate, WorkStateBadge, dateText, dateTimeText, isOverdue } from "@/components/developer/DevUI";
import { useDevDashboard, useDevProjects, useMyBlockers, useMyFeedback, useMyWorkItems } from "@/components/developer/useDeveloperData";

/** Developer dashboard: the caller's own work, blockers, review feedback and deadlines, all from the API. */
export default function DeveloperDashboardPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const dashboard = useDevDashboard();
  const work = useMyWorkItems();
  const blockers = useMyBlockers();
  const feedback = useMyFeedback();
  const projects = useDevProjects();

  return (
    <PanelLayout title="Developer Dashboard">
      <PageFrame
        crumbs={[{ label: "Developer", href: base }, { label: "Dashboard" }]}
        title="Dashboard"
        description="Your assigned work, open blockers, review feedback and deadlines. GitHub activity is shown as evidence only."
      >
        <DevGate state={dashboard} what="Your dashboard" back={{ href: base, label: "Back" }} skeleton="dashboard">
          {(d) => (
            <KpiGrid>
              <KpiTile label="My projects" value={d.assignedProjectsCount} icon={FolderGit2} tone="blue"
                footer={`${d.activeProjectsCount} active`} href={`${base}/projects`} />
              <KpiTile label="Assigned tasks" value={d.assignedTasksCount} icon={CheckSquare} tone="violet"
                footer={`${d.pendingTasksCount} open · ${d.completedTasksCount} done`} href={`${base}/tasks`} />
              <KpiTile label="Overdue" value={d.overdueTasksCount} icon={CalendarClock} tone={d.overdueTasksCount > 0 ? "rose" : "emerald"}
                footer="Past their due date" href={`${base}/calendar`} />
              <KpiTile label="Unread notifications" value={d.unreadNotificationsCount} icon={Bell} tone="amber"
                footer={`${d.openBugsCount} open issues · ${d.pendingReviewsCount} reviews`} href={`${base}/notifications`} />
            </KpiGrid>
          )}
        </DevGate>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Work in progress" description="Started or waiting for review" icon={CheckSquare} iconTone="violet"
            action={{ label: "My tasks", href: `${base}/tasks` }}>
            <SectionGate state={work} what="your work">
              {(items) => {
                const active = items.filter((w) => w.state === "IN_PROGRESS" || w.state === "IN_REVIEW" || w.state === "TODO").slice(0, 6);
                if (active.length === 0) {
                  return <EmptyStateView icon={CheckCircle2} title="Nothing open" description="No structured work is assigned to you right now." />;
                }
                return (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {active.map((w) => (
                      <li key={w.id}>
                        <Link href={`${base}/tasks/${w.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                          <span className="min-w-0">
                            <span className="block text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{w.key}</span>
                            <span className="block text-xs font-medium truncate">{w.title}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1 shrink-0">
                            <WorkStateBadge state={w.state} blocked={w.blocked} />
                            {w.due_on && (
                              <span className={`text-[11px] ${isOverdue(w.due_on, w.state) ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-[var(--color-text-muted)]"}`}>
                                Due {dateText(w.due_on)}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </SectionGate>
          </Panel>

          <Panel title="Review feedback" description="Latest decisions on your submissions" icon={MessageSquareWarning} iconTone="amber"
            action={{ label: "Reviews", href: `${base}/reviews` }}>
            <SectionGate state={feedback} what="review feedback">
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyStateView icon={GitPullRequest} title="No reviews yet" description="Decisions on your submitted work appear here." />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {rows.slice(0, 5).map((f) => (
                      <li key={f.id}>
                        <Link href={`${base}/tasks/${f.work_item_id}`} className="block py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium truncate"><span className="font-mono text-blue-600 dark:text-blue-400">{f.key}</span> {f.title}</span>
                            <DecisionBadge decision={f.decision} />
                          </span>
                          {f.reason && <span className="block text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{f.reason}</span>}
                          <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            Revision {f.revision} · {f.reviewer_email ?? "Reviewer"} · {dateTimeText(f.decided_at)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            </SectionGate>
          </Panel>

          <Panel title="Open blockers" description="On your work or owned by you" icon={AlertTriangle} iconTone="rose"
            action={{ label: "Blockers & issues", href: `${base}/blockers` }}>
            <SectionGate state={blockers} what="blockers">
              {(rows) => {
                const open = rows.filter((b) => !b.resolved);
                if (open.length === 0) {
                  return <EmptyStateView icon={CheckCircle2} title="No open blockers" description="Raise a blocker from a task when something stops the work." />;
                }
                return (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {open.slice(0, 5).map((b) => (
                      <li key={b.id} className="py-2.5">
                        <Link href={`${base}/tasks/${b.work_item_id}`} className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">{b.work_item_key}</span>
                            <span className="block text-xs truncate">{b.reason}</span>
                          </span>
                          <StatusBadge label={b.severity === "CRITICAL" ? "Critical" : "Normal"} tone={b.severity === "CRITICAL" ? "danger" : "warning"} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </SectionGate>
          </Panel>

          <Panel title="My projects" description="Individual and Structured" icon={FolderGit2} iconTone="blue"
            action={{ label: "All projects", href: `${base}/projects` }}>
            <SectionGate state={projects} what="your projects">
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyStateView icon={FolderGit2} title="No projects" description="You are not a member of any project in this organization yet." />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {rows.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <Link href={`${base}/projects/${p.id}/${p.mode === "STRUCTURED" ? "structured" : "individual"}`}
                          className="flex items-center justify-between gap-2 py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                          <span className="min-w-0">
                            <span className="block text-xs font-medium truncate">{p.name}</span>
                            <span className="block text-[11px] text-[var(--color-text-muted)] font-mono">{p.code}</span>
                          </span>
                          <StatusBadge label={p.mode === "STRUCTURED" ? "Structured" : "Individual"} tone={p.mode === "STRUCTURED" ? "violet" : "info"} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            </SectionGate>
          </Panel>
        </div>
      </PageFrame>
    </PanelLayout>
  );
}
