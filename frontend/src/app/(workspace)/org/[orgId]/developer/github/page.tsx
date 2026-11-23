"use client";

import React, { useMemo, useState } from "react";
import { GitBranch, Info } from "lucide-react";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminSelect, EmptyStateView, PageFrame, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, dateTimeText } from "@/components/developer/DevUI";
import { useDevGitHub } from "@/components/developer/useDeveloperData";
import { useOrgId } from "@/components/org-console/useRoleApi";
import type { DeveloperGitHubEvent } from "@/lib/developer-api";

function repoOf(e: DeveloperGitHubEvent): string {
  return (e.repositoryName as string) || (e.repository as string) || (e.repo as string) || "Unknown repository";
}

function summaryOf(e: DeveloperGitHubEvent): string {
  return (e.title as string) || (e.payloadSummary as string) || (e.message as string) || "Activity";
}

/** Read-only GitHub evidence feed. Activity never sets progress or task state (rule 9). */
export default function DeveloperGitHubPage() {
  const orgId = useOrgId();
  const home = `/org/${orgId}/developer/dashboard`;
  const activity = useDevGitHub();
  const [repo, setRepo] = useState("ALL");
  const [actor, setActor] = useState("ALL");

  const events = useMemo<DeveloperGitHubEvent[]>(() => (activity.kind === "ready" ? activity.data : []), [activity]);
  const repos = useMemo(() => Array.from(new Set(events.map(repoOf))).sort(), [events]);
  const actors = useMemo(
    () => Array.from(new Set(events.map((e) => (e.actor as string) || "").filter(Boolean))).sort(),
    [events],
  );
  const filtered = events.filter(
    (e) => (repo === "ALL" || repoOf(e) === repo) && (actor === "ALL" || e.actor === actor),
  );

  return (
    <PanelLayout title="GitHub Activity">
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "GitHub Activity" }]}
        title="GitHub Activity"
        description="Commits, pull requests and checks linked to your work."
      >
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-[var(--color-text-secondary)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>GitHub activity is evidence only and never changes progress or task state.</span>
        </div>
        <DevGate state={activity} what="GitHub activity" back={{ href: home, label: "Back to dashboard" }}>
          {() =>
            events.length === 0 ? (
              <EmptyStateView
                icon={GitBranch}
                title="No activity linked yet"
                description="When repositories are connected for your projects, linked commits and pull requests appear here."
              />
            ) : (
              <Panel title="Activity" description={`${filtered.length} of ${events.length} events`} icon={GitBranch}>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <AdminSelect
                    label="Repository"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    options={[{ label: "All repositories", value: "ALL" }, ...repos.map((r) => ({ label: r, value: r }))]}
                  />
                  <AdminSelect
                    label="Author"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                    options={[{ label: "All authors", value: "ALL" }, ...actors.map((a) => ({ label: a, value: a }))]}
                  />
                </div>
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No events match these filters.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {filtered.map((e) => (
                      <li key={e.id} className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusBadge label={(e.eventType as string) || (e.type as string) || "EVENT"} tone="neutral" />
                          <span className="truncate font-semibold text-[var(--color-text-primary)]">{repoOf(e)}</span>
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="truncate text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {summaryOf(e)}
                            </a>
                          ) : (
                            <span className="truncate text-[var(--color-text-secondary)]">{summaryOf(e)}</span>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                          {(e.actor as string) || "Unknown"} · {dateTimeText((e.occurredAt as string) || (e.createdAt as string))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          }
        </DevGate>
      </PageFrame>
    </PanelLayout>
  );
}
