"use client";

import React, { useEffect } from "react";
import {
  X,
  FolderGit2,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  GitBranch,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { ViewerProject } from "../_types";
import { HealthBadge } from "@/components/ui/health-badge";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ReadOnlyBadge, SimulatedMetricBadge } from "./ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { getViewerMilestones } from "../_services/viewer-service";

export function ProjectDetailDrawer({
  project,
  onClose,
}: {
  project: ViewerProject | null;
  onClose: () => void;
}) {
  const { exportProgressReport } = useViewerStore();

  // Close on Escape key
  useEffect(() => {
    if (!project) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (project) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [project]);

  if (!project) return null;

  const milestones = getViewerMilestones(project.orgId, project.id);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-app-surface border border-app-border rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-app-border flex items-center justify-between bg-app-sidebar/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60">
                  {project.key}
                </span>
                <Badge variant={project.lifecycle === "ACTIVE" ? "success" : "secondary"}>
                  {project.lifecycle}
                </Badge>
                <ReadOnlyBadge />
              </div>
              <h2
                id="project-detail-title"
                className="text-lg sm:text-xl font-bold text-app-text-primary tracking-tight truncate"
              >
                {project.name}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="hidden sm:inline-block text-[11px] text-app-text-muted font-mono px-1.5 py-0.5 rounded bg-app-hover border border-app-border">
              Esc
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Read-Only Notice Banner */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-app-border flex items-start gap-3 text-xs text-app-text-secondary leading-relaxed">
            <div className="p-1 rounded-md bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-app-text-primary">
                Stakeholder Read-Only Scope:
              </span>{" "}
              You have authorized viewing rights for project delivery status, milestones, and governance health. No editing or approval permissions.
            </div>
          </div>

          {/* Initiative Overview */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Initiative Overview
            </h3>
            <p className="text-sm text-app-text-secondary leading-relaxed bg-app-bg/60 p-3.5 rounded-xl border border-app-border/70">
              {project.description || "No project description provided."}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Progress Card */}
            <div className="p-4 rounded-xl bg-app-bg border border-app-border flex flex-col justify-between">
              <div>
                <div className="text-xs text-app-text-muted flex items-center justify-between">
                  <span className="font-medium">Current Progress</span>
                  <SimulatedMetricBadge />
                </div>
                <div className="text-3xl font-extrabold text-app-text-primary mt-2">
                  {project.lastProgressPercent}%
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={project.lastProgressPercent} size="md" />
                <div className="text-[11px] text-app-text-muted mt-2 flex items-center justify-between">
                  <span>Method</span>
                  <span className="font-mono font-medium text-app-text-secondary">
                    {project.lastProgressMethod.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Health Assessment Card */}
            <div className="p-4 rounded-xl bg-app-bg border border-app-border flex flex-col justify-between">
              <div>
                <div className="text-xs text-app-text-muted font-medium">Health Assessment</div>
                <div className="mt-2.5">
                  <HealthBadge health={project.health} />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-app-border/70 flex items-center justify-between text-xs text-app-text-secondary">
                <span className="flex items-center gap-1.5 text-app-text-muted">
                  <Calendar className="w-3.5 h-3.5" /> Target Date
                </span>
                <span className="font-semibold text-app-text-primary font-mono">
                  {project.targetDate}
                </span>
              </div>
            </div>
          </div>

          {/* Governance & Health Insights */}
          <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-2.5">
            <h3 className="text-xs font-semibold text-app-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Governance &amp; Health Insights</span>
            </h3>
            {project.healthReasons && project.healthReasons.length > 0 ? (
              <ul className="space-y-2 text-xs text-app-text-secondary">
                {project.healthReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-app-text-muted">No governance observations recorded.</p>
            )}
          </div>

          {/* Leadership & Teams */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Project Governance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-app-border bg-app-bg flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">
                    Accountable Owner
                  </div>
                  <div className="font-semibold text-app-text-primary mt-0.5 text-sm">
                    {project.accountableOwnerName}
                  </div>
                  <div className="text-[11px] text-app-text-muted">Primary Lead</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-app-border bg-app-bg flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">
                    Project Manager
                  </div>
                  <div className="font-semibold text-app-text-primary mt-0.5 text-sm">
                    {project.projectManagerName}
                  </div>
                  <div className="text-[11px] text-app-text-muted">Delivery PM</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl border border-app-border/80 bg-app-bg/50 text-xs text-app-text-secondary">
              <span className="text-app-text-muted font-medium">Assigned Teams:</span>
              <span className="font-semibold text-app-text-primary">
                {project.teamNames.join(", ") || "General Engineering"}
              </span>
              <span className="text-app-text-muted font-medium">
                ({project.memberCount} members)
              </span>
            </div>
          </div>

          {/* Milestones Roadmap */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                Milestones &amp; Deliverables ({milestones.length})
              </h3>
              <span className="text-[11px] text-app-text-muted font-medium bg-app-bg px-2 py-0.5 rounded border border-app-border">
                {project.mode === "STRUCTURED" ? "Weighted Baseline" : "Self-Reported Cadence"}
              </span>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-app-text-muted bg-app-bg p-4 rounded-xl border border-app-border text-center">
                No explicit milestones defined.
              </p>
            ) : (
              <div className="space-y-2.5">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-app-border bg-app-bg text-xs space-y-2 hover:border-blue-400/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {m.key}
                        </span>
                        <span className="font-semibold text-app-text-primary">{m.title}</span>
                      </div>
                      <Badge variant={m.state === "DONE" ? "success" : "warning"}>
                        {m.state}
                      </Badge>
                    </div>
                    <p className="text-xs text-app-text-secondary leading-relaxed">
                      {m.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-2 border-t border-app-border/60">
                      <span>
                        Points:{" "}
                        <strong className="text-app-text-primary font-semibold">
                          {m.completedPoints} / {m.totalPoints}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" /> Target: {m.dueDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked Repositories */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Connected GitHub Evidence Repositories
            </h3>
            <div className="space-y-2">
              {project.repositoryNames && project.repositoryNames.length > 0 ? (
                project.repositoryNames.map((repo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-bg text-xs"
                  >
                    <div className="flex items-center gap-2.5 text-app-text-primary font-mono text-xs">
                      <GitBranch className="w-4 h-4 text-blue-500" />
                      <span>{repo}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Evidence Only
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-app-text-muted bg-app-bg p-3 rounded-xl border border-app-border text-center">
                  No repositories connected.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-app-border bg-app-sidebar/60 flex items-center justify-between shrink-0">
          <button
            onClick={exportProgressReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-app-border bg-app-surface text-app-text-primary hover:bg-app-hover transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export Progress (CSV)</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
