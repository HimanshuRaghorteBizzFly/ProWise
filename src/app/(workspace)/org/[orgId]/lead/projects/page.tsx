"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function LeadProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  const teamProjects = projects.filter((p) => p.teamIds.includes("team-eng-core"));

  return (
    <PanelLayout
      title="Team Projects"
      breadcrumb={[
        { label: "Team Lead", href: `/org/${orgId}/lead` },
        { label: "Projects" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Squad Projects</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Initiatives currently mapped to Core Clinical Engineering.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamProjects.map((p) => (
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
                    <HealthBadge health={p.health} reasons={p.healthReasons} />
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{p.targetDate}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          p.mode === "INDIVIDUAL"
                            ? `/org/${orgId}/developer/projects/${p.id}/individual`
                            : `/org/${orgId}/developer/projects/${p.id}/structured`
                        )
                      }
                    >
                      Open
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

