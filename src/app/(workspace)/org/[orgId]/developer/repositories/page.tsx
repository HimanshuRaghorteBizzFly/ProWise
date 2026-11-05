"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { GitBranch } from "lucide-react";

export default function DeveloperRepositoriesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { repositories } = useProjects(orgId);

  return (
    <PanelLayout title="Developer Repositories" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Repositories" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Code Repositories</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Linked git repositories for commit tagging and PR evidence</p>
        </div>
        <div className="space-y-3">
          {repositories.map(r => (
            <Card key={r.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary-600" />
                <span className="font-semibold">{r.name}</span>
                <span className="text-[var(--color-text-muted)] font-mono">({r.defaultBranch})</span>
              </div>
              <span className="text-green-600 font-semibold">{r.syncStatus}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
