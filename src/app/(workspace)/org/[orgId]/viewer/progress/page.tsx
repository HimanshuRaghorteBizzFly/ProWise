"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function ViewerProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  return (
    <PanelLayout
      title="Delivery Progress Summaries"
      breadcrumb={[
        { label: "Viewer", href: `/org/${orgId}/viewer` },
        { label: "Progress" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Progress Summaries (Read-Only)</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule: Solo estimates and accepted team work are reported distinctly and never blended into a misleading average.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-app-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-blue-600">{p.key}</span>
                    <h3 className="font-bold text-sm text-app-text-primary">{p.name}</h3>
                  </div>
                  <span className="text-[11px] text-app-text-muted mt-0.5 block">
                    Mode: {p.mode} • Target: {p.targetDate}
                  </span>
                </div>
                <Badge variant={p.mode === "INDIVIDUAL" ? "default" : "secondary"}>
                  {p.lastProgressMethod.replace("_", " ")}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-app-text-secondary">Delivered Progress</span>
                  <span className="font-bold text-sm text-app-text-primary">
                    {p.lastProgressPercent >= 0 ? `${p.lastProgressPercent}%` : "Not Reported"}
                  </span>
                </div>
                <ProgressBar
                  value={p.lastProgressPercent}
                  size="md"
                  isNotReported={p.lastProgressPercent < 0}
                />
              </div>

              <p className="text-xs text-app-text-secondary">{p.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

