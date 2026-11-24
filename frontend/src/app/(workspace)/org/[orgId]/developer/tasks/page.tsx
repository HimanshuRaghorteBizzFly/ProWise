"use client";

import { previewEnabled } from "@/lib/permissions";
import { MyTasksView } from "@/components/work/ReviewViews";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  CheckSquare,
  Search,
  Filter,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Kanban,
  List,
  Plus,
  Send,
  MessageSquare,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/store/project-store";
import { developerApi, DeveloperWorkItem } from "@/lib/developer-api";
import { toast } from "sonner";

function PreviewDeveloperTasksPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { workItems: storeWorkItems } = useProjects(orgId);
  const { updateWorkItem } = useProjectStore();

  const [tasks, setTasks] = useState<DeveloperWorkItem[]>([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // Blocker modal state
  const [blockerModalTask, setBlockerModalTask] = useState<DeveloperWorkItem | null>(null);
  const [blockerReason, setBlockerReason] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState("HIGH");

  const loadTasks = async () => {
    const res = await developerApi.getTasks();
    if (res && res.length > 0) {
      setTasks(res);
    } else {
      const mapped: DeveloperWorkItem[] = storeWorkItems.map((w: any) => ({
        id: w.id,
        projectId: w.projectId,
        orgId: w.orgId,
        parentId: w.parentId,
        type: w.type || "TASK",
        key: w.key,
        title: w.title,
        description: w.description,
        primaryAssigneeId: w.primaryAssigneeId,
        reviewerId: w.reviewerId,
        state: w.state,
        blocked: Boolean(w.isBlocked),
        weight: w.weight || 1,
        currentRevision: w.currentRevision || 1,
        dueDate: w.dueDate,
        priority: (w.criticality || w.priority || "MEDIUM") as any,
        sprintId: w.sprintId,
        createdAt: w.createdAt || new Date().toISOString(),
        updatedAt: w.updatedAt || new Date().toISOString(),
      }));
      setTasks(mapped);
    }
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeWorkItems]);

  const handleStateChange = async (taskId: string, newState: any) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, state: newState } : t))
    );
    updateWorkItem(taskId, { state: newState });

    const res = await developerApi.updateTaskStatus(taskId, newState);
    if (res) {
      toast.success(`Task updated to ${newState}`);
    } else {
      toast.success(`Task state updated`);
    }
  };

  const handleReportBlocker = async () => {
    if (!blockerModalTask || !blockerReason.trim()) return;
    await developerApi.submitBlocker(blockerModalTask.id, blockerReason, blockerSeverity);
    toast.error(`Blocker reported on ${blockerModalTask.key}`);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === blockerModalTask.id ? { ...t, blocked: true } : t
      )
    );
    setBlockerModalTask(null);
    setBlockerReason("");
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.key.toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === "ALL" || t.state === stateFilter;
    return matchesSearch && matchesState;
  });

  const columns: { state: DeveloperWorkItem["state"]; title: string; color: string; icon: any }[] = [
    { state: "TODO", title: "To Do", color: "border-slate-400", icon: Clock },
    { state: "IN_PROGRESS", title: "In Progress", color: "border-blue-500", icon: PlayCircle },
    { state: "IN_REVIEW", title: "In Review", color: "border-amber-500", icon: AlertCircle },
    { state: "DONE", title: "Done", color: "border-emerald-500", icon: CheckCircle2 },
  ];

  return (
    <PanelLayout
      title="My Tasks & Kanban"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "My Tasks" }]}
    >
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Assigned Tasks &amp; Work Items</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Move work items through the delivery pipeline, report blockers, and submit for peer review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-app-text-muted" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <div className="flex items-center rounded-lg border border-app-border bg-app-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`p-1.5 rounded-md flex items-center gap-1 ${
                  viewMode === "board" ? "bg-blue-600 text-white" : "text-app-text-secondary"
                }`}
                title="Kanban Board View"
              >
                <Kanban className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md flex items-center gap-1 ${
                  viewMode === "table" ? "bg-blue-600 text-white" : "text-app-text-secondary"
                }`}
                title="Table List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Kanban Board View */}
        {viewMode === "board" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {columns.map((col) => {
              const items = filteredTasks.filter((t) => t.state === col.state);
              const Icon = col.icon;
              return (
                <div
                  key={col.state}
                  className="rounded-xl border border-app-border bg-app-surface flex flex-col min-h-[440px]"
                >
                  <div className={`flex items-center justify-between p-3.5 border-b-2 ${col.color}`}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-app-text-secondary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-app-text-primary">
                        {col.title}
                      </h4>
                    </div>
                    <span className="rounded-full bg-app-bg border border-app-border px-2 py-0.5 text-xs font-bold text-app-text-secondary">
                      {items.length}
                    </span>
                  </div>

                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-xs text-app-text-muted border border-dashed border-app-border rounded-lg">
                        No tasks in {col.title}
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-app-border bg-app-bg p-3.5 shadow-subtle hover:shadow-md transition-shadow text-xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-600">{item.key}</span>
                            <div className="flex items-center gap-1">
                              {item.blocked && (
                                <Badge variant="danger" className="text-[9px] px-1.5 py-0">
                                  BLOCKED
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {item.weight} pts
                              </Badge>
                            </div>
                          </div>

                          <h5 className="font-semibold text-app-text-primary line-clamp-2">{item.title}</h5>

                          <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-1 border-t border-app-border">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No due date"}
                            </span>
                            <span className="font-mono text-[10px]">rev {item.currentRevision}</span>
                          </div>

                          {/* Quick State Transition Actions */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-1 border-t border-app-border">
                            <div className="flex items-center gap-1">
                              {item.state !== "IN_PROGRESS" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[10px] text-blue-600"
                                  onClick={() => handleStateChange(item.id, "IN_PROGRESS")}
                                >
                                  Start
                                </Button>
                              )}
                              {item.state === "IN_PROGRESS" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[10px] text-amber-600"
                                  onClick={() => handleStateChange(item.id, "IN_REVIEW")}
                                >
                                  Review
                                </Button>
                              )}
                              {item.state !== "DONE" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[10px] text-emerald-600"
                                  onClick={() => handleStateChange(item.id, "DONE")}
                                >
                                  Done
                                </Button>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px] text-rose-500 hover:text-rose-600"
                              onClick={() => setBlockerModalTask(item)}
                              title="Report Blocker"
                            >
                              <ShieldAlert className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table List View */
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-app-text-muted">
                      No tasks found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono font-bold text-xs text-blue-600">{t.key}</TableCell>
                      <TableCell className="font-medium text-xs text-app-text-primary">{t.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant={t.priority === "HIGH" || t.priority === "CRITICAL" ? "danger" : "outline"}
                          className="text-[10px]"
                        >
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.state === "DONE"
                              ? "success"
                              : t.state === "IN_REVIEW"
                              ? "warning"
                              : t.blocked
                              ? "danger"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {t.blocked ? "BLOCKED" : t.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{t.weight} pts</TableCell>
                      <TableCell className="text-xs text-app-text-secondary">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7"
                          onClick={() => handleStateChange(t.id, t.state === "DONE" ? "IN_PROGRESS" : "DONE")}
                        >
                          {t.state === "DONE" ? "Reopen" : "Mark Done"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Blocker Modal */}
        {blockerModalTask && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-sm text-app-text-primary">
                    Report Blocker on {blockerModalTask.key}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockerModalTask(null)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>
              <p className="text-xs text-app-text-secondary">
                Describe the dependency or issue blocking this task. The task will be marked as BLOCKED until resolved.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-app-text-primary block mb-1">
                    Blocker Reason &amp; Impact
                  </label>
                  <textarea
                    rows={3}
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    placeholder="e.g. Waiting on API authentication credentials from client team..."
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-app-text-primary block mb-1">Severity</label>
                  <select
                    value={blockerSeverity}
                    onChange={(e) => setBlockerSeverity(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                  >
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical (Blocks Sprint)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setBlockerModalTask(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={handleReportBlocker}
                >
                  Submit Blocker
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}

/** Task 3.3: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function DeveloperTasksPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/developer`;
  return previewEnabled() ? <PreviewDeveloperTasksPage /> : (
    <MyTasksView crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
  );
}
