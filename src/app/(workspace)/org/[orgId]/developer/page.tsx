"use client";

import React, { useEffect, useState } from "react";
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
  AlertTriangle,
  ArrowRight,
  GitPullRequest,
  CheckCircle2,
  GitBranch,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  Bug,
  Eye,
  FileCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { useDeliveryStore } from "@/store/delivery-store";
import { developerApi, DeveloperDashboardSummary } from "@/lib/developer-api";

export default function DeveloperDashboard() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { projects, workItems, gitEvents } = useProjectStore();
  const deliveryProjects = useDeliveryStore((s) => s.projects);

  const [apiData, setApiData] = useState<DeveloperDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    developerApi.getDashboard(orgId).then((data) => {
      if (mounted) {
        if (data) setApiData(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  // Active developer assignment matching (Alex Rivera / database developer / mock developer persona)
  const devIds = new Set(["p-alex", "usr-developer", "00000000-0000-0000-0000-000000000003", "alex.rivera@acmehealth.com"]);
  const projectStoreMatches = projects.filter(
    (p) => devIds.has(p.accountableOwnerId || "") || (p.memberIds && p.memberIds.some((m) => devIds.has(m)))
  );
  const deliveryMatches = deliveryProjects.filter((p) =>
    (p.accountableDeveloperId && devIds.has(p.accountableDeveloperId)) ||
    (p.memberIds && p.memberIds.some((m) => devIds.has(m))) ||
    p.mode === "INDIVIDUAL"
  );
  const myProjects = [...projectStoreMatches, ...deliveryMatches.filter(d => !projectStoreMatches.some(p => p.key.toLowerCase() === d.code.toLowerCase()))];
  const myTasks = workItems.filter((w) => devIds.has(w.primaryAssigneeId || ""));
  const completedCount = myTasks.filter((w) => w.state === "DONE").length;
  const pendingCount = myTasks.filter((w) => w.state !== "DONE").length;
  const overdueCount = myTasks.filter((w) => w.dueDate && new Date(w.dueDate) < new Date() && w.state !== "DONE").length;
  const blockedCount = myTasks.filter((w) => w.isBlocked).length;

  const totalAssignedProjects = apiData ? apiData.assignedProjectsCount : myProjects.length;
  const activeProjects = apiData ? apiData.activeProjectsCount : myProjects.filter((p) => (p as any).lifecycle === "ACTIVE" || (p as any).status === "ACTIVE" || (p as any).status === "PLANNING").length;
  const assignedTasks = apiData ? apiData.assignedTasksCount : myTasks.length;
  const completedTasks = apiData ? apiData.completedTasksCount : completedCount;
  const pendingTasks = apiData ? apiData.pendingTasksCount : pendingCount;
  const overdueTasks = apiData ? apiData.overdueTasksCount : overdueCount;
  const openBugs = apiData ? apiData.openBugsCount : 1;
  const pendingReviews = apiData ? apiData.pendingReviewsCount : 2;

  const priorityTasksList = apiData?.priorityTasks?.length
    ? apiData.priorityTasks
    : myTasks.filter((w) => (w.criticality === "HIGH" || w.criticality === "CRITICAL") && w.state !== "DONE");

  const blockedTasksList = apiData?.blockedTasks?.length
    ? apiData.blockedTasks
    : myTasks.filter((w) => w.isBlocked);

  const deadlinesList = apiData?.upcomingDeadlines?.length
    ? apiData.upcomingDeadlines
    : myTasks
        .filter((w) => w.dueDate && w.state !== "DONE")
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 5);

  const recentGit = apiData?.recentGitEvents?.length ? apiData.recentGitEvents : gitEvents.slice(0, 5);

  return (
    <PanelLayout
      title="Developer Workspace"
      breadcrumb={[{ label: currentOrg?.name || "Organization" }, { label: "Developer Dashboard" }]}
    >
      <div className="space-y-6">
        {/* Welcome & Quick Action Header */}
        <div className="p-5 rounded-xl bg-app-surface border border-app-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-app-text-primary">
                Welcome back, {currentUser?.name || "Alex Rivera"}
              </h2>
              <Badge variant="default" className="text-xs">
                Developer Panel
              </Badge>
            </div>
            <p className="text-xs text-app-text-secondary mt-1">
              Active assignments across solo individual ownership and structured engineering deliverables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/org/${orgId}/developer/projects`)}
              className="gap-1.5"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
              <span>My Projects</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/org/${orgId}/developer/tasks`)}
              className="gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>My Tasks</span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/org/${orgId}/developer/progress`)}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Progress Tracker</span>
            </Button>
          </div>
        </div>

        {/* 8 Metric KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="p-3.5 border-l-2 border-l-blue-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Assigned Projects</div>
            <div className="text-xl font-bold text-app-text-primary mt-1">{totalAssignedProjects}</div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">{activeProjects} active</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-indigo-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Active Projects</div>
            <div className="text-xl font-bold text-indigo-600 mt-1">{activeProjects}</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">In flight</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-purple-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Assigned Tasks</div>
            <div className="text-xl font-bold text-app-text-primary mt-1">{assignedTasks}</div>
            <div className="text-[10px] text-purple-600 font-medium mt-0.5">Total owned</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-emerald-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Completed Tasks</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{completedTasks}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Done &amp; verified</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-amber-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Pending Tasks</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{pendingTasks}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">In progress / review</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-rose-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Overdue Tasks</div>
            <div className="text-xl font-bold text-rose-600 mt-1">{overdueTasks}</div>
            <div className="text-[10px] text-rose-600 font-medium mt-0.5">Past due date</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-red-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Open Bugs</div>
            <div className="text-xl font-bold text-red-600 mt-1">{openBugs}</div>
            <div className="text-[10px] text-red-600 font-medium mt-0.5">Requires triage</div>
          </Card>

          <Card className="p-3.5 border-l-2 border-l-teal-600">
            <div className="text-[11px] font-medium text-app-text-muted truncate">Code Reviews</div>
            <div className="text-xl font-bold text-teal-600 mt-1">{pendingReviews}</div>
            <div className="text-[10px] text-teal-600 font-medium mt-0.5">Awaiting decision</div>
          </Card>
        </div>

        {/* Dual Mode Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Individual Mode Card - Emerald / Teal Theme */}
          <Card className="relative overflow-hidden p-5 border border-emerald-500/30 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/10 via-app-surface to-teal-500/5 hover:border-emerald-500/60 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 space-y-3.5">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Mode A — Individual Ownership
              </span>
              <Badge variant="default" className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Weekly Grace Active
              </Badge>
            </div>
            <h3 className="text-base font-bold text-app-text-primary">
              FHIR Patient Intake Service (SOLO-10)
            </h3>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              Direct developer check-in model. No mandatory task boards. Authors directly update percentage progress and delivery milestones weekly.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Target: 2026-11-20
              </span>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm hover:shadow-emerald-600/25 transition-all"
                onClick={() => router.push(`/org/${orgId}/developer/projects/proj-individual-solo/individual`)}
              >
                <span>Open Solo Check-in</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>

          {/* Structured Mode Card - Violet / Purple Theme */}
          <Card className="relative overflow-hidden p-5 border border-violet-500/30 border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-500/10 via-app-surface to-indigo-500/5 hover:border-violet-500/60 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200 space-y-3.5">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-xs">
                <GitPullRequest className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Mode B — Structured Delivery
              </span>
              <Badge variant="success" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                50% Calculated
              </Badge>
            </div>
            <h3 className="text-base font-bold text-app-text-primary">
              Clinical Decision Support API (CRM-100)
            </h3>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              Approved baseline weights (50/100 points). Interactive Sprint board, task state transitions, leaf evidence reviews, and dependency tracking.
            </p>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                Target: 2026-12-15
              </span>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-sm hover:shadow-violet-600/25 transition-all"
                onClick={() => router.push(`/org/${orgId}/developer/projects/proj-structured-cds/structured`)}
              >
                <span>Open Sprint Board</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Today's Work: Priority & Blockers Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Priority Tasks */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-app-text-primary">Priority Tasks</h3>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {priorityTasksList.length}
              </Badge>
            </div>
            <div className="space-y-2.5">
              {priorityTasksList.length === 0 ? (
                <p className="text-xs text-app-text-muted py-4 text-center">No high priority tasks pending.</p>
              ) : (
                priorityTasksList.slice(0, 4).map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg border border-app-border bg-app-surface/50 hover:bg-app-hover transition-colors flex items-center justify-between cursor-pointer"
                    onClick={() => router.push(`/org/${orgId}/developer/tasks`)}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-blue-600">{t.key}</span>
                        <Badge variant="danger" className="text-[9px] px-1 py-0">
                          {t.priority}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-app-text-primary truncate mt-0.5">{t.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {t.state}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Blocked Tasks */}
          <Card className="p-5 space-y-4 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-app-text-primary">Blocked Tasks</h3>
              </div>
              <Badge variant="danger" className="text-xs font-mono">
                {blockedTasksList.length}
              </Badge>
            </div>
            <div className="space-y-2.5">
              {blockedTasksList.length === 0 ? (
                <div className="text-center py-5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs text-app-text-muted">No blockers currently active.</p>
                </div>
              ) : (
                blockedTasksList.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[11px] font-mono font-bold text-rose-600">{t.key}</span>
                      <p className="text-xs font-medium text-app-text-primary truncate mt-0.5">{t.title}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 border-rose-300 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"
                      onClick={() => router.push(`/org/${orgId}/developer/tasks`)}
                    >
                      Inspect
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-app-text-primary">Upcoming Deadlines</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 h-6 p-0"
                onClick={() => router.push(`/org/${orgId}/developer/calendar`)}
              >
                View Calendar
              </Button>
            </div>
            <div className="space-y-2.5">
              {deadlinesList.length === 0 ? (
                <p className="text-xs text-app-text-muted py-4 text-center">No upcoming deadlines.</p>
              ) : (
                deadlinesList.slice(0, 4).map((d: any) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg border border-app-border flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-mono text-blue-600 font-semibold">{d.key || "TASK"}</span>
                      <p className="truncate text-app-text-primary font-medium">{d.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "TBD"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Recent GitHub Activity Feed */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-app-text-primary">Recent GitHub &amp; CI/CD Activity</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/org/${orgId}/developer/github`)}
            >
              Open GitHub Feed
            </Button>
          </div>
          <div className="divide-y divide-app-border">
            {recentGit.map((evt: any) => (
              <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {evt.eventType || evt.type || "COMMIT"}
                  </Badge>
                  <span className="font-semibold text-app-text-primary truncate">
                    {evt.repositoryName || evt.repo || "prowise/backend"}
                  </span>
                  <span className="text-app-text-secondary truncate hidden sm:inline">
                    {evt.payloadSummary || evt.message || evt.title || "Pushed updates"}
                  </span>
                </div>
                <div className="text-[11px] text-app-text-muted shrink-0">
                  {evt.actor || "Developer"} &bull; {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
