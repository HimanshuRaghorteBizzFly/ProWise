"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { Users, Clock } from "lucide-react";

export default function ManagerWorkloadPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();

  const members = [
    { name: "Alex Rivera", role: "Developer", team: "Core Clinical Engineering", plannedHours: 36, capacity: 40, activeTasks: 3 },
    { name: "David Kim", role: "Team Lead", team: "Core Clinical Engineering", plannedHours: 32, capacity: 40, activeTasks: 2 },
    { name: "Priya Patel", role: "QA Reviewer", team: "Core Clinical Engineering", plannedHours: 28, capacity: 35, activeTasks: 4 },
  ];

  return (
    <PanelLayout
      title="Team Workload &amp; Capacity"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Workload" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Resource Capacity Ledger</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule: Workload tracks planned vs available working hours. No points-to-hours conversion.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead>Planned Hours</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Active Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m, idx) => {
                const util = Math.round((m.plannedHours / m.capacity) * 100);
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs text-app-text-primary">{m.name}</TableCell>
                    <TableCell className="text-xs text-app-text-secondary">{m.role}</TableCell>
                    <TableCell className="text-xs text-app-text-muted">{m.team}</TableCell>
                    <TableCell className="font-mono text-xs">{m.plannedHours}h</TableCell>
                    <TableCell className="font-mono text-xs">{m.capacity}h</TableCell>
                    <TableCell>
                      <Badge variant={util > 90 ? "warning" : "success"}>{util}%</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{m.activeTasks}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

