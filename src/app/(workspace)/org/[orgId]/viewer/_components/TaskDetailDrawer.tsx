"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckSquare,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  GitPullRequest,
  Copy,
  Check,
} from "lucide-react";
import { ViewerTask } from "../_types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBadge, ViewerStatusBadge } from "./ViewerPrimitives";
import { toast } from "sonner";

export function TaskDetailDrawer({
  task,
  onClose,
}: {
  task: ViewerTask | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (task) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [task]);

  if (!task) return null;

  const handleCopyKey = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(task.key);
      setCopied(true);
      toast.success(`Copied ${task.key} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
      case "URGENT":
        return "danger";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStateTone = (state: string) => {
    switch (state) {
      case "DONE":
        return "success";
      case "IN_REVIEW":
        return "violet";
      case "IN_PROGRESS":
        return "info";
      default:
        return "neutral";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-app-surface border border-app-border rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-app-border flex items-center justify-between bg-app-sidebar/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                  title="Click to copy task key"
                >
                  <span>{task.key}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </button>
                <span className="text-xs text-app-text-muted truncate">
                  • {task.projectName || task.projectKey}
                </span>
                <ReadOnlyBadge />
              </div>
              <h2
                id="task-detail-title"
                className="text-lg sm:text-xl font-bold text-app-text-primary tracking-tight truncate"
              >
                {task.title}
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
              title="Close Details"
              aria-label="Close Details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs">
          {/* Read-Only Governance Notice */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-app-border flex items-start gap-3 text-xs text-app-text-secondary leading-relaxed">
            <div className="p-1 rounded-md bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-app-text-primary">
                Read-Only Work Item Inspection:
              </span>{" "}
              Task assignment, status transitions, criteria changes, and review signoffs are restricted to authorized engineers and project managers.
            </div>
          </div>

          {/* Status, Priority & Baseline Weight Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-app-bg border border-app-border text-center flex flex-col justify-between">
              <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                Workflow State
              </div>
              <div className="mt-2 flex justify-center">
                <ViewerStatusBadge
                  label={task.state.replace(/_/g, " ")}
                  tone={getStateTone(task.state)}
                  dot
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-app-bg border border-app-border text-center flex flex-col justify-between">
              <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                Priority
              </div>
              <div className="mt-2 flex justify-center">
                <ViewerStatusBadge
                  label={task.priority}
                  tone={getPriorityTone(task.priority)}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-app-bg border border-app-border text-center flex flex-col justify-between">
              <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                Baseline Weight
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-app-text-primary mt-1">
                {task.weight} {task.weightUnit || "points"}
              </div>
            </div>
          </div>

          {/* Task Description */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              Work Item Scope &amp; Description
            </h3>
            <div className="p-4 rounded-xl border border-app-border bg-app-bg text-app-text-primary text-xs sm:text-sm leading-relaxed">
              {task.description || "No description provided."}
            </div>
          </div>

          {/* Acceptance Criteria */}
          {task.criteria && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                Acceptance Criteria
              </h3>
              <div className="p-4 rounded-xl border border-app-border bg-app-bg/60 text-app-text-secondary leading-relaxed text-xs">
                {task.criteria}
              </div>
            </div>
          )}

          {/* Parent Milestone */}
          {task.parentTitle && (
            <div className="p-4 rounded-xl border border-app-border bg-app-bg text-xs space-y-1">
              <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                Parent Deliverable / Milestone
              </div>
              <div className="font-semibold text-app-text-primary mt-1 flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>{task.parentTitle}</span>
              </div>
            </div>
          )}

          {/* Assignees & Reviewers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-app-border bg-app-bg flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                  Primary Assignee
                </div>
                <div className="font-semibold text-app-text-primary mt-0.5 text-sm truncate">
                  {task.primaryAssignee?.name || "Unassigned"}
                </div>
                <div className="text-[11px] font-mono text-app-text-muted truncate">
                  {task.primaryAssignee?.email || "No email"}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-app-border bg-app-bg flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-wider">
                  Quality Reviewer
                </div>
                <div className="font-semibold text-app-text-primary mt-0.5 text-sm truncate">
                  {task.reviewer?.name || "Assigned via PR"}
                </div>
                <div className="text-[11px] font-mono text-app-text-muted truncate">
                  {task.reviewer?.email || "peer-review@acmehealth.com"}
                </div>
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                Upstream Dependencies ({task.dependencies.length})
              </h3>
              <div className="space-y-2">
                {task.dependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-3 rounded-xl border border-app-border bg-app-bg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {dep.key}
                      </span>
                      <span className="text-app-text-primary truncate">
                        {dep.title}
                      </span>
                    </div>
                    <ViewerStatusBadge label={dep.state} tone={getStateTone(dep.state)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Date & Telemetry */}
          <div className="flex items-center justify-between pt-3 border-t border-app-border text-xs text-app-text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>Target Delivery Date:</span>
            </span>
            <span className="font-mono font-bold text-app-text-primary">
              {task.dueDate}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-app-border bg-app-sidebar/60 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleCopyKey}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-app-border bg-app-surface hover:bg-app-hover text-xs font-semibold text-app-text-primary transition-colors cursor-pointer shadow-xs"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
            <span>{copied ? "Copied Key!" : "Copy Task Key"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
