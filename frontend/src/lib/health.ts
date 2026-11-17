import type { Project, ProjectHealth, WorkItem } from "../types/index.ts";

export interface HealthEvaluation {
  health: ProjectHealth;
  reasons: string[];
  isOverridden: boolean;
  computedHealth: ProjectHealth;
  overrideDetails?: {
    reason: string;
    authorId: string;
    expiresAt: string;
  };
}

/**
 * Deterministic Project Health Evaluator (Blueprint V1.1)
 *
 * Precedence:
 * 1. Unfinished delivery past approved target = DELAYED
 * 2. Overdue critical item, critical blocker > 2 working days, or pace gap >= 15 pts = AT_RISK
 * 3. Insufficient / currently stale evidence = UNKNOWN
 * 4. Otherwise = ON_TRACK
 */
export function evaluateProjectHealth(
  project: Project,
  workItems: WorkItem[] = [],
  currentDateStr: string = "2026-11-05"
): HealthEvaluation {
  const reasons: string[] = [];
  let computed: ProjectHealth = "ON_TRACK";

  // Check 1: Delivery past approved target
  const isPastTarget =
    project.lifecycle !== "DELIVERED" &&
    project.lifecycle !== "CLOSED" &&
    project.lifecycle !== "CANCELLED" &&
    project.targetDate < currentDateStr;

  if (isPastTarget) {
    computed = "DELAYED";
    reasons.push(`Target completion date (${project.targetDate}) has passed while project is unfinished.`);
  }

  // Check 2: Critical overdue items or critical blockers > 2 working days
  const projectItems = workItems.filter((w) => w.projectId === project.id);
  const criticalOverdueItems = projectItems.filter(
    (w) =>
      w.criticality === "CRITICAL" &&
      w.state !== "DONE" &&
      w.dueDate &&
      w.dueDate < currentDateStr
  );

  if (criticalOverdueItems.length > 0) {
    if (computed !== "DELAYED") {
      computed = "AT_RISK";
    }
    reasons.push(
      `${criticalOverdueItems.length} critical work item(s) are overdue (${criticalOverdueItems.map((i) => i.key).join(", ")}).`
    );
  }

  const criticalBlockers = projectItems.flatMap((w) =>
    (w.blockers || []).filter((b) => b.severity === "CRITICAL" && !b.resolvedAt)
  );

  if (criticalBlockers.length > 0) {
    if (computed !== "DELAYED") {
      computed = "AT_RISK";
    }
    reasons.push(`${criticalBlockers.length} active critical blocker(s) unresolved.`);
  }

  // Check 3: Insufficient / stale check-in data (in Individual mode)
  if (project.mode === "INDIVIDUAL") {
    if (!project.lastReportedAt && project.lifecycle === "ACTIVE") {
      if (computed === "ON_TRACK") {
        computed = "UNKNOWN";
      }
      reasons.push("No check-in has been submitted yet for this active solo project.");
    }
  }

  // If no negative signals triggered
  if (reasons.length === 0) {
    reasons.push("All project commitments, milestones, and reports are on schedule.");
  }

  // Check manager override (Blueprint V1.1 permits temporary override with visible facts)
  const hasValidOverride =
    project.temporaryHealthOverride &&
    project.temporaryHealthOverride.expiresAt > currentDateStr;

  const finalHealth = hasValidOverride
    ? project.temporaryHealthOverride!.health
    : computed;

  return {
    health: finalHealth,
    reasons,
    isOverridden: !!hasValidOverride,
    computedHealth: computed,
    overrideDetails: hasValidOverride ? project.temporaryHealthOverride : undefined,
  };
}
