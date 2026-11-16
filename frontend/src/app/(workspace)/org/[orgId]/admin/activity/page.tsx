"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { GitCommit, GitPullRequest } from "lucide-react";

export default function AdminActivityPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { gitEvents } = useProjects(orgId);

  return (
    <PanelLayout title="Engineering Activity Feed" breadcrumb={[{ label: "Admin", href: `/org/${orgId}/admin` }, { label: "Activity" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Recent Engineering Activity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Live stream of incoming commits, pull requests, and status changes</p>
        </div>

        <div className="space-y-3">
          {gitEvents.map(evt => (
            <Card key={evt.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 mt-1">
                {evt.type === "PUSH" ? <GitCommit className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold">{evt.title}</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{evt.detail}</p>
                <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
                  {evt.actor} • {evt.repoName} • {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
