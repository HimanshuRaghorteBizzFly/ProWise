"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { HealthBadge } from "@/components/ui/health-badge";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

export default function DeveloperProjectsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="My Assigned Projects" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Projects" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Projects</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Navigate to Individual Check-In mode or Structured Work-Item mode</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => {
            const modePath = p.mode === "INDIVIDUAL"
              ? `/org/${orgId}/developer/projects/${p.id}/individual`
              : `/org/${orgId}/developer/projects/${p.id}/structured`;

            return (
              <Card key={p.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-600">{p.key}</span>
                      <h4 className="font-semibold text-sm">{p.name}</h4>
                    </div>
                    <span className="text-[10px] rounded bg-[var(--color-sidebar)] px-1.5 py-0.5 font-mono text-[var(--color-text-muted)]">
                      {p.mode} MODE
                    </span>
                  </div>
                  <HealthBadge health={p.health} />
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border)]">
                  <span>Progress: <strong>{p.lastProgressPercent}%</strong></span>
                  <Link href={modePath} className="inline-flex items-center gap-1 text-primary-600 hover:underline font-medium">
                    Open {p.mode === "INDIVIDUAL" ? "Check-Ins" : "Task Board"} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
