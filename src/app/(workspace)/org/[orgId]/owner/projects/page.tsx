"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { HealthBadge } from "@/components/ui/health-badge";
import Link from "next/link";

export default function OwnerProjectsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="Project Portfolio" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Projects" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Organization Projects</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Complete tenant portfolio across Individual and Structured modes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <Card key={p.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary-600">{p.key}</span>
                    <span className="text-xs font-semibold">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.mode} MODE</span>
                </div>
                <HealthBadge health={p.health} />
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border)]">
                <span>Progress: <strong>{p.lastProgressPercent}%</strong></span>
                <span className="text-[var(--color-text-secondary)]">Target: {p.targetDate}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
