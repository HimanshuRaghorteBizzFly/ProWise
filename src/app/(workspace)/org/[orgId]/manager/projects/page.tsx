"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { Sparkles, Plus, Filter } from "lucide-react";

export default function ManagerProjectsListPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  const [modeFilter, setModeFilter] = useState("ALL");

  const filtered = projects.filter((p) => {
    if (modeFilter !== "ALL" && p.mode !== modeFilter) return false;
    return true;
  });

  return (
    <PanelLayout
      title="All Projects"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Projects" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Portfolio Directory</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Comprehensive registry of active, delivered, and planned software initiatives.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="text-xs bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-app-text-primary"
            >
              <option value="ALL">All Modes</option>
              <option value="INDIVIDUAL">Individual Mode</option>
              <option value="STRUCTURED">Structured Mode</option>
            </select>
            <Button size="sm" onClick={() => router.push(`/org/${orgId}/manager/create-project`)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create Project
            </Button>
          </div>
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
                <TableHead>Progress</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{p.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant={p.mode === "INDIVIDUAL" ? "default" : "secondary"}>
                      {p.mode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.lifecycle === "ACTIVE" ? "success" : "outline"}>
                      {p.lifecycle}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <HealthBadge health={p.health} reasons={p.healthReasons} />
                  </TableCell>
                  <TableCell className="font-bold text-xs">
                    {p.lastProgressPercent >= 0 ? `${Math.round(p.lastProgressPercent)}%` : "Not Reported"}
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

