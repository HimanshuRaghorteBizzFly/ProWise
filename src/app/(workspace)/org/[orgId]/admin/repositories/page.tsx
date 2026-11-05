"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/useProjects";
import { GitBranch, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminRepositoriesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { repositories } = useProjects(orgId);

  return (
    <PanelLayout title="Repositories" breadcrumb={[{ label: "Admin", href: `/org/${orgId}/admin` }, { label: "Repositories" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Engineering Code Repositories</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Connected GitHub repositories and commit stream status</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening GitHub repo picker...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Connect Repository
          </Button>
        </div>

        <div className="space-y-3">
          {repositories.map(repo => (
            <Card key={repo.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-primary-600" />
                <div>
                  <h4 className="text-sm font-semibold">{repo.name}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">Branch: {repo.defaultBranch} • Owner: {repo.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-600">{repo.syncStatus}</Badge>
                <Button size="sm" variant="outline" onClick={() => toast.success(`Triggering manual sync for ${repo.name}...`)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
