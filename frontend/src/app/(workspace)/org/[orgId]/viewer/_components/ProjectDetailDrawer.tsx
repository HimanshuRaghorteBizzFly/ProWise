"use client";

import React from "react";
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

  if (!project) return null;

  const milestones = getViewerMilestones(project.orgId, project.id);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-app-surface border-l border-app-border h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-app-border flex items-center justify-between bg-app-sidebar/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {project.key}
                </span>
                <Badge variant={project.lifecycle === "ACTIVE" ? "success" : "secondary"}>
                  {project.lifecycle}
                </Badge>
                <ReadOnlyBadge />
              </div>
              <h2 className="text-base font-bold text-app-text-primary mt-0.5 line-clamp-1">
                {project.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Read-Only Notice */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-app-border flex items-start gap-2.5 text-xs text-app-text-secondary">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-app-text-primary">Stakeholder Read-Only Scope:</span>{" "}
              You have authorized viewing rights for project delivery status, milestones, and governance health. No editing or approval permissions.
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
              Initiative Overview
            </h3>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-app-bg border border-app-border">
              <div className="text-[11px] text-app-text-muted flex items-center justify-between">
                <span>Current Progress</span>
                <SimulatedMetricBadge />
              </div>
              <div className="text-xl font-bold text-app-text-primary mt-1">
                {project.lastProgressPercent}%
              </div>
              <div className="w-full mt-2">
                <ProgressBar value={project.lastProgressPercent} size="sm" />
              </div>
              <div className="text-[10px] text-app-text-muted mt-1.5">
                Method: {project.lastProgressMethod.replace("_", " ")}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-app-bg border border-app-border">
              <div className="text-[11px] text-app-text-muted">Health Assessment</div>
              <div className="mt-1">
                <HealthBadge health={project.health} />
              </div>
              <div className="text-[11px] text-app-text-secondary mt-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-app-text-muted" />
                <span>Target: {project.targetDate}</span>
              </div>
            </div>
          </div>

          {/* Health Analysis Reasons */}
          <div className="p-4 rounded-lg bg-app-bg border border-app-border space-y-2">
            <h3 className="text-xs font-semibold text-app-text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Governance &amp; Health Insights</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-app-text-secondary">
              {project.healthReasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Leadership & Teams */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Project Governance
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-app-border bg-app-bg">
                <div className="text-app-text-muted text-[10px]">Accountable Owner</div>
                <div className="font-semibold text-app-text-primary mt-0.5">
                  {project.accountableOwnerName}
                </div>
                <div className="text-[10px] text-app-text-muted">Primary Lead</div>
              </div>
              <div className="p-3 rounded-lg border border-app-border bg-app-bg">
                <div className="text-app-text-muted text-[10px]">Project Manager</div>
                <div className="font-semibold text-app-text-primary mt-0.5">
                  {project.projectManagerName}
                </div>
                <div className="text-[10px] text-app-text-muted">Delivery PM</div>
              </div>
            </div>
            <div className="text-xs text-app-text-secondary">
              Assigned Teams:{" "}
              <span className="font-medium text-app-text-primary">
                {project.teamNames.join(", ") || "General Engineering"}
              </span>{" "}
              ({project.memberCount} members)
            </div>
          </div>

          {/* Milestones Roadmap */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                Milestones &amp; Deliverables ({milestones.length})
              </h3>
              <span className="text-[11px] text-app-text-muted">
                {project.mode === "STRUCTURED" ? "Weighted Baseline" : "Self-Reported Cadence"}
              </span>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-app-text-muted">No explicit milestones defined.</p>
            ) : (
              <div className="space-y-2">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg border border-app-border bg-app-bg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600">{m.key}</span>
                        <span className="font-semibold text-app-text-primary">{m.title}</span>
                      </div>
                      <Badge variant={m.state === "DONE" ? "success" : "warning"}>
                        {m.state}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-app-text-secondary">{m.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-app-text-muted pt-1 border-t border-app-border/60">
                      <span>Points: {m.completedPoints} / {m.totalPoints}</span>
                      <span>Target: {m.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked Repositories */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Connected GitHub Evidence Repositories
            </h3>
            <div className="space-y-1.5">
              {project.repositoryNames.map((repo, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-app-border bg-app-bg text-xs"
                >
                  <div className="flex items-center gap-2 text-app-text-primary font-mono text-[11px]">
                    <GitBranch className="w-3.5 h-3.5 text-app-text-muted" />
                    <span>{repo}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Evidence Only
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-app-border bg-app-sidebar/50 flex items-center justify-between">
          <button
            onClick={exportProgressReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-app-border bg-app-surface text-app-text-primary hover:bg-app-hover transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Progress (CSV)</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
