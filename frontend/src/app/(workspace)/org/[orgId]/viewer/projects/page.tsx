"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/ui/health-badge";
import { ProgressBar } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function ViewerProjectsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  return (
    <PanelLayout
      title="Stakeholder Project Portfolio"
      breadcrumb={[
        { label: "Viewer", href: `/org/${orgId}/viewer` },
        { label: "Projects" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Portfolio Registry (Read-Only)</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Overview of ongoing and delivered engineering investments.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Delivered Work</TableHead>
                <TableHead>Health Status</TableHead>
                <TableHead>Target Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{p.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.lifecycle === "ACTIVE" ? "success" : "outline"}>
                      {p.lifecycle}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-28">
                      <ProgressBar value={p.lastProgressPercent} size="sm" showLabel />
                    </div>
                  </TableCell>
                  <TableCell>
                    <HealthBadge health={p.health} reasons={p.healthReasons} />
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{p.targetDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

