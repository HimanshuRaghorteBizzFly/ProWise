"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import {
  LayoutGrid,
  List,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  GitPullRequest,
  Check,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { WorkItem, WorkItemState } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function StructuredModeWorkspace() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const projectId = (params?.projectId as string) || "proj-structured-cds";

  const { currentOrg, currentUser } = useAuthStore();
  const {
    projects,
    workItems,
    baselines,
    updateWorkItemState,
    submitWorkItemForReview,
    addBlocker,
  } = useProjectStore();

  const project = projects.find((p) => p.id === projectId) || projects[1];
  const activeBaseline = baselines.find((b) => b.id === project.activeBaselineId);
  const projectItems = workItems.filter((w) => w.projectId === project.id);

  const [viewMode, setViewMode] = useState<"board" | "list" | "timeline">("board");

  // Task Details / Review Submission Dialog state
  const [selectedTask, setSelectedTask] = useState<WorkItem | null>(null);
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [reviewEvidence, setReviewEvidence] = useState("");

  // Blocker Dialog state
  const [isBlockerDialogOpen, setIsBlockerDialogOpen] = useState(false);
  const [blockerReason, setBlockerReason] = useState("");

  const columns: { state: WorkItemState; title: string; color: string }[] = [
    { state: "TODO", title: "To Do", color: "border-slate-300 dark:border-slate-700" },
    { state: "IN_PROGRESS", title: "In Progress", color: "border-blue-500" },
    { state: "IN_REVIEW", title: "In Review", color: "border-amber-500" },
    { state: "DONE", title: "Done (Accepted)", color: "border-green-500" },
  ];

  const handleMoveState = (task: WorkItem, targetState: WorkItemState) => {
    // Blueprint Rule: A required review blocks moving directly to Done without passing inspection!
    if (targetState === "DONE" && task.state !== "IN_REVIEW") {
      toast.error("Definition of Done: Task must first be submitted for Review and approved by QA.");
      return;
    }

    if (targetState === "IN_REVIEW") {
      submitWorkItemForReview(task.id, currentUser.id);
      toast.success(`Task ${task.key} submitted for inspection (Revision ${task.currentRevision}).`);
      return;
    }

    updateWorkItemState(task.id, targetState, currentUser.id);
    toast.info(`Moved ${task.key} to ${targetState.replace("_", " ")}.`);
  };

  const handleConfirmSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    submitWorkItemForReview(selectedTask.id, currentUser.id);
    setIsSubmitReviewOpen(false);
    toast.success(
      `Submitted ${selectedTask.key} (rev ${selectedTask.currentRevision}) to QA Reviewer Priya Patel.`
    );
  };

  const handleAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    addBlocker(selectedTask.id, blockerReason, "HIGH", currentUser.id);
    setIsBlockerDialogOpen(false);
    setBlockerReason("");
    toast.warning(`Blocker flagged on ${selectedTask.key}.`);
  };

  return (
    <PanelLayout
      title={`Structured Workspace — ${project.name}`}
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: project.key },
        { label: "Structured Mode" },
      ]}
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {project.key}
              </span>
              <h2 className="text-base font-bold text-app-text-primary">{project.name}</h2>
              <Badge variant="default">Mode B: Structured Delivery</Badge>
            </div>
            <p className="text-xs text-app-text-secondary mt-1">
              Active Baseline: <strong>v{activeBaseline?.version || 1}</strong> ({activeBaseline?.totalWeight || 100} points total) • Target: {project.targetDate}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-app-sidebar p-1 rounded-lg border border-app-border">
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors",
                viewMode === "board"
                  ? "bg-app-surface shadow-xs text-app-text-primary font-semibold"
                  : "text-app-text-muted hover:text-app-text-primary"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors",
                viewMode === "list"
                  ? "bg-app-surface shadow-xs text-app-text-primary font-semibold"
                  : "text-app-text-muted hover:text-app-text-primary"
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors",
                viewMode === "timeline"
                  ? "bg-app-surface shadow-xs text-app-text-primary font-semibold"
                  : "text-app-text-muted hover:text-app-text-primary"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>
        </div>

        {/* Progress Formula Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-indigo-900 dark:text-indigo-200">
              Mathematically Calculated Progress:
            </span>{" "}
            <span className="text-app-text-secondary">
              Eligible Done Leaves (
              {projectItems
                .filter((w) => w.state === "DONE")
                .reduce((acc, curr) => acc + curr.weight, 0)}{" "}
              pts) / Baseline ({activeBaseline?.totalWeight || 100} pts) ={" "}
              <strong className="text-indigo-600 text-sm font-extrabold">
                {project.lastProgressPercent}%
              </strong>
            </span>
          </div>
          <div className="w-48">
            <ProgressBar value={project.lastProgressPercent} size="sm" showLabel />
          </div>
        </div>

        {/* VIEW 1: KANBAN BOARD */}
        {viewMode === "board" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((col) => {
              const itemsInCol = projectItems.filter(
                (w) => w.state === col.state && w.type !== "MILESTONE"
              );

              return (
                <div
                  key={col.state}
                  className="bg-app-sidebar/70 rounded-xl p-3 border border-app-border flex flex-col min-h-[500px]"
                >
                  <div
                    className={cn(
                      "flex items-center justify-between pb-2.5 mb-3 border-b-2 font-bold text-xs text-app-text-primary",
                      col.color
                    )}
                  >
                    <span>{col.title}</span>
                    <span className="h-5 w-5 rounded-full bg-app-surface text-app-text-secondary text-[11px] flex items-center justify-center font-mono border border-app-border">
                      {itemsInCol.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {itemsInCol.map((item) => (
                      <Card
                        key={item.id}
                        className={cn(
                          "p-3.5 space-y-2.5 shadow-xs cursor-pointer hover:border-blue-500 transition-all",
                          item.isBlocked && "border-amber-400 bg-amber-50/20"
                        )}
                        onClick={() => setSelectedTask(item)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-600">
                            {item.key}
                          </span>
                          <span className="text-[11px] font-semibold text-app-text-muted">
                            {item.weight} pts
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-app-text-primary line-clamp-2">
                          {item.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-1 border-t border-app-border">
                          <span>rev {item.currentRevision}</span>
                          {item.isBlocked && (
                            <Badge variant="warning" className="text-[10px] px-1 py-0">
                              Blocked
                            </Badge>
                          )}
                        </div>

                        {/* Workflow Action Buttons */}
                        <div
                          className="pt-1 flex items-center justify-between gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {col.state === "TODO" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full text-[11px] h-7"
                              onClick={() => handleMoveState(item, "IN_PROGRESS")}
                            >
                              Start Working &rarr;
                            </Button>
                          )}
                          {col.state === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              className="w-full text-[11px] h-7 bg-amber-600 hover:bg-amber-700"
                              onClick={() => {
                                setSelectedTask(item);
                                setIsSubmitReviewOpen(true);
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" /> Submit for Review
                            </Button>
                          )}
                          {col.state === "IN_REVIEW" && (
                            <div className="w-full text-center py-1 text-[11px] text-amber-600 font-medium">
                              Waiting QA Approval
                            </div>
                          )}
                          {col.state === "DONE" && (
                            <div className="w-full text-center py-1 text-[11px] text-green-600 font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Accepted Work
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}

                    {itemsInCol.length === 0 && (
                      <div className="py-8 text-center text-xs text-app-text-muted border border-dashed border-app-border rounded-lg">
                        Empty column
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: LIST VIEW */}
        {viewMode === "list" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hierarchy / Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Acceptance Criteria</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectItems.map((item) => (
                  <TableRow key={item.id} onClick={() => setSelectedTask(item)} className="cursor-pointer">
                    <TableCell className="font-mono font-bold text-xs text-blue-600">
                      {item.type === "MILESTONE" ? `📦 ${item.key}` : item.key}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-app-text-primary">
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.type === "MILESTONE" ? "default" : "secondary"}>
                        {item.type}
                      </Badge>
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
                    <TableCell className="text-xs text-app-text-secondary truncate max-w-xs">
                      {item.criteria}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => setSelectedTask(item)}>
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* VIEW 3: TIMELINE / GANTT VIEW */}
        {viewMode === "timeline" && (
          <Card className="p-5 space-y-4">
            <CardTitle className="text-sm">Finish-to-Start Milestone Schedule</CardTitle>
            <CardDescription>
              Sprint date cutoffs derive from the project local timezone ({project.timezone}). Moving predecessors highlights dependency risk.
            </CardDescription>

            <div className="space-y-4 pt-2">
              {projectItems.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-app-text-primary">
                      {item.key} — {item.title}
                    </span>
                    <span className="text-app-text-muted">Due: {item.dueDate || "Nov 15, 2026"}</span>
                  </div>
                  <ProgressBar
                    value={item.state === "DONE" ? 100 : item.state === "IN_REVIEW" ? 75 : item.state === "IN_PROGRESS" ? 40 : 0}
                    size="sm"
                    status={item.state === "DONE" ? "success" : item.state === "IN_REVIEW" ? "warning" : "default"}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Task Details Dialog */}
      {selectedTask && (
        <Dialog
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={`[${selectedTask.key}] ${selectedTask.title}`}
          description={`Revision ${selectedTask.currentRevision} • Weight: ${selectedTask.weight} points`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div>
              <span className="font-bold text-app-text-primary block mb-1">
                Acceptance Criteria:
              </span>
              <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed">
                {selectedTask.criteria}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-app-border">
                <span className="text-app-text-muted">Current Workflow State:</span>
                <p className="font-bold text-sm text-app-text-primary mt-1">
                  {selectedTask.state.replace("_", " ")}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-app-border">
                <span className="text-app-text-muted">Assigned Reviewer:</span>
                <p className="font-semibold text-app-text-primary mt-1">Priya Patel (QA)</p>
              </div>
            </div>

            {selectedTask.isBlocked && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                <span className="font-bold">Active Blocker:</span>{" "}
                {selectedTask.blockers?.[0]?.reason || "Impediment logged."}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-app-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsBlockerDialogOpen(true);
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" /> Flag Blocker
              </Button>

              <div className="flex items-center gap-2">
                {selectedTask.state === "IN_PROGRESS" && (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => {
                      setIsSubmitReviewOpen(true);
                    }}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Submit for Review
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Submit for Review Dialog */}
      <Dialog
        isOpen={isSubmitReviewOpen}
        onClose={() => setIsSubmitReviewOpen(false)}
        title="Submit Work Item for Inspection"
        description="Submitting records your current revision and notifies the assigned QA reviewer."
      >
        <form onSubmit={handleConfirmSubmitReview} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300">
            Submitting <strong>{selectedTask?.key}</strong> at <strong>Revision {selectedTask?.currentRevision}</strong>.
            Reviewers will inspect against this exact revision snapshot.
          </div>

          <Input
            label="Optional Pull Request or Test Evidence Link"
            value={reviewEvidence}
            onChange={(e) => setReviewEvidence(e.target.value)}
            placeholder="https://github.com/acme-health/clinical-decision-api/pull/28"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsSubmitReviewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit to Reviewer</Button>
          </div>
        </form>
      </Dialog>

      {/* Flag Blocker Dialog */}
      <Dialog
        isOpen={isBlockerDialogOpen}
        onClose={() => setIsBlockerDialogOpen(false)}
        title="Flag Blocker on Task"
        description="Blockers highlight impediments without altering approved task state."
      >
        <form onSubmit={handleAddBlocker} className="space-y-4 pt-2">
          <Textarea
            label="Blocker Reason"
            value={blockerReason}
            onChange={(e) => setBlockerReason(e.target.value)}
            placeholder="Explain what is blocking progress..."
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsBlockerDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Log Blocker</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

