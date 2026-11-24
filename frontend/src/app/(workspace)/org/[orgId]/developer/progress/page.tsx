"use client";

import { previewEnabled } from "@/lib/permissions";
import { ProgressListView, ProjectProgressPageView } from "@/components/work/ReviewViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

import React, { useState, useMemo, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { HealthBadge } from "@/components/ui/health-badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/Tabs";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck,
  FolderGit2,
  GitPullRequest,
  Info,
  Plus,
  Send,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Check,
  AlertCircle,
  HelpCircle,
  X,
  FileText,
  GitBranch,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { calculateStructuredProgress, validateCheckInSubmission } from "@/lib/progress";
import { Project, WorkItem, WorkItemState, Priority, ScopeBaseline, IndividualCheckIn } from "@/types";
import { developerApi } from "@/lib/developer-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function PreviewDeveloperProgressTrackerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const orgId = (params?.orgId as string) || "org-acme";
  const { currentUser, currentOrg } = useAuthStore();
  const {
    projects,
    workItems,
    baselines,
    checkIns,
    repositories,
    gitEvents,
    reviews,
    snapshots,
    submitCheckIn,
    updateWorkItemState,
    submitWorkItemForReview,
    addBlocker,
    resolveBlocker,
    requestDeliveryAcceptance,
  } = useProjectStore();

  // Determine active developer identity
  const currentDevId =
    currentUser?.id && currentUser.id !== "usr-viewer"
      ? currentUser.id
      : "usr-developer";
  const currentDevName =
    currentUser?.name && currentUser.id !== "usr-viewer"
      ? currentUser.name
      : "Alex Rivera (Developer)";

  // Selected project state
  const initialProjectId = searchParams.get("project");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

  // Sync selected project with URL search param
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    const url = new URL(window.location.href);
    if (projectId) {
      url.searchParams.set("project", projectId);
    } else {
      url.searchParams.delete("project");
    }
    window.history.replaceState({}, "", url.toString());
  };

  // Detail view active tab
  const [activeTab, setActiveTab] = useState<"overview" | "update" | "history">("overview");

  // Project cards filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "INDIVIDUAL" | "STRUCTURED">("ALL");
  const [filterHealth, setFilterHealth] = useState<"ALL" | "ON_TRACK" | "AT_RISK" | "DELAYED">("ALL");

  // Expandable phase / milestone cards state in detail view
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  // Structured mode modal states
  const [reviewTask, setReviewTask] = useState<WorkItem | null>(null);
  const [reviewEvidenceUrl, setReviewEvidenceUrl] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  const [blockerTask, setBlockerTask] = useState<WorkItem | null>(null);
  const [blockerReason, setBlockerReason] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState<Priority>("HIGH");

  // Individual mode check-in form state
  const [checkInPercent, setCheckInPercent] = useState<number>(0);
  const [checkInAccomplished, setCheckInAccomplished] = useState("");
  const [checkInNextSteps, setCheckInNextSteps] = useState("");
  const [checkInProjectedFinish, setCheckInProjectedFinish] = useState("");
  const [checkInEvidence, setCheckInEvidence] = useState("");
  const [checkInDownwardReason, setCheckInDownwardReason] = useState("");
  const [checkInBlockers, setCheckInBlockers] = useState<string[]>([]);
  const [newBlockerInput, setNewBlockerInput] = useState("");

  // Tooltip popover state
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);

  // Today reference date for overdue checks
  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Filter projects assigned to the logged-in developer
  const assignedProjects = useMemo(() => {
    // A project is assigned to this developer if:
    // 1. accountableOwnerId === currentDevId
    // 2. memberIds includes currentDevId
    // 3. workItems for that project have primaryAssigneeId === currentDevId or collaboratorIds includes currentDevId
    const devProjects = projects.filter((p) => {
      const isOwner = p.accountableOwnerId === currentDevId;
      const isMember = p.memberIds?.includes(currentDevId);
      const hasAssignedTask = workItems.some(
        (w) =>
          w.projectId === p.id &&
          (w.primaryAssigneeId === currentDevId || w.collaboratorIds?.includes(currentDevId))
      );
      return isOwner || isMember || hasAssignedTask;
    });

    // If for any reason no project matches the current session ID, fall back to developer projects in this org
    if (devProjects.length === 0) {
      return projects.filter(
        (p) =>
          p.accountableOwnerId === "usr-developer" ||
          p.memberIds?.includes("usr-developer") ||
          workItems.some(
            (w) =>
              w.projectId === p.id &&
              (w.primaryAssigneeId === "usr-developer" || w.collaboratorIds?.includes("usr-developer"))
          )
      );
    }
    return devProjects;
  }, [projects, workItems, currentDevId]);

  // Filtered project list for card display
  const filteredProjects = useMemo(() => {
    return assignedProjects.filter((p) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode = filterMode === "ALL" || p.mode === filterMode;
      const matchesHealth = filterHealth === "ALL" || p.health === filterHealth;
      return matchesSearch && matchesMode && matchesHealth;
    });
  }, [assignedProjects, searchQuery, filterMode, filterHealth]);

  // Selected project object
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Check-ins for selected project
  const projectCheckIns = useMemo(() => {
    if (!selectedProject) return [];
    return checkIns
      .filter((c) => c.projectId === selectedProject.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [checkIns, selectedProject]);

  const latestAcceptedCheckIn = useMemo(() => {
    return projectCheckIns.find((c) => c.verificationStatus === "ACCEPTED") || projectCheckIns[0];
  }, [projectCheckIns]);

  // Active baseline for selected project
  const activeBaseline = useMemo(() => {
    if (!selectedProject) return null;
    return (
      baselines.find((b) => b.projectId === selectedProject.id && !b.supersededAt) ||
      baselines.find((b) => b.id === selectedProject.activeBaselineId) ||
      null
    );
  }, [baselines, selectedProject]);

  // Work items for selected project
  const projectWorkItems = useMemo(() => {
    if (!selectedProject) return [];
    return workItems.filter((w) => w.projectId === selectedProject.id);
  }, [workItems, selectedProject]);

  // Work items assigned to the developer for selected project
  const developerTasks = useMemo(() => {
    return projectWorkItems.filter(
      (w) =>
        w.primaryAssigneeId === currentDevId ||
        w.collaboratorIds?.includes(currentDevId) ||
        w.primaryAssigneeId === "usr-developer"
    );
  }, [projectWorkItems, currentDevId]);

  // Structured mode progress calculation for selected project
  const structuredProgress = useMemo(() => {
    if (!selectedProject || selectedProject.mode !== "STRUCTURED") return null;
    return calculateStructuredProgress(activeBaseline, projectWorkItems);
  }, [selectedProject, activeBaseline, projectWorkItems]);

  // Calculate project completion percent
  const getProjectProgressData = (project: Project) => {
    if (project.mode === "STRUCTURED") {
      const baseline =
        baselines.find((b) => b.projectId === project.id && !b.supersededAt) ||
        baselines.find((b) => b.id === project.activeBaselineId);
      const items = workItems.filter((w) => w.projectId === project.id);
      const calc = calculateStructuredProgress(baseline, items);
      const percent = calc.isMeasurable ? Math.round(calc.percentage) : project.lastProgressPercent;
      const remaining = Math.max(0, 100 - (percent >= 0 ? percent : 0));
      return {
        percent: percent >= 0 ? percent : 0,
        isNotReported: percent < 0,
        remaining,
        numerator: calc.numerator,
        denominator: calc.denominator,
        unit: baseline?.unit || "pts",
      };
    } else {
      const percent = project.lastProgressPercent;
      const isNotReported = percent < 0;
      const safePercent = isNotReported ? 0 : percent;
      return {
        percent: safePercent,
        isNotReported,
        remaining: Math.max(0, 100 - safePercent),
        numerator: safePercent,
        denominator: 100,
        unit: "%",
      };
    }
  };

  // Calculate blocked and overdue task counts for any project
  const getProjectBlockerAndOverdueCounts = (project: Project) => {
    const items = workItems.filter((w) => w.projectId === project.id);
    const blockedCount = items.filter((w) => w.isBlocked || (w.blockers && w.blockers.length > 0)).length;
    const overdueCount = items.filter(
      (w) => w.state !== "DONE" && w.dueDate && w.dueDate < todayStr
    ).length;

    // For individual mode, also check latest check-in blockers and project deadline
    if (project.mode === "INDIVIDUAL") {
      const pCheckIns = checkIns.filter((c) => c.projectId === project.id);
      const latest = pCheckIns.sort((a, b) => b.version - a.version)[0];
      const checkInBlockersCount = latest?.blockers?.length || 0;
      const isProjectOverdue =
        project.targetDate &&
        project.targetDate < todayStr &&
        project.lifecycle !== "DELIVERED" &&
        project.lifecycle !== "CLOSED";

      return {
        blockedCount: Math.max(blockedCount, checkInBlockersCount),
        overdueCount: isProjectOverdue ? 1 : 0,
      };
    }

    return { blockedCount, overdueCount };
  };

  // Populate individual check-in form when selected project changes
  useEffect(() => {
    if (selectedProject && selectedProject.mode === "INDIVIDUAL") {
      const latest = latestAcceptedCheckIn;
      setCheckInPercent(latest ? latest.percent : selectedProject.lastProgressPercent >= 0 ? selectedProject.lastProgressPercent : 0);
      setCheckInAccomplished("");
      setCheckInNextSteps("");
      setCheckInProjectedFinish(selectedProject.targetDate || "2026-11-20");
      setCheckInEvidence("");
      setCheckInDownwardReason("");
      setCheckInBlockers(latest?.blockers ? [...latest.blockers] : []);
    }
  }, [selectedProject, latestAcceptedCheckIn]);

  // Handle individual check-in submission
  const handleSubmitCheckInForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const previousPercent = latestAcceptedCheckIn ? latestAcceptedCheckIn.percent : 0;
    const isDownward = checkInPercent < previousPercent;

    const validation = validateCheckInSubmission({
      newPercent: checkInPercent,
      previousAcceptedPercent: previousPercent,
      downwardRevisionReason: checkInDownwardReason,
      accomplishedSummary: checkInAccomplished,
      nextStepsSummary: checkInNextSteps,
      targetFinishDate: checkInProjectedFinish,
    });

    if (!validation.isValid) {
      toast.error(validation.errorMessage || "Validation failed for progress update");
      return;
    }

    const res = submitCheckIn(
      selectedProject.id,
      currentDevId,
      checkInPercent,
      checkInAccomplished,
      checkInNextSteps,
      checkInBlockers,
      checkInProjectedFinish,
      checkInEvidence || undefined,
      isDownward ? checkInDownwardReason : undefined
    );

    // Synchronize check-in to PostgreSQL backend
    developerApi.submitCheckIn({
      projectId: selectedProject.id,
      percent: checkInPercent,
      accomplished: checkInAccomplished,
      nextSteps: checkInNextSteps,
      blockers: checkInBlockers.join("; "),
      risks: isDownward ? checkInDownwardReason : undefined,
    }).catch((err) => {
      console.warn("Backend check-in sync failed (using local state):", err);
    });

    if (res.success) {
      toast.success(
        `Check-in v${(latestAcceptedCheckIn?.version || 0) + 1} recorded successfully! Progress set to ${checkInPercent}%.`
      );
      setCheckInAccomplished("");
      setCheckInNextSteps("");
      setCheckInDownwardReason("");
      setActiveTab("overview");
    } else {
      toast.error(res.error || "Failed to record progress check-in.");
    }
  };

  // Handle requesting delivery acceptance review
  const handleRequestDeliveryAcceptance = () => {
    if (!selectedProject) return;
    try {
      requestDeliveryAcceptance(selectedProject.id, currentDevId);
      toast.success("Delivery Acceptance Review requested! Project Manager and stakeholders have been notified.");
    } catch {
      toast.error("Failed to request delivery acceptance review.");
    }
  };

  // Structured mode: Task state transitions
  const handleMoveTaskState = (task: WorkItem, targetState: WorkItemState) => {
    if (targetState === "DONE" && task.state !== "IN_REVIEW") {
      toast.error("Definition of Done: Task must first be submitted for QA review and approved.");
      return;
    }

    if (targetState === "IN_REVIEW") {
      setReviewTask(task);
      setReviewEvidenceUrl("");
      setReviewComment("");
      return;
    }

    updateWorkItemState(task.id, targetState, currentDevId);
    developerApi.updateTaskStatus(task.id, targetState, `Moved to ${targetState}`).catch((err) => {
      console.warn("Backend task status sync failed:", err);
    });
    toast.info(`Task ${task.key} moved to ${targetState.replace("_", " ")}.`);
  };

  // Confirm submit task for QA review
  const handleConfirmSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTask) return;

    submitWorkItemForReview(reviewTask.id, currentDevId);
    developerApi.updateTaskStatus(reviewTask.id, "IN_REVIEW", reviewComment || "Submitted for QA review").catch((err) => {
      console.warn("Backend review status sync failed:", err);
    });
    toast.success(
      `Task ${reviewTask.key} submitted for QA review (rev ${reviewTask.currentRevision + 1}). Evidence link recorded.`
    );
    setReviewTask(null);
  };

  // Handle adding blocker to task
  const handleConfirmAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockerTask || !blockerReason.trim()) return;

    addBlocker(blockerTask.id, blockerReason.trim(), blockerSeverity, currentDevId);
    developerApi.submitBlocker(blockerTask.id, blockerReason.trim(), blockerSeverity).catch((err) => {
      console.warn("Backend blocker submission sync failed:", err);
    });
    toast.warning(`Blocker recorded on ${blockerTask.key}. Health monitor updated.`);
    setBlockerTask(null);
    setBlockerReason("");
  };

  // Handle resolving blocker
  const handleResolveBlocker = (task: WorkItem, blockerId: string) => {
    resolveBlocker(task.id, blockerId);
    developerApi.resolveBlocker(blockerId).catch((err) => {
      console.warn("Backend blocker resolution sync failed:", err);
    });
    toast.success(`Blocker resolved on ${task.key}.`);
  };

  // Milestone hierarchy for structured mode detail view
  const projectMilestones = useMemo(() => {
    if (!selectedProject || selectedProject.mode !== "STRUCTURED") return [];
    const milestones = projectWorkItems.filter((w) => w.type === "MILESTONE");

    return milestones.map((m) => {
      const childTasks = projectWorkItems.filter((w) => w.parentId === m.id);
      const totalWeight = childTasks.reduce((sum, t) => sum + (t.weight || 0), 0);
      const doneWeight = childTasks
        .filter((t) => t.state === "DONE")
        .reduce((sum, t) => sum + (t.weight || 0), 0);
      const phasePercent = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

      return {
        milestone: m,
        tasks: childTasks,
        totalWeight,
        doneWeight,
        phasePercent,
      };
    });
  }, [selectedProject, projectWorkItems]);

  // Phase milestones for individual mode
  const individualPhases = useMemo(() => {
    if (!selectedProject || selectedProject.mode !== "INDIVIDUAL") return [];
    return [
      {
        id: "phase-1",
        title: "Foundation & Architecture Specification",
        description: "Initial microservice scaffolding, OAuth2 authentication, and FHIR resource schemas.",
        weight: 30,
        status: (selectedProject.lastProgressPercent >= 30 ? "DONE" : "IN_PROGRESS") as WorkItemState,
        completionDate: "2026-10-25",
      },
      {
        id: "phase-2",
        title: "Service Implementation & Ingest Pipeline",
        description: "Patient resource validation, HL7 payload parser, and webhook event streaming.",
        weight: 40,
        status: (selectedProject.lastProgressPercent >= 70 ? "DONE" : selectedProject.lastProgressPercent >= 30 ? "IN_PROGRESS" : "TODO") as WorkItemState,
        targetDate: selectedProject.targetDate,
      },
      {
        id: "phase-3",
        title: "End-to-End Verification & Delivery Handover",
        description: "Integration test coverage, security compliance audit, and final stakeholder acceptance.",
        weight: 30,
        status: (selectedProject.lastProgressPercent >= 100 ? "DONE" : "TODO") as WorkItemState,
        targetDate: selectedProject.targetDate,
      },
    ];
  }, [selectedProject]);

  return (
    <PanelLayout
      title="Personal Progress Tracker"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: "Progress Tracker" },
        ...(selectedProject ? [{ label: selectedProject.name }] : []),
      ]}
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* VIEW 1: PROJECT CARDS GRID (When no project is selected)                 */}
        {/* ========================================================================= */}
        {!selectedProject ? (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold tracking-tight text-app-text-primary">
                    Assigned Project Trackers
                  </h1>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold text-xs px-2.5 py-0.5">
                    {assignedProjects.length} Active {assignedProjects.length === 1 ? "Project" : "Projects"}
                  </span>
                </div>
                <p className="text-xs text-app-text-secondary">
                  Track delivery progress, check-in deadlines, and work item status for {currentDevName}.
                </p>
              </div>

              {/* Search & Mode Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] sm:min-w-[240px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                  <Input
                    placeholder="Search assigned projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9 bg-app-surface"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center border border-app-border rounded-lg p-0.5 bg-app-surface text-xs">
                  <button
                    onClick={() => setFilterMode("ALL")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      filterMode === "ALL"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-app-text-secondary hover:text-app-text-primary"
                    )}
                  >
                    All Modes
                  </button>
                  <button
                    onClick={() => setFilterMode("INDIVIDUAL")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      filterMode === "INDIVIDUAL"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-app-text-secondary hover:text-app-text-primary"
                    )}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setFilterMode("STRUCTURED")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      filterMode === "STRUCTURED"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-app-text-secondary hover:text-app-text-primary"
                    )}
                  >
                    Structured
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-12 text-center">
                <FolderGit2 className="w-10 h-10 text-app-text-muted mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-semibold text-app-text-primary">No Matching Projects Found</h3>
                <p className="text-xs text-app-text-secondary mt-1 max-w-md mx-auto">
                  {searchQuery || filterMode !== "ALL"
                    ? "Try adjusting your search criteria or mode filter above to view other projects."
                    : "You currently have no projects assigned to your developer profile in this workspace."}
                </p>
                {(searchQuery || filterMode !== "ALL") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 text-xs"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterMode("ALL");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              /* Responsive Project Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {filteredProjects.map((p) => {
                  const progressData = getProjectProgressData(p);
                  const { blockedCount, overdueCount } = getProjectBlockerAndOverdueCounts(p);
                  const isIndividual = p.mode === "INDIVIDUAL";

                  return (
                    <Card
                      key={p.id}
                      className={cn(
                        "flex flex-col justify-between border border-app-border bg-app-surface hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-subtle hover:shadow-md rounded-xl p-5"
                      )}
                    >
                      {/* Top Row: Key, Mode & Status */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded">
                              {p.key}
                            </span>
                            <span
                              className={cn(
                                "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                isIndividual
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                                  : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                              )}
                            >
                              {isIndividual ? "Individual Mode" : "Structured Mode"}
                            </span>
                          </div>
                          <HealthBadge health={p.health} />
                        </div>

                        {/* Title and Description */}
                        <div>
                          <h3 className="font-bold text-base text-app-text-primary line-clamp-1">{p.name}</h3>
                          <p className="text-xs text-app-text-secondary line-clamp-2 mt-1 leading-relaxed">
                            {p.description}
                          </p>
                        </div>

                        {/* Progress Section */}
                        <div className="space-y-1.5 pt-2 border-t border-app-border">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-app-text-secondary">Completion Progress</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-app-text-primary">
                                {progressData.isNotReported ? "Not Reported" : `${progressData.percent}%`}
                              </span>
                              {!isIndividual && (
                                <span className="text-[11px] text-app-text-muted">
                                  ({progressData.numerator}/{progressData.denominator} {progressData.unit})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <ProgressBar
                            value={progressData.percent}
                            isNotReported={progressData.isNotReported}
                            status={
                              p.health === "DELAYED"
                                ? "danger"
                                : p.health === "AT_RISK"
                                ? "warning"
                                : progressData.percent >= 100
                                ? "success"
                                : "default"
                            }
                            size="md"
                          />

                          <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-0.5">
                            <span>
                              {progressData.isNotReported
                                ? "Check-in pending"
                                : `${progressData.remaining}% remaining`}
                            </span>
                            <span className="capitalize">{p.lifecycle.toLowerCase()}</span>
                          </div>
                        </div>

                        {/* Deadline & Blocked / Overdue Counts */}
                        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-app-border text-xs">
                          <div className="flex items-center gap-1.5 text-app-text-secondary">
                            <Calendar className="w-3.5 h-3.5 text-app-text-muted shrink-0" />
                            <span className="truncate">
                              Due: <strong className="text-app-text-primary">{p.targetDate}</strong>
                            </span>
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            {blockedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[11px] font-semibold">
                                <AlertTriangle className="w-3 h-3" /> {blockedCount} blocked
                              </span>
                            ) : overdueCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[11px] font-semibold">
                                <Clock className="w-3 h-3" /> {overdueCount} overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 text-app-text-secondary px-1.5 py-0.5 text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" /> All clear
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Action */}
                      <div className="pt-4 mt-3 border-t border-app-border flex items-center justify-between">
                        <span className="text-[11px] text-app-text-muted">
                          {isIndividual ? "Solo Check-In Cadence" : "QA Baseline Formula"}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleSelectProject(p.id)}
                          className="text-xs h-8 px-3 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                        >
                          <span>View Progress</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: SELECTED PROJECT DETAIL TRACKER                                  */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Top Navigation Bar: Back Action & Project Summary */}
            <div className="rounded-xl border border-app-border bg-app-surface p-5 shadow-subtle space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectProject(null)}
                  className="text-xs self-start gap-1.5 text-app-text-secondary hover:text-app-text-primary"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Projects</span>
                </Button>

                <div className="flex items-center gap-2">
                  {/* Calculation Methodology Tooltip Button (Requirement 9) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCalculationInfo(!showCalculationInfo)}
                      aria-label="Progress calculation explanation"
                      className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs text-app-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Calculation Logic</span>
                    </button>

                    {showCalculationInfo && (
                      <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-app-border bg-app-surface p-4 shadow-xl text-xs space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-app-border">
                          <span className="font-bold text-app-text-primary flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-blue-600" />
                            {selectedProject.mode === "INDIVIDUAL" ? "Individual Mode Rules" : "Structured Baseline Formula"}
                          </span>
                          <button
                            onClick={() => setShowCalculationInfo(false)}
                            className="text-app-text-muted hover:text-app-text-primary"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {selectedProject.mode === "INDIVIDUAL" ? (
                          <div className="text-app-text-secondary space-y-1.5 leading-relaxed">
                            <p>
                              • Progress is <strong>self-reported</strong> by the sole accountable developer through periodic check-ins.
                            </p>
                            <p>
                              • Downward revisions (lowering percentage) <strong>strictly require an explanatory reason</strong>.
                            </p>
                            <p>
                              • Commits and pull requests are recorded as supporting evidence and never overwrite progress automatically.
                            </p>
                          </div>
                        ) : (
                          <div className="text-app-text-secondary space-y-1.5 leading-relaxed">
                            <p>
                              • Progress is mathematically derived from the approved baseline:
                            </p>
                            <div className="rounded bg-slate-100 dark:bg-slate-800 p-2 font-mono text-[11px] text-app-text-primary">
                              Progress % = Sum(Done Leaf Weights) ÷ Total Baseline Weight × 100
                            </div>
                            <p>
                              • Work items count toward completion <strong>only after QA inspection and approval</strong>.
                            </p>
                            <p>
                              • Manual editing of project completion is disabled.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <HealthBadge health={selectedProject.health} />
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded">
                      {selectedProject.key}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                        selectedProject.mode === "INDIVIDUAL"
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                          : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                      )}
                    >
                      {selectedProject.mode === "INDIVIDUAL" ? "Individual Mode" : "Structured Mode"}
                    </span>
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-app-text-secondary capitalize">
                      {selectedProject.lifecycle.toLowerCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-app-text-primary">{selectedProject.name}</h2>
                  <p className="text-xs text-app-text-secondary max-w-3xl leading-relaxed">
                    {selectedProject.description}
                  </p>
                </div>

                {/* Progress Metric Highlight Box */}
                <div className="rounded-xl bg-app-bg border border-app-border p-4 text-center min-w-[150px] shrink-0">
                  <span className="text-[10px] uppercase font-semibold text-app-text-muted">
                    {selectedProject.mode === "INDIVIDUAL" ? "Accepted Check-In" : "Baseline Progress"}
                  </span>
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedProject.mode === "STRUCTURED" && structuredProgress
                      ? `${Math.round(structuredProgress.percentage)}%`
                      : selectedProject.lastProgressPercent >= 0
                      ? `${selectedProject.lastProgressPercent}%`
                      : "0%"}
                  </div>
                  <span className="text-[11px] text-app-text-secondary block mt-0.5">
                    {selectedProject.mode === "STRUCTURED" && structuredProgress
                      ? `${structuredProgress.numerator} / ${structuredProgress.denominator} ${activeBaseline?.unit || "pts"}`
                      : `${Math.max(0, 100 - (selectedProject.lastProgressPercent >= 0 ? selectedProject.lastProgressPercent : 0))}% remaining`}
                  </span>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-app-border text-xs text-app-text-secondary">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-app-text-muted" />
                  <span>
                    Deadline: <strong>{selectedProject.targetDate}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-app-text-muted" />
                  <span>
                    Cadence: <strong>{selectedProject.cadence}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-app-text-muted" />
                  <span>
                    Accountable: <strong>{selectedProject.accountableOwnerId}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-app-text-muted" />
                  <span>
                    PM: <strong>{selectedProject.projectManagerId}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Overview / Update Progress / History) */}
            <Tabs
              tabs={[
                { id: "overview", label: "Overview", count: undefined },
                {
                  id: "update",
                  label: selectedProject.mode === "INDIVIDUAL" ? "Update Progress" : "Task Board & Updates",
                  count: selectedProject.mode === "STRUCTURED" ? developerTasks.length : undefined,
                },
                {
                  id: "history",
                  label: "Audit History",
                  count: selectedProject.mode === "INDIVIDUAL" ? projectCheckIns.length : undefined,
                },
              ]}
              activeTab={activeTab}
              onChange={(tabId) => setActiveTab(tabId as "overview" | "update" | "history")}
            />

            {/* TAB CONTENT 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4 bg-app-surface border-app-border">
                    <span className="text-[11px] text-app-text-muted font-medium">Completed Work</span>
                    <div className="text-2xl font-bold text-app-text-primary mt-1">
                      {selectedProject.mode === "STRUCTURED" && structuredProgress
                        ? `${Math.round(structuredProgress.percentage)}%`
                        : selectedProject.lastProgressPercent >= 0
                        ? `${selectedProject.lastProgressPercent}%`
                        : "0%"}
                    </div>
                    <div className="text-[11px] text-green-600 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {selectedProject.mode === "STRUCTURED"
                        ? `${structuredProgress?.numerator || 0} approved points`
                        : "Latest verified revision"}
                    </div>
                  </Card>

                  <Card className="p-4 bg-app-surface border-app-border">
                    <span className="text-[11px] text-app-text-muted font-medium">Remaining Scope</span>
                    <div className="text-2xl font-bold text-app-text-primary mt-1">
                      {selectedProject.mode === "STRUCTURED" && structuredProgress
                        ? `${Math.max(0, 100 - Math.round(structuredProgress.percentage))}%`
                        : selectedProject.lastProgressPercent >= 0
                        ? `${Math.max(0, 100 - selectedProject.lastProgressPercent)}%`
                        : "100%"}
                    </div>
                    <div className="text-[11px] text-app-text-secondary mt-1">
                      {selectedProject.mode === "STRUCTURED" && structuredProgress
                        ? `${structuredProgress.denominator - structuredProgress.numerator} pts remaining`
                        : "Pending delivery checklist"}
                    </div>
                  </Card>

                  <Card className="p-4 bg-app-surface border-app-border">
                    <span className="text-[11px] text-app-text-muted font-medium">Project Health & SLA</span>
                    <div className="text-xl font-bold text-app-text-primary mt-1 flex items-center gap-1.5">
                      <HealthBadge health={selectedProject.health} />
                    </div>
                    <div className="text-[11px] text-app-text-secondary mt-1">
                      {selectedProject.graceWorkingDays} day(s) grace period
                    </div>
                  </Card>

                  <Card className="p-4 bg-app-surface border-app-border">
                    <span className="text-[11px] text-app-text-muted font-medium">Blockers & Overdue</span>
                    <div className="text-2xl font-bold text-app-text-primary mt-1">
                      {getProjectBlockerAndOverdueCounts(selectedProject).blockedCount}
                    </div>
                    <div className="text-[11px] text-amber-600 font-medium mt-1">
                      {getProjectBlockerAndOverdueCounts(selectedProject).overdueCount} overdue item(s)
                    </div>
                  </Card>
                </div>

                {/* Progress Bar Visualizer */}
                <Card className="p-5 border-app-border bg-app-surface space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-app-text-primary">Delivery Milestone Trajectory</span>
                    <span className="font-mono text-xs text-app-text-secondary">
                      {selectedProject.mode === "STRUCTURED" && structuredProgress
                        ? `${structuredProgress.numerator} / ${structuredProgress.denominator} points`
                        : `${selectedProject.lastProgressPercent}% completion`}
                    </span>
                  </div>
                  <ProgressBar
                    value={
                      selectedProject.mode === "STRUCTURED" && structuredProgress
                        ? Math.round(structuredProgress.percentage)
                        : selectedProject.lastProgressPercent
                    }
                    size="lg"
                    status={selectedProject.health === "DELAYED" ? "danger" : "default"}
                  />
                </Card>

                {/* Individual Mode: Latest Accepted Check-in Details */}
                {selectedProject.mode === "INDIVIDUAL" && latestAcceptedCheckIn && (
                  <Card className="p-5 border-app-border bg-app-surface space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-app-border">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-sm text-app-text-primary">
                          Latest Verified Check-In (v{latestAcceptedCheckIn.version})
                        </h4>
                      </div>
                      <span className="rounded-full bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 text-xs font-semibold px-2.5 py-0.5">
                        Accepted by {latestAcceptedCheckIn.verifiedBy || "Manager"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase font-semibold text-app-text-muted">
                          Accomplished Summary
                        </span>
                        <p className="text-app-text-secondary bg-app-bg p-3 rounded-lg border border-app-border leading-relaxed">
                          {latestAcceptedCheckIn.accomplished}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] uppercase font-semibold text-app-text-muted">
                          Next Steps & Focus
                        </span>
                        <p className="text-app-text-secondary bg-app-bg p-3 rounded-lg border border-app-border leading-relaxed">
                          {latestAcceptedCheckIn.nextSteps}
                        </p>
                      </div>
                    </div>

                    {latestAcceptedCheckIn.optionalEvidence && (
                      <div className="pt-2 border-t border-app-border flex items-center gap-2 text-xs text-blue-600">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Attached Evidence:</span>
                        <a
                          href={latestAcceptedCheckIn.optionalEvidence}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono hover:underline truncate"
                        >
                          {latestAcceptedCheckIn.optionalEvidence}
                        </a>
                      </div>
                    )}
                  </Card>
                )}

                {/* Expandable Phase Cards / Milestones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-app-text-primary">
                        {selectedProject.mode === "STRUCTURED"
                          ? "Project Phases & Scope Baseline Milestones"
                          : "Delivery Phases & Progress Roadmap"}
                      </h4>
                      <p className="text-xs text-app-text-secondary">
                        Click on any phase to expand and inspect deliverables and task status.
                      </p>
                    </div>
                  </div>

                  {selectedProject.mode === "STRUCTURED" ? (
                    projectMilestones.length === 0 ? (
                      <div className="p-6 border border-dashed border-app-border rounded-xl text-center text-xs text-app-text-muted">
                        No milestone phases configured for this project.
                      </div>
                    ) : (
                      projectMilestones.map((phaseGroup) => {
                        const m = phaseGroup.milestone;
                        const isExpanded = expandedPhases[m.id] ?? true;

                        return (
                          <div
                            key={m.id}
                            className="rounded-xl border border-app-border bg-app-surface overflow-hidden shadow-subtle transition-all"
                          >
                            <button
                              onClick={() => togglePhase(m.id)}
                              className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-app-hover transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                                  <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                      {m.key}
                                    </span>
                                    <h5 className="font-bold text-sm text-app-text-primary">{m.title}</h5>
                                    <span
                                      className={cn(
                                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                        m.state === "DONE"
                                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                          : m.state === "IN_REVIEW"
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                      )}
                                    >
                                      {m.state.replace("_", " ")}
                                    </span>
                                  </div>
                                  <p className="text-xs text-app-text-secondary mt-0.5">{m.description}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                                <div className="text-right">
                                  <span className="text-xs font-bold text-app-text-primary">
                                    {phaseGroup.doneWeight} / {phaseGroup.totalWeight} pts ({phaseGroup.phasePercent}%)
                                  </span>
                                  <div className="w-24 mt-1">
                                    <ProgressBar value={phaseGroup.phasePercent} size="sm" />
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-app-text-muted" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-app-text-muted" />
                                )}
                              </div>
                            </button>

                            {/* Expanded Tasks List */}
                            {isExpanded && (
                              <div className="border-t border-app-border bg-app-bg/50 p-4 divide-y divide-app-border space-y-2">
                                {phaseGroup.tasks.length === 0 ? (
                                  <p className="text-xs text-app-text-muted py-2 text-center">
                                    No child deliverables assigned to this phase.
                                  </p>
                                ) : (
                                  phaseGroup.tasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-[11px] font-bold text-app-text-primary">
                                            {task.key}
                                          </span>
                                          <span className="font-medium text-app-text-primary">{task.title}</span>
                                          {task.isBlocked && (
                                            <span className="inline-flex items-center gap-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] px-1.5 py-0.2 font-semibold">
                                              <AlertTriangle className="w-2.5 h-2.5" /> Blocked
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-app-text-secondary">{task.description}</p>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-mono text-[11px] text-app-text-muted">
                                          {task.weight} pts
                                        </span>
                                        <span
                                          className={cn(
                                            "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                                            task.state === "DONE"
                                              ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                              : task.state === "IN_REVIEW"
                                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                              : task.state === "IN_PROGRESS"
                                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                          )}
                                        >
                                          {task.state.replace("_", " ")}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )
                  ) : (
                    /* Individual Mode: Deliverable Roadmap Cards */
                    individualPhases.map((phase) => {
                      const isExpanded = expandedPhases[phase.id] ?? true;

                      return (
                        <div
                          key={phase.id}
                          className="rounded-xl border border-app-border bg-app-surface overflow-hidden shadow-subtle"
                        >
                          <button
                            onClick={() => togglePhase(phase.id)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-app-hover transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "p-2 rounded-lg",
                                  phase.status === "DONE"
                                    ? "bg-green-50 text-green-600 dark:bg-green-950/60"
                                    : phase.status === "IN_PROGRESS"
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                                )}
                              >
                                {phase.status === "DONE" ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Clock className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-app-text-primary">{phase.title}</h5>
                                <p className="text-xs text-app-text-secondary mt-0.5">{phase.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-semibold",
                                  phase.status === "DONE"
                                    ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                    : phase.status === "IN_PROGRESS"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {phase.status === "DONE"
                                  ? "Completed"
                                  : phase.status === "IN_PROGRESS"
                                  ? "Active Phase"
                                  : "Planned"}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-app-text-muted" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-app-text-muted" />
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Linked Repository & Engineering Activity Evidence */}
                <div className="rounded-xl border border-app-border bg-app-surface p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-app-border">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-sm text-app-text-primary">
                        Repository Evidence & Activity Log
                      </h4>
                    </div>
                    <span className="text-[11px] text-app-text-muted">
                      Commits inform audits; baseline formula sets progress
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {gitEvents
                      .filter((e) => selectedProject.repositoryIds?.includes(e.repositoryId))
                      .slice(0, 4)
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-app-bg border border-app-border"
                        >
                          <div className="flex items-center gap-2.5">
                            <GitBranch className="w-3.5 h-3.5 text-app-text-muted" />
                            <div>
                              <span className="font-semibold text-app-text-primary">{event.title}</span>
                              <p className="text-[11px] text-app-text-secondary">{event.detail}</p>
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-app-text-muted">
                            {new Date(event.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    {gitEvents.filter((e) => selectedProject.repositoryIds?.includes(e.repositoryId)).length === 0 && (
                      <p className="text-xs text-app-text-muted py-2 text-center">
                        No recent git activity recorded for this project repository.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: UPDATE PROGRESS */}
            {activeTab === "update" && (
              <div className="space-y-6">
                {selectedProject.mode === "INDIVIDUAL" ? (
                  /* ========================================================= */
                  /* INDIVIDUAL MODE: CHECK-IN UPDATE FORM                    */
                  /* ========================================================= */
                  <Card className="p-6 border-app-border bg-app-surface space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-app-border">
                      <div>
                        <h3 className="text-base font-bold text-app-text-primary">
                          Submit Progress Check-In (Individual Mode)
                        </h3>
                        <p className="text-xs text-app-text-secondary mt-0.5">
                          Report completion %, accomplishments, next steps, and blockers for {selectedProject.name}.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-app-text-muted">Current Accepted:</span>
                        <div className="text-base font-bold text-blue-600">
                          {latestAcceptedCheckIn ? `${latestAcceptedCheckIn.percent}%` : "0%"}
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSubmitCheckInForm} className="space-y-4 text-xs">
                      {/* Percent slider and input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-app-text-primary">
                            New Completion Percentage: <strong className="text-blue-600">{checkInPercent}%</strong>
                          </label>
                          <span className="text-app-text-muted text-[11px]">
                            {checkInPercent < (latestAcceptedCheckIn?.percent || 0) && (
                              <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Downward Revision
                              </span>
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={checkInPercent}
                          onChange={(e) => setCheckInPercent(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      {/* Downward Revision Warning & Explanation Field */}
                      {latestAcceptedCheckIn && checkInPercent < latestAcceptedCheckIn.percent && (
                        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Downward Revision Explanation (Mandatory)</span>
                          </div>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            You are revising progress downward from {latestAcceptedCheckIn.percent}% to {checkInPercent}%.
                            Please provide a clear justification for this adjustment (minimum 5 characters).
                          </p>
                          <Textarea
                            value={checkInDownwardReason}
                            onChange={(e) => setCheckInDownwardReason(e.target.value)}
                            placeholder="Explain the scope increase, blocker, or reassessment that led to this downward revision..."
                            className="bg-white dark:bg-slate-900 text-xs min-h-[70px]"
                            required
                          />
                        </div>
                      )}

                      {/* Accomplishments */}
                      <div className="space-y-1">
                        <label className="font-semibold text-app-text-primary">
                          Accomplished Summary <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                          value={checkInAccomplished}
                          onChange={(e) => setCheckInAccomplished(e.target.value)}
                          placeholder="Summarize key tasks, features, schemas, or fixes completed during this sprint..."
                          className="text-xs min-h-[80px]"
                          required
                        />
                      </div>

                      {/* Next Steps */}
                      <div className="space-y-1">
                        <label className="font-semibold text-app-text-primary">Next Steps Planned</label>
                        <Textarea
                          value={checkInNextSteps}
                          onChange={(e) => setCheckInNextSteps(e.target.value)}
                          placeholder="Outline planned deliverables, testing goals, or PR submissions for the next check-in..."
                          className="text-xs min-h-[70px]"
                        />
                      </div>

                      {/* Target Finish & Evidence URL */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-semibold text-app-text-primary">Projected Target Finish Date</label>
                          <Input
                            type="date"
                            value={checkInProjectedFinish}
                            onChange={(e) => setCheckInProjectedFinish(e.target.value)}
                            className="text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-app-text-primary">Evidence Link / PR URL (Optional)</label>
                          <Input
                            type="url"
                            value={checkInEvidence}
                            onChange={(e) => setCheckInEvidence(e.target.value)}
                            placeholder="https://github.com/org/repo/pull/123"
                            className="text-xs"
                          />
                        </div>
                      </div>

                      {/* Active Blockers Manager */}
                      <div className="space-y-2 pt-2 border-t border-app-border">
                        <label className="font-semibold text-app-text-primary flex items-center justify-between">
                          <span>Reported Blockers ({checkInBlockers.length})</span>
                          <span className="text-app-text-muted text-[11px]">Add any impediments delaying delivery</span>
                        </label>

                        <div className="flex gap-2">
                          <Input
                            value={newBlockerInput}
                            onChange={(e) => setNewBlockerInput(e.target.value)}
                            placeholder="Describe blocker (e.g. Waiting on API credentials)..."
                            className="text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (newBlockerInput.trim()) {
                                  setCheckInBlockers([...checkInBlockers, newBlockerInput.trim()]);
                                  setNewBlockerInput("");
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (newBlockerInput.trim()) {
                                setCheckInBlockers([...checkInBlockers, newBlockerInput.trim()]);
                                setNewBlockerInput("");
                              }
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {checkInBlockers.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {checkInBlockers.map((b, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
                              >
                                <span className="flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {b}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCheckInBlockers(checkInBlockers.filter((_, i) => i !== idx))
                                  }
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-4 border-t border-app-border flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-app-text-muted">
                          Submissions create an immutable audit record and notify PM {selectedProject.projectManagerId}.
                        </p>
                        <div className="flex items-center gap-2">
                          {checkInPercent === 100 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleRequestDeliveryAcceptance}
                              className="text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-300 dark:border-green-800"
                            >
                              <FileCheck className="w-3.5 h-3.5 mr-1" />
                              Request Delivery Signoff
                            </Button>
                          )}
                          <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            Submit Check-In
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Card>
                ) : (
                  /* ========================================================= */
                  /* STRUCTURED MODE: ASSIGNED TASKS & QA REVIEW SUBMISSION   */
                  /* (Strict: No manual % editing permitted!)                 */
                  /* ========================================================= */
                  <div className="space-y-5">
                    {/* Notice explaining mathematical formula */}
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-start gap-3">
                      <Layers className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-purple-900 dark:text-purple-200 block">
                          Mathematical Scope Baseline: Manual % Adjustment Disabled
                        </span>
                        <p className="text-purple-800 dark:text-purple-300 leading-relaxed">
                          In Structured Mode, completion % is strictly calculated from verified completed tasks:
                          <strong className="ml-1">
                            {structuredProgress?.numerator || 0} of {structuredProgress?.denominator || 100} approved points ({Math.round(structuredProgress?.percentage || 0)}%)
                          </strong>.
                          To advance project progress, update your assigned tasks below and submit them with evidence for QA inspection.
                        </p>
                      </div>
                    </div>

                    {/* Assigned Tasks Worklist */}
                    <Card className="p-5 border-app-border bg-app-surface space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-app-border">
                        <div>
                          <h4 className="font-bold text-sm text-app-text-primary">
                            Assigned Tasks & Deliverables ({developerTasks.length})
                          </h4>
                          <p className="text-xs text-app-text-secondary">
                            Update workflow states, flag blockers, and submit completed revisions for QA approval.
                          </p>
                        </div>
                      </div>

                      {developerTasks.length === 0 ? (
                        <div className="p-8 border border-dashed border-app-border rounded-lg text-center text-xs text-app-text-muted">
                          No tasks directly assigned to your developer profile in this project.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {developerTasks.map((task) => (
                            <div
                              key={task.id}
                              className="rounded-xl border border-app-border bg-app-bg p-4 space-y-3 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-app-surface border border-app-border px-2 py-0.5 rounded">
                                    {task.key}
                                  </span>
                                  <h5 className="font-bold text-sm text-app-text-primary">{task.title}</h5>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-app-text-muted">
                                    {task.weight} {task.weightUnit}
                                  </span>
                                  <span className="text-[10px] text-app-text-muted">rev {task.currentRevision}</span>
                                  <span
                                    className={cn(
                                      "rounded px-2 py-0.5 text-[11px] font-semibold uppercase",
                                      task.state === "DONE"
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                        : task.state === "IN_REVIEW"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                        : task.state === "IN_PROGRESS"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    )}
                                  >
                                    {task.state.replace("_", " ")}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-app-text-secondary leading-relaxed">{task.description}</p>

                              {/* QA Acceptance Criteria */}
                              {task.criteria && (
                                <div className="rounded bg-app-surface p-2.5 border border-app-border text-[11px] text-app-text-secondary">
                                  <strong className="text-app-text-primary">Acceptance Criteria:</strong> {task.criteria}
                                </div>
                              )}

                              {/* Blocker alert if blocked */}
                              {task.isBlocked && task.blockers?.length > 0 && (
                                <div className="rounded bg-red-50 dark:bg-red-950/40 p-2.5 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Active Blocker:
                                    </span>
                                    <button
                                      onClick={() => handleResolveBlocker(task, task.blockers[0].id)}
                                      className="text-[11px] font-bold text-red-600 hover:underline"
                                    >
                                      Mark Resolved
                                    </button>
                                  </div>
                                  <p className="text-[11px]">{task.blockers[0].reason}</p>
                                </div>
                              )}

                              {/* Action Bar */}
                              <div className="pt-2 border-t border-app-border flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="text-app-text-muted">
                                  Due: <strong>{task.dueDate || "Not set"}</strong>
                                </span>

                                <div className="flex items-center gap-2">
                                  {task.state === "TODO" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMoveTaskState(task, "IN_PROGRESS")}
                                      className="text-xs h-7"
                                    >
                                      Start Working
                                    </Button>
                                  )}

                                  {task.state === "IN_PROGRESS" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setBlockerTask(task);
                                          setBlockerReason("");
                                        }}
                                        className="text-xs h-7 text-amber-700 dark:text-amber-300"
                                      >
                                        Flag Blocker
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleMoveTaskState(task, "IN_REVIEW")}
                                        className="text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white"
                                      >
                                        <Send className="w-3 h-3 mr-1" />
                                        Submit for QA Review
                                      </Button>
                                    </>
                                  )}

                                  {task.state === "IN_REVIEW" && (
                                    <span className="text-amber-600 font-medium inline-flex items-center gap-1 text-[11px]">
                                      <Clock className="w-3.5 h-3.5" /> Awaiting Reviewer Signoff
                                    </span>
                                  )}

                                  {task.state === "DONE" && (
                                    <span className="text-green-600 font-semibold inline-flex items-center gap-1 text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Approved
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: HISTORY */}
            {activeTab === "history" && (
              <div className="space-y-5">
                {selectedProject.mode === "INDIVIDUAL" ? (
                  /* ========================================================= */
                  /* INDIVIDUAL MODE: AUDIT LOG OF CHECK-INS                  */
                  /* ========================================================= */
                  <Card className="p-5 border-app-border bg-app-surface space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-app-border">
                      <div>
                        <h4 className="font-bold text-sm text-app-text-primary">
                          Recorded Progress Check-In History
                        </h4>
                        <p className="text-xs text-app-text-secondary">
                          Immutable audit trail of all check-in submissions and manager verifications.
                        </p>
                      </div>
                      <span className="text-xs text-app-text-muted">
                        {projectCheckIns.length} recorded entries
                      </span>
                    </div>

                    <div className="space-y-3">
                      {projectCheckIns.length === 0 ? (
                        <p className="text-xs text-app-text-muted py-6 text-center">
                          No check-in history recorded for this project yet.
                        </p>
                      ) : (
                        projectCheckIns.map((item) => {
                          const isDownward = Boolean(item.downwardRevisionReason);

                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-app-border bg-app-bg p-4 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base text-app-text-primary">
                                    {item.percent}%
                                  </span>
                                  <span className="font-mono text-xs text-app-text-muted">
                                    v{item.version}
                                  </span>
                                  {isDownward ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
                                      <TrendingDown className="w-3 h-3" /> Downward
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-1.5 py-0.5 text-[10px] font-semibold">
                                      <TrendingUp className="w-3 h-3" /> Progressed
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                      item.verificationStatus === "ACCEPTED"
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                        : item.verificationStatus === "REJECTED"
                                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                    )}
                                  >
                                    {item.verificationStatus.replace("_", " ")}
                                  </span>
                                  <span className="text-[11px] text-app-text-muted">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <p className="text-app-text-secondary leading-relaxed">
                                <strong className="text-app-text-primary">Accomplished:</strong> {item.accomplished}
                              </p>

                              {item.nextSteps && (
                                <p className="text-app-text-secondary leading-relaxed">
                                  <strong className="text-app-text-primary">Next Steps:</strong> {item.nextSteps}
                                </p>
                              )}

                              {isDownward && (
                                <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-2.5 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[11px]">
                                  <strong>Reason for downward revision:</strong> {item.downwardRevisionReason}
                                </div>
                              )}

                              {item.optionalEvidence && (
                                <div className="pt-1 flex items-center gap-1.5 text-blue-600 text-[11px]">
                                  <ExternalLink className="w-3 h-3" />
                                  <a href={item.optionalEvidence} target="_blank" rel="noreferrer" className="hover:underline">
                                    Evidence: {item.optionalEvidence}
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                ) : (
                  /* ========================================================= */
                  /* STRUCTURED MODE: BASELINE SCOPE LEAVES & WORK ITEM AUDIT */
                  /* ========================================================= */
                  <div className="space-y-5">
                    {/* Active Baseline Card */}
                    <Card className="p-5 border-app-border bg-app-surface space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-app-border">
                        <div>
                          <h4 className="font-bold text-sm text-app-text-primary">
                            Scope Baseline Specification (v{activeBaseline?.version || 1})
                          </h4>
                          <p className="text-xs text-app-text-secondary">
                            Approved by {activeBaseline?.approvedBy || "Manager"} on{" "}
                            {activeBaseline?.approvedAt ? new Date(activeBaseline.approvedAt).toLocaleDateString() : "Schedule"}
                          </p>
                        </div>
                        <span className="rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5">
                          Total Weight: {activeBaseline?.totalWeight || 100} {activeBaseline?.unit || "pts"}
                        </span>
                      </div>

                      <div className="divide-y divide-app-border border border-app-border rounded-lg overflow-hidden">
                        {activeBaseline?.leaves.map((leaf) => {
                          const item = workItems.find((w) => w.id === leaf.workItemId);
                          const isDone = item ? item.state === "DONE" : leaf.isDone;

                          return (
                            <div key={leaf.workItemId} className="flex items-center justify-between p-3 text-xs bg-app-bg">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    isDone ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                                  )}
                                />
                                <span className="font-medium text-app-text-primary">{leaf.title}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-app-text-secondary">
                                  {leaf.weight} {activeBaseline.unit}
                                </span>
                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-[10px] font-semibold",
                                    isDone
                                      ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  )}
                                >
                                  {isDone ? "Approved" : "Pending"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Progress Snapshots History */}
                    <Card className="p-5 border-app-border bg-app-surface space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-app-border">
                        <h4 className="font-bold text-sm text-app-text-primary">
                          Mathematical Baseline Snapshots
                        </h4>
                        <span className="text-xs text-app-text-muted">Tamper-evident progress calculations</span>
                      </div>

                      <div className="space-y-2">
                        {snapshots
                          .filter((s) => s.projectId === selectedProject.id)
                          .map((snap) => (
                            <div
                              key={snap.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-app-bg border border-app-border text-xs"
                            >
                              <div className="space-y-0.5">
                                <span className="font-semibold text-app-text-primary">{snap.cause}</span>
                                <p className="text-[11px] text-app-text-secondary">
                                  Formula: {snap.numerator ?? snap.value} / {snap.denominator ?? 100} (
                                  {snap.method.replace("_", " ")})
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-sm text-blue-600">{snap.value}%</span>
                                <span className="block text-[10px] text-app-text-muted">
                                  {new Date(snap.instant).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        {snapshots.filter((s) => s.projectId === selectedProject.id).length === 0 && (
                          <p className="text-xs text-app-text-muted py-4 text-center">
                            No snapshots triggered yet for this project.
                          </p>
                        )}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT TASK FOR QA REVIEW                                         */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={Boolean(reviewTask)}
        onClose={() => setReviewTask(null)}
        title={`Submit ${reviewTask?.key} for QA Review`}
      >
        <form onSubmit={handleConfirmSubmitReview} className="space-y-4 text-xs">
          <p className="text-app-text-secondary leading-relaxed">
            Submitting <strong>{reviewTask?.title}</strong> (Weight: {reviewTask?.weight} {reviewTask?.weightUnit}) will transition it to <strong>IN_REVIEW</strong> and increment its revision to <strong>rev {(reviewTask?.currentRevision || 0) + 1}</strong>.
          </p>

          <div className="space-y-1">
            <label className="font-semibold text-app-text-primary">
              Supporting Pull Request or Artifact Link <span className="text-red-500">*</span>
            </label>
            <Input
              type="url"
              required
              placeholder="https://github.com/acme-health/repo/pull/42"
              value={reviewEvidenceUrl}
              onChange={(e) => setReviewEvidenceUrl(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-app-text-primary">Implementation Notes / Comments</label>
            <Textarea
              placeholder="Summary of changes, test coverage, and acceptance checklist verification..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="text-xs min-h-[70px]"
            />
          </div>

          <div className="pt-3 border-t border-app-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReviewTask(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              Confirm Submission
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: REPORT BLOCKER ON WORK ITEM                                       */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={Boolean(blockerTask)}
        onClose={() => setBlockerTask(null)}
        title={`Flag Blocker on ${blockerTask?.key}`}
      >
        <form onSubmit={handleConfirmAddBlocker} className="space-y-4 text-xs">
          <p className="text-app-text-secondary leading-relaxed">
            Record an impediment blocking progress on <strong>{blockerTask?.title}</strong>. This updates health monitoring immediately.
          </p>

          <div className="space-y-1">
            <label className="font-semibold text-app-text-primary">
              Blocker Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              required
              placeholder="Describe what is blocking this task (e.g. Database migration failure, missing upstream API contract)..."
              value={blockerReason}
              onChange={(e) => setBlockerReason(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-app-text-primary">Blocker Severity</label>
            <select
              value={blockerSeverity}
              onChange={(e) => setBlockerSeverity(e.target.value as Priority)}
              className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text-primary outline-none"
            >
              <option value="CRITICAL">Critical (Blocks core critical path)</option>
              <option value="HIGH">High (Major delay expected)</option>
              <option value="MEDIUM">Medium (Moderate impediment)</option>
              <option value="LOW">Low (Minor hindrance)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-app-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setBlockerTask(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              Flag Blocker
            </Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

/** Task 3.5: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function DeveloperProgressTrackerPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  if (previewEnabled()) return <PreviewDeveloperProgressTrackerPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProgressListView crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        projectHref={(p) => (p.mode === "STRUCTURED" ? `${home}/projects/${p.id}/structured/progress` : `${home}/projects/${p.id}/individual`)} />
    </RequireAnyKey>
  );
}
