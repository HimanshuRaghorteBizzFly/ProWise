"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import {
  FolderGit2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Plus,
  ArrowLeft,
  FileCheck,
  ShieldCheck,
  ExternalLink,
  GitCommit,
  Info,
  Archive,
  Lock,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "@/lib/api";
import {
  useProgressApi,
  CheckInSubmissionModal,
  CheckInAuditTrail,
  useDeliveryApi,
  DeliveryAcceptanceModal,
  DeliveryReviewModal,
  ProjectClosureModal,
  BlockerManagementModal,
} from "@/features/projects";
import type { ProjectDto } from "@/types/api";
import { toast } from "sonner";

export default function IndividualModeWorkspace() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const projectId = (params?.projectId as string) || "proj-individual-solo";

  const { currentUser } = useAuthStore();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const {
    summary,
    checkIns,
    gitHubActivity,
    isLoading: isProgressLoading,
    refresh: refreshProgress,
  } = useProgressApi(projectId, orgId);

  const {
    status: deliveryStatus,
    requests: acceptanceRequests,
    blockers,
    history: lifecycleHistory,
    closures,
    refresh: refreshDelivery,
    requestAcceptance,
    decideAcceptance,
    closeProject,
    reopenProject,
    createBlocker,
    waiveBlocker,
    resolveBlocker,
  } = useDeliveryApi(projectId);

  const [activeTab, setActiveTab] = useState<"overview" | "history" | "evidence" | "delivery">("overview");
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isBlockersModalOpen, setIsBlockersModalOpen] = useState(false);

  const loadProject = async () => {
    if (!projectId) return;
    setProjectError(null);
    setIsProjectLoading(true);
    try {
      const p = await apiClient.project(orgId, projectId);
      setProject(p);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load project.";
      setProjectError(message);
      toast.error("Project could not be loaded", { description: message });
    } finally {
      setIsProjectLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId, orgId]);

  const handleRefreshAll = async () => {
    await Promise.all([loadProject(), refreshProgress(), refreshDelivery()]);
  };

  const currentPercent = summary ? summary.current.percent : project?.progress.percent ?? null;
  const lastReportedAt = summary ? summary.current.reported_at : project?.progress.reported_at ?? null;
  const pendingCheckIn = summary?.pending ?? null;
  const latestAccepted = checkIns.find((checkin) => checkin.status === "APPROVED") ?? null;
  const latestRequest = acceptanceRequests[0];
  const isArchived = project?.archived || false;
  const currentLifecycle = project?.lifecycle || "ACTIVE";

  const criticalOpenBlockers = blockers.filter(
    (b) => b.severity === "CRITICAL" && b.status === "OPEN" && !b.waiver
  );

  return (
    <PanelLayout
      title={`Individual Workspace — ${project?.name || "Project"}`}
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: project?.key || "Project" },
        { label: "Individual Mode" },
      ]}
    >
      <div className="space-y-6">
        {projectError && (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {projectError}
          </div>
        )}
        {isProjectLoading && !project && (
          <div role="status" className="text-sm text-app-text-muted">Loading project...</div>
        )}
        {/* Archived Banner (T14) */}
        {isArchived && (
          <div className="rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 shadow-sm flex items-center justify-between gap-3 text-rose-200 text-sm">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-rose-400" />
              <span>
                <strong>Project Archived (Read-Only):</strong> Modifications, check-ins, and delivery requests are disabled until restored.
              </span>
            </div>
            <Badge variant="outline" className="border-rose-700 text-rose-300">
              Archived
            </Badge>
          </div>
        )}

        {/* Workspace Header */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {project?.key || "KEY"}
              </span>
              <h2 className="text-base font-bold text-app-text-primary">{project?.name || "Loading..."}</h2>
              <Badge variant="default">Mode A: Individual Ownership</Badge>

              {/* Lifecycle badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  currentLifecycle === "DELIVERED"
                    ? "bg-teal-950 text-teal-300 border-teal-800"
                    : currentLifecycle === "CLOSED"
                    ? "bg-purple-950 text-purple-300 border-purple-800"
                    : currentLifecycle === "AWAITING_ACCEPTANCE"
                    ? "bg-blue-950 text-blue-300 border-blue-800"
                    : currentLifecycle === "ON_HOLD"
                    ? "bg-amber-950 text-amber-300 border-amber-800"
                    : "bg-emerald-950 text-emerald-300 border-emerald-800"
                }`}
              >
                {currentLifecycle.replace("_", " ")}
              </span>

              {summary && (
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Team Lead Review
                </span>
              )}
            </div>
            <p className="text-xs text-app-text-secondary mt-1 max-w-2xl">
              {project?.description || "Single accountable developer delivery mode with zero mandatory task breakdown."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Blocker button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBlockersModalOpen(true)}
              className={criticalOpenBlockers.length > 0 ? "border-red-500 text-red-400" : ""}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Blockers ({blockers.filter((b) => b.status === "OPEN").length})
            </Button>

            {/* Submit progress checkin */}
            <Button
              size="sm"
              variant="outline"
              disabled={isArchived || currentLifecycle === "CLOSED"}
              onClick={() => setIsCheckInModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Progress Check-In
            </Button>

            {/* Request Delivery Acceptance (T15, AS-02) */}
            {currentPercent !== null && currentPercent >= 100 && currentLifecycle === "ACTIVE" && !isArchived && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-900/30"
                onClick={() => setIsAcceptanceModalOpen(true)}
              >
                <PackageCheck className="w-3.5 h-3.5 mr-1" /> Request Delivery Acceptance
              </Button>
            )}

            {/* Review Delivery Request button (for leads/reviewers) */}
            {currentLifecycle === "AWAITING_ACCEPTANCE" && latestRequest && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                onClick={() => setIsReviewModalOpen(true)}
              >
                <FileCheck className="w-3.5 h-3.5 mr-1" /> Review Delivery Request
              </Button>
            )}

            {/* Close Project button */}
            {currentLifecycle === "DELIVERED" && !isArchived && (
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                onClick={() => setIsClosureModalOpen(true)}
              >
                <Lock className="w-3.5 h-3.5 mr-1" /> Close Project
              </Button>
            )}

            {/* Reopen button */}
            {currentLifecycle === "CLOSED" && !isArchived && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const reason = prompt("Enter reason for reopening project:");
                  if (reason && project) {
                    await reopenProject({ reason, expected_project_version: project.version });
                    await handleRefreshAll();
                    toast.success("Project reopened to ACTIVE state.");
                  }
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen Project
              </Button>
            )}
          </div>
        </div>

        {/* Pending Verification Banner if any */}
        {pendingCheckIn && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Pending Verification: {pendingCheckIn.percent}%
                  </h4>
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                    Awaiting Team Lead Review
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Submitted {new Date(pendingCheckIn.submitted_at).toLocaleString()} by {pendingCheckIn.author.email ?? "Unknown"}. Current approved progress remains {currentPercent === null ? "Not reported" : `${currentPercent.toFixed(1)}%`} until approved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Awaiting Acceptance Banner (T15) */}
        {currentLifecycle === "AWAITING_ACCEPTANCE" && (
          <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-200">
            <div className="flex items-start gap-3">
              <PackageCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Delivery Acceptance Pending Review
                </h4>
                <p className="text-xs text-blue-300 mt-0.5">
                  Delivery request submitted on {latestRequest ? new Date(latestRequest.created_at).toLocaleString() : "recently"}. Awaiting authorized team lead or project manager review.
                </p>
              </div>
            </div>
            {latestRequest && (
              <Button size="sm" variant="outline" className="border-blue-400 text-blue-300" onClick={() => setIsReviewModalOpen(true)}>
                Inspect Request
              </Button>
            )}
          </div>
        )}

        {/* Current Progress & Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Progress Card (Blueprint T28: "Developer reported") */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Current Verified Progress</span>
                <Badge variant="success">Developer Reported</Badge>
              </div>
              <div className="text-3xl font-extrabold text-app-text-primary mt-2">
                {currentPercent === null ? "Not reported" : `${currentPercent.toFixed(1)}%`}
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar
                value={currentPercent ?? 0}
                size="md"
                isNotReported={currentPercent === null}
              />
              <span className="text-[10px] text-app-text-muted mt-1.5 block">
                {lastReportedAt
                  ? `Developer reported on ${new Date(lastReportedAt).toLocaleString()}`
                  : "No check-ins verified yet"}
              </span>
            </div>
          </Card>

          {/* Schedule & Cadence Card */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Schedule &amp; Dates</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-bold text-app-text-primary mt-2">
                Target: {project?.target_on ?? "Not Specified"}
              </div>
              <div className="text-xs text-app-text-secondary mt-1">
                Started: {project?.start_on ?? "Not Specified"}
              </div>
            </div>
            <div className="mt-4 text-[11px] text-app-text-muted pt-2 border-t border-app-border">
              Timezone: <strong>{project?.timezone || "UTC"}</strong>
            </div>
          </Card>

          {/* Health & Zero Tasks Notice Card */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Individual Mode</span>
                <Badge variant="outline">{project?.lifecycle.replace("_", " ") ?? "Loading"}</Badge>
              </div>
              <div className="text-sm font-semibold text-app-text-primary mt-2">
                Zero Mandatory Tasks
              </div>
              <p className="text-xs text-app-text-secondary mt-1">
                Tasks are optional. Progress is tracked exclusively via verified developer check-ins and GitHub code evidence.
              </p>
            </div>
            <div className="mt-3 text-[10px] text-app-text-muted pt-2 border-t border-app-border">
              {currentPercent === 100
                ? "100% progress recorded. Active until formal sign-off."
                : currentPercent === null
                ? "No approved progress has been reported yet."
                : `${(100 - currentPercent).toFixed(1)}% remaining to complete.`}
            </div>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Latest Accepted Check-In
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Audit Trail &amp; History ({checkIns.length})
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "evidence"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            GitHub Activity &amp; Repositories ({gitHubActivity.length})
          </button>
          <button
            onClick={() => setActiveTab("delivery")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "delivery"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Delivery &amp; Lifecycle ({acceptanceRequests.length})
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div>
            {latestAccepted ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-app-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-app-text-primary">
                        Revision v{latestAccepted.revision_seq} ({latestAccepted.percent}%)
                      </h3>
                      <Badge variant="success">Approved</Badge>
                      <span className="text-[11px] text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                        Developer reported
                      </span>
                    </div>
                    <span className="text-xs text-app-text-muted">
                      Submitted {new Date(latestAccepted.submitted_at).toLocaleString()} by {latestAccepted.author.email ?? "Unknown"}
                    </span>
                  </div>
                  {latestAccepted.decided_by?.email && (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      Approved by {latestAccepted.decided_by.email}
                    </span>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="font-semibold text-app-text-primary block mb-1">
                      Work Accomplished:
                    </span>
                    <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed whitespace-pre-wrap">
                      {latestAccepted.accomplished}
                    </p>
                  </div>

                  <div>
                    <span className="font-semibold text-app-text-primary block mb-1">
                      Next Planned Steps:
                    </span>
                    <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed whitespace-pre-wrap">
                      {latestAccepted.next_steps}
                    </p>
                  </div>

                  {latestAccepted.downward_reason && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                      <span className="font-bold">Downward Revision Reason:</span>{" "}
                      {latestAccepted.downward_reason}
                    </div>
                  )}

                  {latestAccepted.decision_reason && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
                      <span className="font-bold">Decision note:</span>{" "}
                      {latestAccepted.decision_reason}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="rounded-xl border border-dashed border-app-border p-8 text-center bg-app-surface">
                <Clock className="w-8 h-8 text-app-text-muted mx-auto mb-2 opacity-50" />
                <h4 className="text-sm font-medium text-app-text-primary">
                  No Accepted Progress Check-In
                </h4>
                <p className="text-xs text-app-text-secondary mt-1">
                  Submit a check-in to establish the initial project progress baseline.
                </p>
                <Button size="sm" className="mt-4" disabled={isArchived} onClick={() => setIsCheckInModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Submit Check-In
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Append-Only History */}
        {activeTab === "history" && (
          <CheckInAuditTrail
            checkIns={checkIns}
            currentProjectPercent={currentPercent}
            projectKey={project?.key ?? projectId}
            projectName={project?.name ?? ""}
            canReview={false}
            onRefresh={handleRefreshAll}
          />
        )}

        {/* Tab 3: Evidence & Repositories */}
        {activeTab === "evidence" && (
          <Card className="p-5 space-y-4">
            <div>
              <CardTitle className="text-sm">Linked GitHub Commits &amp; Activity</CardTitle>
              <CardDescription>
                Recent git commits and pull request events linked to this project. GitHub commits serve as supporting evidence and do not automatically advance progress.
              </CardDescription>
            </div>

            {gitHubActivity.length > 0 ? (
              <div className="space-y-2">
                {gitHubActivity.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg border border-app-border bg-app-sidebar/40 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitCommit className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      {act.sha && (
                        <span className="font-mono text-[11px] bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          {act.sha.substring(0, 7)}
                        </span>
                      )}
                      <span className="font-medium text-app-text-primary truncate">{act.title}</span>
                      <span className="text-[10px] text-app-text-muted">by {act.actor}</span>
                    </div>
                    <span className="text-[10px] text-app-text-muted whitespace-nowrap ml-2">
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-app-text-muted italic py-4 text-center">
                No recent GitHub commits or PRs recorded.
              </p>
            )}
          </Card>
        )}

        {/* Tab 4: Delivery & Lifecycle (Task 2.4) */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            {/* Delivery Requests Card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Delivery Acceptance Requests ({acceptanceRequests.length})</CardTitle>
                  <CardDescription>
                    Formal delivery acceptance submissions with checklists and evidence.
                  </CardDescription>
                </div>
                {currentPercent !== null && currentPercent >= 100 && currentLifecycle === "ACTIVE" && !isArchived && (
                  <Button size="sm" onClick={() => setIsAcceptanceModalOpen(true)}>
                    <PackageCheck className="w-3.5 h-3.5 mr-1" /> New Delivery Request
                  </Button>
                )}
              </div>

              {acceptanceRequests.length > 0 ? (
                <div className="space-y-4">
                  {acceptanceRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-lg border border-app-border bg-app-sidebar/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-300">[{req.id}]</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              req.status === "ACCEPTED"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : req.status === "PENDING"
                                ? "bg-blue-950 text-blue-300 border border-blue-800"
                                : "bg-red-950 text-red-300 border border-red-800"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <span className="text-xs text-app-text-muted">
                          {new Date(req.created_at).toLocaleString()} by {req.created_by_name || req.created_by}
                        </span>
                      </div>

                      {/* Checklist */}
                      <div className="bg-app-bg p-3 rounded border border-app-border text-xs space-y-1">
                        <span className="font-semibold text-app-text-primary block mb-1">Checklist:</span>
                        {req.checklist.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-zinc-300">
                            <span className={item.checked ? "text-emerald-400" : "text-zinc-600"}>
                              {item.checked ? "✓" : "○"}
                            </span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Evidence */}
                      {req.evidence_summary && (
                        <p className="text-xs text-app-text-secondary bg-app-bg p-2 rounded border border-app-border">
                          {req.evidence_summary}
                        </p>
                      )}

                      {/* Decisions */}
                      {req.decisions && req.decisions.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="font-semibold text-app-text-primary block">Review Decisions:</span>
                          {req.decisions.map((dec) => (
                            <div key={dec.id} className="p-2 rounded bg-app-bg border border-app-border space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-400">{dec.decision}</span>
                                <span className="text-app-text-muted">
                                  by {dec.actor_name || dec.actor_id} on {new Date(dec.decided_at).toLocaleString()}
                                </span>
                              </div>
                              {dec.reason && <p className="text-zinc-300">&ldquo;{dec.reason}&rdquo;</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-app-text-muted italic py-4 text-center">
                  No delivery acceptance requests submitted yet.
                </p>
              )}
            </Card>

            {/* Lifecycle Transition History */}
            <Card className="p-5 space-y-3">
              <CardTitle className="text-sm">Lifecycle History &amp; Audit Trail</CardTitle>
              {lifecycleHistory.length > 0 ? (
                <div className="space-y-2">
                  {lifecycleHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg border border-app-border bg-app-sidebar/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="text-zinc-400">{h.previous_lifecycle || "None"}</span>
                        <span className="mx-2 text-zinc-600">→</span>
                        <span className="font-bold text-app-text-primary">{h.new_lifecycle}</span>
                        {h.reason && <span className="text-app-text-muted ml-2">({h.reason})</span>}
                      </div>
                      <span className="text-[10px] text-app-text-muted">
                        {new Date(h.created_at).toLocaleString()} by {h.actor_name || h.actor_id}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-app-text-muted italic py-2 text-center">No lifecycle transitions recorded.</p>
              )}
            </Card>

            {/* Closures */}
            {closures.length > 0 && (
              <Card className="p-5 space-y-3">
                <CardTitle className="text-sm">Project Closures</CardTitle>
                <div className="space-y-2">
                  {closures.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg border border-app-border bg-purple-950/20 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold text-purple-300">
                        <span>Closed by {c.actor_name || c.actor_id}</span>
                        <span className="text-app-text-muted">{new Date(c.closed_at).toLocaleString()}</span>
                      </div>
                      <p className="text-zinc-200"><strong>Handover Note:</strong> {c.handover_note}</p>
                      <p className="text-zinc-400"><strong>Reason:</strong> {c.reason}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Modals */}
        {project && (
          <>
            <CheckInSubmissionModal
              isOpen={isCheckInModalOpen}
              onClose={() => setIsCheckInModalOpen(false)}
              projectId={projectId}
              projectName={project.name}
              projectKey={project.key}
              currentPercent={currentPercent}
              gitHubActivity={gitHubActivity}
              onSubmitted={handleRefreshAll}
            />

            <DeliveryAcceptanceModal
              isOpen={isAcceptanceModalOpen}
              project={project}
              checkins={checkIns}
              onClose={() => setIsAcceptanceModalOpen(false)}
              onSubmit={async (data) => {
                await requestAcceptance(data);
                await handleRefreshAll();
                toast.success("Delivery acceptance request submitted.");
              }}
            />

            {latestRequest && (
              <DeliveryReviewModal
                isOpen={isReviewModalOpen}
                project={project}
                request={latestRequest}
                blockers={blockers}
                currentUserId={currentUser?.id}
                onClose={() => setIsReviewModalOpen(false)}
                onDecide={async (data) => {
                  await decideAcceptance(latestRequest.id, data);
                  await handleRefreshAll();
                  toast.success(`Delivery decision recorded: ${data.decision}`);
                }}
                onWaiveBlocker={async (blockerId, reason) => {
                  await waiveBlocker(blockerId, reason);
                  await handleRefreshAll();
                  toast.success("Blocker waiver approved.");
                }}
              />
            )}

            <ProjectClosureModal
              isOpen={isClosureModalOpen}
              project={project}
              onClose={() => setIsClosureModalOpen(false)}
              onCloseProject={async (data) => {
                await closeProject(data);
                await handleRefreshAll();
                toast.success("Project formally closed.");
              }}
            />

            <BlockerManagementModal
              isOpen={isBlockersModalOpen}
              project={project}
              blockers={blockers}
              onClose={() => setIsBlockersModalOpen(false)}
              onCreateBlocker={async (data) => {
                await createBlocker(data);
                await handleRefreshAll();
                toast.success("Blocker reported.");
              }}
              onWaiveBlocker={async (blockerId, reason) => {
                await waiveBlocker(blockerId, reason);
                await handleRefreshAll();
                toast.success("Blocker waived.");
              }}
              onResolveBlocker={async (blockerId) => {
                await resolveBlocker(blockerId);
                await handleRefreshAll();
                toast.success("Blocker resolved.");
              }}
            />
          </>
        )}
      </div>
    </PanelLayout>
  );
}
