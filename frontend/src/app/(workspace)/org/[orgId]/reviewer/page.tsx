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
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { WorkItem } from "@/types";
import { toast } from "sonner";

export default function ReviewerDashboard() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { workItems, reviewWorkItem, auditLogs } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"queue" | "history" | "checklists">("queue");

  // Inspect Review Dialog state
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [checklistAllChecked, setChecklistAllChecked] = useState(false);
  const [changesReason, setChangesReason] = useState("");
  const [isChangesReasonOpen, setIsChangesReasonOpen] = useState(false);

  // Stale Review Simulation Test state
  const [simulateStaleRevision, setSimulateStaleRevision] = useState(false);

  // Review queue: items in state IN_REVIEW
  const reviewQueue = workItems.filter((w) => w.state === "IN_REVIEW");

  const handleApprove = () => {
    if (!selectedItem) return;

    // Test Scenario: If simulateStaleRevision is true, send an older revision to trigger 409 STALE_REVIEW conflict!
    const targetRev = simulateStaleRevision ? selectedItem.currentRevision - 1 : selectedItem.currentRevision;

    const res = reviewWorkItem(
      selectedItem.id,
      currentUser.id,
      "APPROVED",
      undefined,
      targetRev
    );

    if (res.conflict) {
      toast.error(res.error);
      return;
    }

    if (res.success) {
      toast.success(
        `Approved ${selectedItem.key} (rev ${selectedItem.currentRevision})! Work moved to DONE. Progress credit earned.`
      );
      setSelectedItem(null);
    } else {
      toast.error(res.error || "Approval failed");
    }
  };

  const handleRequestChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (!changesReason || changesReason.trim().length < 5) {
      toast.error("A mandatory reason is required when requesting changes.");
      return;
    }

    const res = reviewWorkItem(
      selectedItem.id,
      currentUser.id,
      "CHANGES_REQUESTED",
      changesReason,
      selectedItem.currentRevision
    );

    if (res.success) {
      toast.warning(`Changes requested on ${selectedItem.key}. Returned to IN_PROGRESS.`);
      setSelectedItem(null);
      setIsChangesReasonOpen(false);
      setChangesReason("");
    } else {
      toast.error(res.error || "Failed to submit decision");
    }
  };

  return (
    <PanelLayout
      title="QA &amp; Verification Hub"
      breadcrumb={[{ label: currentOrg.name }, { label: "Priya Patel (Reviewer)" }]}
    >
      <div className="space-y-6">
        {/* Reviewer Header */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-app-text-primary">Review Queue</h2>
              <Badge variant="default">{reviewQueue.length} Pending Inspection</Badge>
            </div>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Blueprint V1.1 Definition of Done: Approvals bind to the exact submitted revision and acceptance criteria.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={simulateStaleRevision ? "danger" : "outline"}
              onClick={() => {
                setSimulateStaleRevision(!simulateStaleRevision);
                toast.info(
                  !simulateStaleRevision
                    ? "Stale Review simulation enabled: next decision will send rev-1 to test 409 conflict detection."
                    : "Stale Review simulation disabled."
                );
              }}
              title="Test 409 STALE_REVIEW conflict handling"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {simulateStaleRevision ? "Simulating Stale Rev (Active)" : "Simulate Stale Conflict"}
            </Button>
          </div>
        </div>

        {/* Reviewer Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Assigned Queue</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{reviewQueue.length}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Requires verification</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Approved Releases</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {workItems.filter((w) => w.state === "DONE").length}
            </div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">Verified &amp; Done</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Active Blockers</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">1</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">Documented upstream</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Turnaround SLA</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">&lt; 4 hrs</div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">Within benchmark</div>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "queue"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Pending Review Queue ({reviewQueue.length})
          </button>
          <button
            onClick={() => setActiveTab("checklists")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "checklists"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Quality Checklists &amp; Standards
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            QA Decision Audit Trail
          </button>
        </div>

        {/* Tab 1: Pending Queue */}
        {activeTab === "queue" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Item</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Submitted Revision</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Criticality</TableHead>
                  <TableHead className="text-right">Inspection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewQueue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold text-xs text-blue-600">
                      {item.key}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-app-text-primary">{item.title}</div>
                      <div className="text-[11px] text-app-text-muted line-clamp-1">
                        Criteria: {item.criteria}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{item.weight} pts</TableCell>
                    <TableCell className="font-mono text-xs">
                      Revision {item.submittedRevision || item.currentRevision}
                    </TableCell>
                    <TableCell className="text-xs text-app-text-secondary">{item.dueDate}</TableCell>
                    <TableCell>
                      <Badge variant={item.criticality === "CRITICAL" ? "danger" : "warning"}>
                        {item.criticality}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setSelectedItem(item)}>
                        Inspect &amp; Decide
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {reviewQueue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-xs text-app-text-muted">
                      Review queue is empty. All submitted work revisions have been resolved!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 2: Quality Checklists */}
        {activeTab === "checklists" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-3">
              <CardTitle className="text-sm">Mandatory Pre-Approval Checklist</CardTitle>
              <div className="space-y-2 text-xs text-app-text-secondary">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Automated unit and integration tests passing in CI</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Zero Sev-1 / Sev-2 security vulnerabilities reported</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>OpenAPI schemas match approved contract models</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Staging environment canary deployment verification clean</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <CardTitle className="text-sm">Blueprint V1.1 Decision Rules</CardTitle>
              <p className="text-xs text-app-text-secondary leading-relaxed">
                Approve advances the item to <strong>DONE</strong> and commits calculated progress credit.
                Request Changes mandates an explanatory reason and returns the item to <strong>IN_PROGRESS</strong>.
              </p>
            </Card>
          </div>
        )}

        {/* Tab 3: QA Decision Audit Trail */}
        {activeTab === "history" && (
          <Card className="p-5 space-y-3">
            <CardTitle className="text-sm">Audit Log of Review Decisions</CardTitle>
            <div className="space-y-3 pt-2">
              {auditLogs
                .filter((l) => l.action.includes("WORK_ITEM") || l.action.includes("APPROVED"))
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-app-border bg-app-sidebar/40 text-xs flex items-start justify-between"
                  >
                    <div>
                      <span className="font-semibold text-app-text-primary">{log.action}</span>
                      <p className="text-app-text-secondary mt-0.5">{log.details}</p>
                      <span className="text-[10px] text-app-text-muted mt-1 block">
                        By {log.actorEmail} ({log.actorRole})
                      </span>
                    </div>
                    <span className="text-[10px] text-app-text-muted shrink-0 ml-4">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>

      {/* Inspect & Decide Dialog */}
      {selectedItem && (
        <Dialog
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={`Inspect Work Item: [${selectedItem.key}] ${selectedItem.title}`}
          description={`Inspecting Revision ${selectedItem.submittedRevision || selectedItem.currentRevision} • ${selectedItem.weight} points`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div>
              <span className="font-bold text-app-text-primary block mb-1">
                Specified Acceptance Criteria:
              </span>
              <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed">
                {selectedItem.criteria}
              </p>
            </div>

            <div className="p-3 rounded-lg border border-app-border space-y-2">
              <span className="font-semibold text-app-text-primary">
                Review Verification Checklist:
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklistAllChecked}
                  onChange={(e) => setChecklistAllChecked(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-app-text-secondary">
                  I have inspected the submitted code/evidence and certify that all criteria pass.
                </span>
              </label>
            </div>

            {simulateStaleRevision && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200">
                <strong>Stale Conflict Simulation Armed:</strong> This decision will be submitted against an older revision snapshot to verify 409 conflict detection.
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-app-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangesReasonOpen(true)}
                className="text-amber-600 hover:text-amber-700"
              >
                Request Changes
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedItem(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!checklistAllChecked}
                  onClick={handleApprove}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve &amp; Earn Credit
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Request Changes Dialog */}
      <Dialog
        isOpen={isChangesReasonOpen}
        onClose={() => setIsChangesReasonOpen(false)}
        title="Request Changes with Mandatory Reason"
        description="Blueprint Rule: Requesting changes returns the work item to In Progress. A clear explanation is mandatory."
      >
        <form onSubmit={handleRequestChanges} className="space-y-4 pt-2">
          <Textarea
            label="Mandatory Correction Notes"
            value={changesReason}
            onChange={(e) => setChangesReason(e.target.value)}
            placeholder="e.g. Unit tests fail on dosage edge case (prescription > 500mg); please patch and resubmit."
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsChangesReasonOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Return to Developer
            </Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

