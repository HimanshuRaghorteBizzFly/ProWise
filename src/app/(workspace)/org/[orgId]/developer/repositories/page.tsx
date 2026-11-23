"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/useProjects";
import { GitBranch, Plus, Settings, RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function DeveloperRepositoriesPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { repositories, syncRepository } = useProjects(orgId);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = async (id: string, name: string) => {
    setSyncingId(id);
    await new Promise((r) => setTimeout(r, 600));
    syncRepository(id);
    setSyncingId(null);
    toast.success(`Synchronized ${name}`);
  };

  return (
    <PanelLayout
      title="Developer Repositories"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Repositories" }]}
    >
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-4">
          <div>
            <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Connected Source Repositories</h1>
            <p className="text-xs text-app-text-secondary mt-1">
              Git repositories linked to your developer profile for commit tagging, pull request tracking, and delivery evidence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/org/${orgId}/developer/settings`)}
              className="gap-1.5 text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure in Settings</span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/org/${orgId}/developer/settings`)}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Repository</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {repositories.map((r) => {
            const isSyncing = syncingId === r.id;
            return (
              <Card
                key={r.id}
                className="p-4 border border-app-border bg-app-surface hover:border-blue-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-app-text-primary truncate">{r.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {r.defaultBranch}
                      </Badge>
                      <Badge variant="success" className="text-[10px]">
                        {r.syncStatus || "SYNCED"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-app-text-muted mt-1">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> CI Passing
                      </span>
                      <span>&bull;</span>
                      <span>Auto-sync active</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSyncing}
                    onClick={() => handleSync(r.id, r.name)}
                    className="h-8 px-2.5 text-xs gap-1 hover:text-blue-600"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Sync"}</span>
                  </Button>

                  <a
                    href={`https://github.com/${r.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-app-border bg-app-surface text-xs text-app-text-primary hover:bg-app-hover transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-app-text-muted" />
                    <span>View GitHub</span>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
