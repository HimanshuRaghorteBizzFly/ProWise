"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { Clock, TrendingUp } from "lucide-react";

export default function ManagerProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { snapshots, projects } = useProjectStore();

  return (
    <PanelLayout
      title="Progress Snapshots Ledger"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Progress History" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Historical Progress Series</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule M06: Old snapshots retain value, timestamp, method, and original scope version. No retroactive rewriting.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Recorded Progress</TableHead>
                <TableHead>Calculation Method</TableHead>
                <TableHead>Baseline Weights</TableHead>
                <TableHead>Triggering Cause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snap) => {
                const proj = projects.find((p) => p.id === snap.projectId);
                return (
                  <TableRow key={snap.id}>
                    <TableCell className="text-xs text-app-text-muted whitespace-nowrap">
                      {new Date(snap.instant).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-blue-600">
                      {proj ? `${proj.key} - ${proj.name}` : snap.projectId}
                    </TableCell>
                    <TableCell className="font-bold text-sm text-app-text-primary">
                      {snap.value >= 0 ? `${snap.value}%` : "Not Reported"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{snap.method.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-secondary font-mono">
                      {snap.denominator !== undefined
                        ? `${snap.numerator} / ${snap.denominator} pts`
                        : "Solo Check-In"}
                    </TableCell>
                    <TableCell className="text-xs text-app-text-primary">{snap.cause}</TableCell>
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

