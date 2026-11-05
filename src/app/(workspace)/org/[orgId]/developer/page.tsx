"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  FolderGit2,
  CheckSquare,
  Clock,
  AlertCircle,
  ArrowRight,
  GitPullRequest,
  Send,
  MessageSquare,
  FileCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function DeveloperDashboard() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { projects, workItems, checkIns, gitEvents } = useProjectStore();

  // Developer projects
  const myProjects = projects.filter(
    (p) =>
      p.accountableOwnerId === "usr-developer" ||
      p.memberIds.includes("usr-developer")
  );

  // Developer assigned work items
  const myWorkItems = workItems.filter((w) => w.primaryAssigneeId === "usr-developer");

  return (
    <PanelLayout
      title="Developer Workspace"
      breadcrumb={[{ label: currentOrg.name }, { label: "Alex Rivera (Developer)" }]}
    >
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">
              Welcome back, Alex Rivera
            </h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Active assignments across solo delivery and structured engineering milestones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/org/${orgId}/developer/projects/proj-individual-solo/individual`)}
            >
              <FileCheck className="w-3.5 h-3.5 mr-1 text-blue-600" /> Open Solo Check-in (SOLO-10)
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/org/${orgId}/developer/projects/proj-structured-cds/structured`)}
            >
              <GitPullRequest className="w-3.5 h-3.5 mr-1" /> Open Structured Board (CRM-100)
            </Button>
          </div>
        </div>

        {/* Developer Core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Assigned Projects</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">{myProjects.length}</div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">1 Solo / 1 Structured</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Assigned Tasks</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">{myWorkItems.length}</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">
              {myWorkItems.filter((w) => w.state === "DONE").length} Done / {myWorkItems.filter((w) => w.state === "IN_REVIEW").length} In Review
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Check-ins Due</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">1 Due</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Weekly grace active</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Upcoming Deadlines</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">Nov 15 &amp; 20</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">On track</div>
          </Card>
        </div>

        {/* Dual Mode Switcher Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mode A: Individual Card */}
          <Card className="p-5 border-l-4 border-l-blue-600 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-blue-600 tracking-wide">
                Mode A — Individual Ownership
              </span>
              <Badge variant="default">45% Reported</Badge>
            </div>
            <h3 className="text-base font-bold text-app-text-primary">
              FHIR Patient Intake Service (SOLO-10)
            </h3>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              One accountable developer. Zero mandatory task boards. Progress reported directly via weekly check-in forms.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-app-text-muted">Target: 2026-11-20</span>
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/org/${orgId}/developer/projects/proj-individual-solo/individual`)
                }
              >
                <span>Enter Solo Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>

          {/* Mode B: Structured Card */}
          <Card className="p-5 border-l-4 border-l-indigo-600 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-indigo-600 tracking-wide">
                Mode B — Structured Delivery
              </span>
              <Badge variant="success">50% Calculated</Badge>
            </div>
            <h3 className="text-base font-bold text-app-text-primary">
              Clinical Decision Support API (CRM-100)
            </h3>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              Approved baseline weights (50/100 points). Interactive Kanban board, task details, review submission, and dependency graphs.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-app-text-muted">Target: 2026-12-15</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  router.push(`/org/${orgId}/developer/projects/proj-structured-cds/structured`)
                }
              >
                <span>Enter Structured Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Assigned Tasks Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-app-border">
            <CardTitle className="text-sm">My Active Structured Tasks</CardTitle>
            <CardDescription>
              Tasks directly assigned to Alex Rivera on active engineering projects.
            </CardDescription>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Current Revision</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myWorkItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">
                    {item.key}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-app-text-primary">
                    {item.title}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.state === "DONE"
                          ? "success"
                          : item.state === "IN_REVIEW"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {item.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{item.weight} pts</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">
                    rev {item.currentRevision}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{item.dueDate || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(`/org/${orgId}/developer/projects/proj-structured-cds/structured`)
                      }
                    >
                      View on Board
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

