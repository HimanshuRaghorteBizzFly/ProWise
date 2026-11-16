"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { HealthBadge } from "@/components/ui/health-badge";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { AlertTriangle, Clock } from "lucide-react";

export default function ManagerDeadlinesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  return (
    <PanelLayout
      title="Deadlines &amp; Schedule Health"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Deadlines & Health" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Delivery Health Register</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Deterministic ranking: Delayed &gt; At Risk &gt; Unknown &gt; On Track.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Computed Health</TableHead>
                <TableHead>Underlying Reasons &amp; Evidence</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Timezone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-xs font-mono text-blue-600">
                    {p.key} - {p.name}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{p.targetDate}</TableCell>
                  <TableCell>
                    <HealthBadge health={p.health} reasons={p.healthReasons} />
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">
                    {p.healthReasons.join(" • ")}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">{p.cadence}</TableCell>
                  <TableCell className="text-xs text-app-text-muted font-mono">{p.timezone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

