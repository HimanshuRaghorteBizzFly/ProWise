"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { Lock } from "lucide-react";

export default function ViewerReportsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  return (
    <PanelLayout
      title="Authorized Stakeholder Reports"
      breadcrumb={[
        { label: "Viewer", href: `/org/${orgId}/viewer` },
        { label: "Reports" },
      ]}
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-xl bg-app-surface border border-app-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-app-text-secondary">
            <Lock className="w-4 h-4 text-app-text-muted" />
            <span>
              <strong>Export Permission Boundary:</strong> Blueprint V1.1 Rule FR-043: On-screen reading does not grant export privilege. File downloads require the separate <code>report.export</code> grant.
            </span>
          </div>
          <Badge variant="outline">On-Screen Only</Badge>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Initiative</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Progress Method</TableHead>
                <TableHead>Progress %</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Approved Target</TableHead>
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
                  <TableCell className="text-xs text-app-text-secondary">
                    {p.lastProgressMethod.replace("_", " ")}
                  </TableCell>
                  <TableCell className="font-bold text-xs">
                    {p.lastProgressPercent >= 0 ? `${p.lastProgressPercent}%` : "Not Reported"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.health === "ON_TRACK"
                          ? "success"
                          : p.health === "DELAYED"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {p.health}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">{p.targetDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

