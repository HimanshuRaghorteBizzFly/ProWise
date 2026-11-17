"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import {
  Users,
  CheckSquare,
  AlertTriangle,
  Activity,
  Plus,
  ArrowRight,
  ShieldAlert,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { SEEDED_USERS } from "@/lib/mock-data";
import { Priority, WorkItem } from "@/types";
import { toast } from "sonner";

export default function TeamLeadDashboard() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const {
    workItems,
    projects,
    addBlocker,
    resolveBlocker,
    reopenWorkItem,
    createWorkItem,
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"work" | "blockers" | "roster" | "workload">("work");

  // Blocker Dialog
  const [isBlockerDialogOpen, setIsBlockerDialogOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState(workItems[1]?.id || "");
  const [blockerReason, setBlockerReason] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState<Priority>("HIGH");

  // Reopen Dialog
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [reopenItemId, setReopenItemId] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  // New Task Dialog
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskWeight, setTaskWeight] = useState(10);
  const [taskAssignee, setTaskAssignee] = useState("usr-developer");

  const handleAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    addBlocker(selectedWorkItemId, blockerReason, blockerSeverity, "usr-lead");
    setIsBlockerDialogOpen(false);
    setBlockerReason("");
    toast.warning("Blocker logged. Successor tasks flagged with risk warning.");
  };

  const handleReopen = (e: React.FormEvent) => {
    e.preventDefault();
    reopenWorkItem(reopenItemId, reopenReason, "usr-lead");
    setIsReopenDialogOpen(false);
    setReopenReason("");
    toast.warning("Task reopened to In Progress. Completion credit revoked immediately.");
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createWorkItem({
      projectId: "proj-structured-cds",
      orgId,
      type: "TASK",
      key: `CRM-${100 + workItems.length + 1}`,
      title: taskTitle,
      description: "Scoped sprint work item",
      primaryAssigneeId: taskAssignee,
      reviewerId: "usr-reviewer",
      collaboratorIds: [],
      state: "TODO",
      isBlocked: false,
      blockers: [],
      weight: taskWeight,
      weightUnit: "points",
      criteria: "Pass acceptance checklist and unit test suite",
      criteriaVersion: 1,
      criticality: "HIGH",
    });
    setIsTaskDialogOpen(false);
    setTaskTitle("");
    toast.success("Work item added to team backlog.");
  };

  const allActiveBlockers = workItems.flatMap((w) =>
    (w.blockers || [])
      .filter((b) => !b.resolvedAt)
      .map((b) => ({ ...b, taskKey: w.key, taskTitle: w.title, workItemId: w.id }))
  );

  return (
    <PanelLayout
      title="Team Lead Dashboard"
      breadcrumb={[{ label: currentOrg.name }, { label: "Core Clinical Squad" }, { label: "Lead Panel" }]}
    >
      <div className="space-y-6">
        {/* Squad Header */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-app-text-primary">
                Core Clinical Engineering Squad
              </h2>
              <Badge variant="default">Sprint 42</Badge>
            </div>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Assigned Projects: Clinical Decision Support API (CRM-100), FHIR Patient Intake (SOLO-10)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsBlockerDialogOpen(true)}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" /> Flag Blocker
            </Button>
            <Button size="sm" onClick={() => setIsTaskDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Task
            </Button>
          </div>
        </div>

        {/* Lead Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Assigned Work Items</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">{workItems.length}</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">
              {workItems.filter((w) => w.state === "DONE").length} Done / {workItems.filter((w) => w.state === "IN_REVIEW").length} In Review
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Active Blockers</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {allActiveBlockers.length}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Separate risk condition</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Team Members</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">3 Engineers</div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">100% capacity committed</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Calculated Progress</div>
            <div className="text-2xl font-bold text-green-600 mt-1">50%</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">50 / 100 points Done</div>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("work")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "work"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Work Items &amp; State ({workItems.length})
          </button>
          <button
            onClick={() => setActiveTab("blockers")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "blockers"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Blockers ({allActiveBlockers.length})
          </button>
          <button
            onClick={() => setActiveTab("workload")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "workload"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Planned Capacity vs Hours
          </button>
        </div>

        {/* Tab 1: Work Items */}
        {activeTab === "work" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead className="text-right">Lead Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workItems.map((item) => {
                  const assignee = SEEDED_USERS.find((u) => u.id === item.primaryAssigneeId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-bold text-xs text-blue-600">
                        {item.key}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-app-text-primary">{item.title}</div>
                        <div className="text-[11px] text-app-text-muted">{item.criteria}</div>
                      </TableCell>
                      <TableCell className="text-xs text-app-text-secondary">
                        {assignee?.name || "Unassigned"}
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
                      <TableCell className="text-right">
                        {item.state === "DONE" && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReopenItemId(item.id);
                              setIsReopenDialogOpen(true);
                            }}
                            className="text-xs"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Reopen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 2: Blockers */}
        {activeTab === "blockers" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affected Work Item</TableHead>
                  <TableHead>Blocker Reason</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Raised At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allActiveBlockers.map((blk) => (
                  <TableRow key={blk.id}>
                    <TableCell className="font-semibold text-xs text-blue-600">
                      {blk.taskKey} - {blk.taskTitle}
                    </TableCell>
                    <TableCell className="text-xs text-app-text-primary">{blk.reason}</TableCell>
                    <TableCell>
                      <Badge variant={blk.severity === "CRITICAL" ? "danger" : "warning"}>
                        {blk.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-muted">
                      {new Date(blk.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          resolveBlocker(blk.workItemId, blk.id);
                          toast.success(`Blocker on ${blk.taskKey} resolved.`);
                        }}
                      >
                        Resolve Blocker
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {allActiveBlockers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-app-text-muted">
                      No active blockers. Engineering pipeline is unhindered.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 3: Workload & Capacity */}
        {activeTab === "workload" && (
          <Card className="p-5 space-y-4">
            <CardTitle className="text-sm">Weekly Squad Workload &amp; Capacity</CardTitle>
            <CardDescription>
              Blueprint Rule: Workload tracks planned vs available hours only. No automatic equivalence between story points and hours.
            </CardDescription>

            <div className="space-y-3 pt-2">
              {[
                { name: "Alex Rivera (Developer)", planned: 36, capacity: 40, status: "Normal" },
                { name: "David Kim (Team Lead)", planned: 32, capacity: 40, status: "Normal" },
                { name: "Priya Patel (QA / Reviewer)", planned: 28, capacity: 35, status: "Normal" },
              ].map((m, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-app-border bg-app-sidebar/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-app-text-primary">{m.name}</span>
                    <div className="text-app-text-secondary mt-0.5">
                      Planned Hours: {m.planned}h / {m.capacity}h Available
                    </div>
                  </div>
                  <Badge variant="success">{m.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Flag Blocker Dialog */}
      <Dialog
        isOpen={isBlockerDialogOpen}
        onClose={() => setIsBlockerDialogOpen(false)}
        title="Flag Work Item Blocker"
        description="Blocker is an explicit separate condition that surfaces upstream risk without silently altering approved target dates."
      >
        <form onSubmit={handleAddBlocker} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Affected Work Item
            </label>
            <select
              value={selectedWorkItemId}
              onChange={(e) => setSelectedWorkItemId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              {workItems.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.key} — {w.title}
                </option>
              ))}
            </select>
          </div>

          <Textarea
            label="Specific Blocker Reason"
            value={blockerReason}
            onChange={(e) => setBlockerReason(e.target.value)}
            placeholder="e.g. Staging database credentials revoked; awaiting security key rotation"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">Severity</label>
            <select
              value={blockerSeverity}
              onChange={(e) => setBlockerSeverity(e.target.value as any)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical (Triggers At-Risk Health Signal)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsBlockerDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Log Blocker</Button>
          </div>
        </form>
      </Dialog>

      {/* Reopen Work Item Dialog */}
      <Dialog
        isOpen={isReopenDialogOpen}
        onClose={() => setIsReopenDialogOpen(false)}
        title="Reopen Completed Work Item"
        description="Blueprint Rule: Reopening a completed leaf immediately revokes its completion credit from calculated project progress."
      >
        <form onSubmit={handleReopen} className="space-y-4 pt-2">
          <Textarea
            label="Mandatory Reason for Reopening"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="e.g. Post-deployment regression discovered in prescription validation rules"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsReopenDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Confirm Reopen &amp; Revoke Credit
            </Button>
          </div>
        </form>
      </Dialog>

      {/* New Work Item Dialog */}
      <Dialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        title="Create Team Work Item"
        description="Add a task to the squad backlog."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          <Input
            label="Task Title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. Implement HL7 message dead letter queue"
            required
          />

          <Input
            label="Weight (Points)"
            type="number"
            value={taskWeight}
            onChange={(e) => setTaskWeight(parseInt(e.target.value) || 10)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Assignee
            </label>
            <select
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              <option value="usr-developer">Alex Rivera (Developer)</option>
              <option value="usr-lead">David Kim (Team Lead)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Work Item</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

