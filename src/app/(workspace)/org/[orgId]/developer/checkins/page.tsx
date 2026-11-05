"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { FileCheck, Plus } from "lucide-react";

export default function DeveloperCheckInsDuePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { checkIns, projects } = useProjectStore();

  const soloProjects = projects.filter((p) => p.mode === "INDIVIDUAL");

  return (
    <PanelLayout
      title="Check-ins Due &amp; Reporting Cadence"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: "Check-ins Due" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Solo Ownership Cadence</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Default reporting cadence: Weekly, with one working day of grace.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Key</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Grace Period</TableHead>
                <TableHead>Last Reported</TableHead>
                <TableHead>Latest Percentage</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {soloProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{p.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{p.name}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{p.cadence}</TableCell>
                  <TableCell className="text-xs text-app-text-muted">{p.graceWorkingDays} working day</TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {p.lastReportedAt ? new Date(p.lastReportedAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="font-bold text-xs">
                    {p.lastProgressPercent >= 0 ? `${p.lastProgressPercent}%` : "Not Reported"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(`/org/${orgId}/developer/projects/${p.id}/individual`)
                      }
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Submit Check-In
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

