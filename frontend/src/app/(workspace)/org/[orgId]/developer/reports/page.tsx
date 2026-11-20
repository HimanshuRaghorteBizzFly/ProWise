"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  BarChart3,
  Download,
  CheckSquare,
  Clock,
  Bug,
  GitPullRequest,
  TrendingUp,
  FolderGit2,
} from "lucide-react";
import { developerApi, DeveloperReportsSummary } from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperReportsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [summary, setSummary] = useState<DeveloperReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    developerApi.getReportsSummary(orgId).then((data) => {
      if (mounted) {
        if (data) {
          setSummary(data);
        } else {
          // Fallback mock
          setSummary({
            totalAssignedTasks: 14,
            completedTasks: 8,
            inProgressTasks: 4,
            inReviewTasks: 1,
            blockedTasks: 1,
            totalActualHours: 124,
            totalEstimatedHours: 150,
            openBugs: 1,
            resolvedBugs: 4,
            codeReviewsSubmitted: 6,
            codeReviewsCompleted: 9,
            projectContributions: [
              {
                projectId: "proj-individual-solo",
                projectName: "FHIR Patient Intake Service",
                projectCode: "SOLO-10",
                mode: "INDIVIDUAL",
                tasksCount: 4,
                completedTasksCount: 2,
                progressPercent: 45.5,
              },
              {
                projectId: "proj-structured-cds",
                projectName: "Clinical Decision Support API",
                projectCode: "CRM-100",
                mode: "STRUCTURED",
                tasksCount: 10,
                completedTasksCount: 6,
                progressPercent: 50.0,
              },
            ],
          });
        }
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const handleExportCSV = () => {
    if (!summary) return;
    let csv = "Project Code,Project Name,Mode,Total Tasks,Completed Tasks,Progress %\n";
    summary.projectContributions.forEach((p) => {
      csv += `"${p.projectCode}","${p.projectName}","${p.mode}",${p.tasksCount},${p.completedTasksCount},${p.progressPercent}%\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `developer-performance-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Performance report downloaded as CSV");
  };

  return (
    <PanelLayout
      title="My Reports & Analytics"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "My Reports" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Performance &amp; Contribution Report</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Comprehensive velocity metrics, hours logged, defect resolutions, and delivery breakdown.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-blue-600">
            <div className="text-xs text-app-text-muted font-medium">Task Velocity</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">
              {summary?.completedTasks || 0} / {summary?.totalAssignedTasks || 0}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {summary?.totalAssignedTasks
                ? Math.round((summary.completedTasks / summary.totalAssignedTasks) * 100)
                : 0}
              % Completion rate
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-indigo-600">
            <div className="text-xs text-app-text-muted font-medium">Effort Logged</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              {summary?.totalActualHours || 0} hrs
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              vs {summary?.totalEstimatedHours || 0} hrs estimated
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-purple-600">
            <div className="text-xs text-app-text-muted font-medium">Peer Reviews Completed</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {summary?.codeReviewsCompleted || 0}
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-0.5">
              {summary?.codeReviewsSubmitted || 0} PRs submitted
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-600">
            <div className="text-xs text-app-text-muted font-medium">Defects Resolved</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {summary?.resolvedBugs || 0}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              {summary?.openBugs || 0} open bug remaining
            </div>
          </Card>
        </div>

        {/* Project Breakdown Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-app-border">
            <h3 className="font-bold text-sm text-app-text-primary">Project Contribution Breakdown</h3>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Summary of deliverables across individual solo check-in projects and structured team baselines.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Delivery Mode</TableHead>
                <TableHead>Assigned Tasks</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Completion Rate</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.projectContributions.map((p) => {
                const completionRate = p.tasksCount
                  ? Math.round((p.completedTasksCount / p.tasksCount) * 100)
                  : 0;

                return (
                  <TableRow key={p.projectId}>
                    <TableCell className="font-mono font-bold text-xs text-blue-600">
                      {p.projectCode}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-app-text-primary">
                      {p.projectName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.mode === "INDIVIDUAL" ? "default" : "secondary"} className="text-[10px]">
                        {p.mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{p.tasksCount}</TableCell>
                    <TableCell className="text-xs text-emerald-600 font-semibold">
                      {p.completedTasksCount}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{completionRate}%</TableCell>
                    <TableCell className="text-right font-bold text-xs text-app-text-primary">
                      {p.progressPercent}%
                    </TableCell>
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
