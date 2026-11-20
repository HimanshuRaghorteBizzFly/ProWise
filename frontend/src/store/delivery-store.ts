"use client";

import { create } from "zustand";
import {
  BLOCKERS,
  CHECK_INS,
  DEMO_NOW,
  DEPENDENCIES,
  EVIDENCE,
  PEOPLE,
  PROJECTS,
  REPORTS,
  REVIEWS,
  SCOPE_CHANGES,
  TASKS,
  TEAMS,
  type Blocker,
  type CheckIn,
  type Dependency,
  type Evidence,
  type Person,
  type Priority,
  type Project,
  type Report,
  type Review,
  type ScopeChange,
  type Task,
  type TaskStatus,
  type Team,
} from "@/mocks/delivery-dashboards";

/**
 * In-memory store for the Project Manager, Team Lead and QA / Reviewer workspaces.
 * Seeded from `src/mocks/delivery-dashboards.ts`; resets on full page reload.
 */

export interface NewProjectInput {
  name: string;
  client: string;
  mode: Project["mode"];
  teamId: string;
  startDate: string;
  dueDate: string;
  description: string;
}

export interface NewTaskInput {
  title: string;
  projectId: string;
  assigneeId: string | null;
  priority: Priority;
  dueDate: string;
  estimateHours: number;
  description: string;
}

interface DeliveryState {
  people: Person[];
  teams: Team[];
  projects: Project[];
  tasks: Task[];
  blockers: Blocker[];
  scopeChanges: ScopeChange[];
  checkIns: CheckIn[];
  dependencies: Dependency[];
  reports: Report[];
  reviews: Review[];
  evidence: Evidence[];

  createProject: (input: NewProjectInput, managerId: string) => Project;
  createTask: (input: NewTaskInput) => Task;
  assignTask: (taskId: string, assigneeId: string | null, dueDate?: string) => void;
  updateTask: (taskId: string, patch: { status?: TaskStatus; progress?: number; dueDate?: string }) => void;
  resolveBlocker: (blockerId: string, resolution: string) => void;
  decideScopeChange: (id: string, status: "APPROVED" | "REJECTED", note: string) => void;
  decideReview: (id: string, status: "APPROVED" | "CHANGES_REQUESTED", reason: string) => void;
  setEvidenceStatus: (id: string, status: Evidence["status"]) => void;
}

const PROJECT_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];

function slugCode(name: string) {
  const letters = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean);
  const code = letters.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return code.padEnd(3, "X");
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  people: PEOPLE,
  teams: TEAMS,
  projects: PROJECTS,
  tasks: TASKS,
  blockers: BLOCKERS,
  scopeChanges: SCOPE_CHANGES,
  checkIns: CHECK_INS,
  dependencies: DEPENDENCIES,
  reports: REPORTS,
  reviews: REVIEWS,
  evidence: EVIDENCE,

  createProject: (input, managerId) => {
    const count = get().projects.length;
    const team = get().people.filter((p) => p.teamId === input.teamId).map((p) => p.id);
    const project: Project = {
      id: `prj-new-${Date.now()}`,
      code: slugCode(input.name),
      name: input.name,
      client: input.client,
      mode: input.mode,
      status: "PLANNING",
      health: "ON_TRACK",
      progress: 0,
      plannedProgress: 0,
      startDate: input.startDate,
      dueDate: input.dueDate,
      managerId,
      teamId: input.teamId,
      memberIds: input.mode === "INDIVIDUAL" ? team.slice(0, 1) : team,
      budgetUsed: 0,
      description: input.description,
      milestones: [],
      risks: [],
      progressTrend: [{ week: "W47", actual: 0, planned: 0 }],
      color: PROJECT_COLORS[count % PROJECT_COLORS.length],
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  createTask: (input) => {
    const project = get().projects.find((p) => p.id === input.projectId);
    const seq = get().tasks.filter((t) => t.projectId === input.projectId).length + 1;
    const task: Task = {
      id: `tk-new-${Date.now()}`,
      key: `${project?.code ?? "TSK"}-${900 + seq}`,
      title: input.title,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      teamId: project?.teamId ?? "t-platform",
      status: "TODO",
      priority: input.priority,
      dueDate: input.dueDate,
      estimateHours: input.estimateHours,
      weight: Math.max(1, Math.round(input.estimateHours / 2)),
      progress: 0,
      description: input.description,
      updatedAt: DEMO_NOW,
    };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  assignTask: (taskId, assigneeId, dueDate) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, assigneeId, dueDate: dueDate || t.dueDate, updatedAt: DEMO_NOW } : t
      ),
    })),

  updateTask: (taskId, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: DEMO_NOW } : t)),
    })),

  resolveBlocker: (blockerId, resolution) =>
    set((s) => ({
      blockers: s.blockers.map((b) => (b.id === blockerId ? { ...b, status: "RESOLVED", resolution } : b)),
    })),

  decideScopeChange: (id, status, note) =>
    set((s) => ({
      scopeChanges: s.scopeChanges.map((c) => (c.id === id ? { ...c, status, decisionNote: note } : c)),
    })),

  decideReview: (id, status, reason) =>
    set((s) => ({
      reviews: s.reviews.map((r) => (r.id === id ? { ...r, status, reason, decidedAt: DEMO_NOW } : r)),
    })),

  setEvidenceStatus: (id, status) =>
    set((s) => ({ evidence: s.evidence.map((e) => (e.id === id ? { ...e, status } : e)) })),
}));
