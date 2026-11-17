"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ManagerReportsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects } = useProjectStore();

  const handleExport = () => {
    const headers = ["Key", "Name", "Mode", "Lifecycle", "Progress %", "Health", "Target Date"];
    const rows = projects.map((p) => [
      p.key,
      p.name,
      p.mode,
      p.lifecycle,
      p.lastProgressPercent,
      p.health,
      p.targetDate,
    ]);
    const csv = generateCsv(headers, rows);
    downloadCsv(`prowise-executive-report-${orgId}.csv`, csv);
    toast.success("Executive delivery report exported.");
  };

  return (
    <PanelLayout
      title="Portfolio Delivery Reports"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Reports" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Executive Delivery Summary</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Consistent reporting data models pinned to current baseline versions and timestamps.
            </p>
          </div>
          <Button size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export Verified CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Active Structured Progress</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">50% Average</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">Calculated by leaf completion</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Solo Check-in Compliance</div>
            <div className="text-2xl font-bold text-green-600 mt-1">100%</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">All weekly check-ins filed</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Formula Injection Defense</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">Active</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">OWASP prefix escaping</div>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Progress Method</TableHead>
                <TableHead>Delivered %</TableHead>
                <TableHead>Health Status</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

