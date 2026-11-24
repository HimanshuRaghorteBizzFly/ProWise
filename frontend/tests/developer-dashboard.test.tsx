import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Developer dashboard (redesign): every figure comes from fixture API responses; no store or mock data.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-acme" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-acme/developer/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

const { DeveloperDashboardView, projectsOfMode, upcomingDeadlines, gitEventTime, STRUCTURED_MODE_TEXT } =
  await import("../src/components/developer/DeveloperDashboardView");
const { parseInstant, instantText } = await import("../src/components/developer/DevUI");

import type { LoadState } from "../src/components/org-console/useRoleApi";
import type { DeveloperDashboardSummary, DeveloperProject } from "../src/lib/developer-api";
import type { StructuredProgressDto } from "../src/types/work";

const BASE = "/org/org-acme/developer";
const NOW = new Date("2026-11-24T12:00:00Z");
const ready = <T,>(data: T): LoadState<T> => ({ kind: "ready", data });
const loading = { kind: "loading" } as const;

const task = (id: string, extra: Record<string, unknown>) => ({
  id, projectId: "p-str", type: "TASK", key: id.toUpperCase(), title: `Task ${id}`, state: "IN_PROGRESS", blocked: false,
  weight: 1, currentRevision: 1, priority: "MEDIUM", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...extra,
});

const DASHBOARD: DeveloperDashboardSummary = {
  assignedProjectsCount: 7,
  activeProjectsCount: 5,
  assignedTasksCount: 23,
  completedTasksCount: 11,
  pendingTasksCount: 12,
  overdueTasksCount: 3,
  openBugsCount: 4,
  pendingReviewsCount: 2,
  unreadNotificationsCount: 9,
  todayTasks: [],
  priorityTasks: [
    task("t-high", { priority: "HIGH", title: "Wire webhook" }),
    task("t-crit", { priority: "CRITICAL", title: "Fix login outage" }),
  ],
  blockedTasks: [],
  upcomingDeadlines: [
    { id: "t-due", title: "Ship invoice export", key: "INV-12", projectCode: "p-str", dueDate: "2026-11-27T00:00:00Z", priority: "HIGH", state: "TODO" },
  ],
  recentGitEvents: [
    { id: "g-iso", repositoryName: "acme/api", eventType: "PULL_REQUEST", actor: "dev1", title: "Add export endpoint", createdAt: "2026-11-24T10:00:00Z" },
    { id: "g-epoch", repositoryName: "acme/web", eventType: "CHECK_RUN", actor: "ci", title: "Build passed", createdAt: 1764000000.123456789 },
    { id: "g-null", repositoryName: "acme/web", eventType: "COMMIT", actor: "dev2", title: "Refactor", createdAt: null },
    { id: "g-bad", repositoryName: "acme/web", eventType: "REVIEW", actor: "dev3", title: "Looks good", createdAt: "not-a-date" },
  ],
};

const project = (p: Partial<DeveloperProject> & { id: string; mode: "INDIVIDUAL" | "STRUCTURED" }): DeveloperProject => ({
  name: `Project ${p.id}`, code: p.id.toUpperCase(), status: "ACTIVE", completionPercent: null, blockedTasksCount: 0, overdueTasksCount: 0, ...p,
});

const PROJECTS: DeveloperProject[] = [
  project({ id: "p-ind-late", mode: "INDIVIDUAL", name: "Late Solo", targetCompletionDate: "2027-06-01T00:00:00Z" }),
  project({ id: "p-ind-soon", mode: "INDIVIDUAL", name: "Soon Solo", code: "SOLO", targetCompletionDate: "2026-12-15T00:00:00Z",
    completionPercent: 40, latestCheckIn: { status: "APPROVED", createdAt: "2026-11-20T09:00:00Z" } }),
  project({ id: "p-str", mode: "STRUCTURED", name: "Billing Platform", code: "BILL", targetCompletionDate: "2027-01-10T00:00:00Z", blockedTasksCount: 2 }),
];

const progress = (percent: number | null): StructuredProgressDto => ({
  project_id: "p-str", mode: "STRUCTURED", method: "weighted_accepted", numerator: percent, denominator: 100, percent,
  label: percent === null ? "Not measurable" : "Calculated", explanation: percent === null ? "No approved baseline" : null,
  accepted_leaves: 0, total_leaves: 0, baseline: null, leaves: [], snapshots: [],
});

function render(overrides: Partial<React.ComponentProps<typeof DeveloperDashboardView>> = {}) {
  const calls: string[] = [];
  const html = renderToStaticMarkup(
    <DeveloperDashboardView
      base={BASE}
      dashboard={ready(DASHBOARD)}
      projects={ready(PROJECTS)}
      work={ready([])}
      blockers={ready([])}
      feedback={ready([])}
      calendar={ready([])}
      useStructuredProgress={(id) => { calls.push(id); return ready(progress(62.5)); }}
      now={NOW}
      {...overrides}
    />,
  );
  return { html, calls };
}

function kpi(html: string, id: string): string {
  const m = html.match(new RegExp(`data-testid="${id}"[\\s\\S]*?data-kpi-value="?[^>]*>([^<]*)<`));
  return m ? m[1] : "MISSING";
}

describe("KPI row", () => {
  it("shows every figure from GET /v1/developer/dashboard", () => {
    const { html } = render();
    expect(kpi(html, "kpi-assigned-projects")).toBe("7");
    expect(html).toContain("5 active");
    expect(kpi(html, "kpi-active-projects")).toBe("5");
    expect(kpi(html, "kpi-assigned-tasks")).toBe("23");
    expect(kpi(html, "kpi-completed-tasks")).toBe("11");
    expect(kpi(html, "kpi-pending-tasks")).toBe("12");
    expect(kpi(html, "kpi-overdue-tasks")).toBe("3");
    expect(kpi(html, "kpi-open-bugs")).toBe("4");
    expect(kpi(html, "kpi-code-reviews")).toBe("2");
  });

  it("shows '-' while loading and Retry on error, never a zero", () => {
    const { html } = render({ dashboard: loading });
    expect(kpi(html, "kpi-assigned-tasks")).toBe("-");
    expect(kpi(html, "kpi-overdue-tasks")).toBe("-");
    const failed = render({ dashboard: { kind: "error", retry: () => undefined } }).html;
    expect(kpi(failed, "kpi-assigned-projects")).toBe("-");
    expect(failed).toContain("could not be loaded");
    expect(failed).toMatch(/Retry/i);
  });
});

describe("mode highlight cards", () => {
  it("picks the Individual project with the nearest target date and links to its check-in", () => {
    expect(projectsOfMode(PROJECTS, "INDIVIDUAL").map((p) => p.id)).toEqual(["p-ind-soon", "p-ind-late"]);
    const { html } = render();
    const individual = html.split('data-testid="mode-card-individual"')[1].split('data-testid="mode-card-structured"')[0];
    expect(individual).toContain("Soon Solo");
    expect(individual).toContain("SOLO");
    expect(individual).toContain("Check-in approved");
    expect(individual).toContain("40% reported");
    expect(individual).toContain("+1 more");
    expect(individual).toContain(`href="${BASE}/projects/p-ind-soon/individual/new-check-in"`);
    expect(individual).toContain("Open Solo Check-in");
  });

  it("shows the Structured project with its calculated progress from the structured progress API", () => {
    const { html, calls } = render();
    const structured = html.split('data-testid="mode-card-structured"')[1];
    expect(calls).toEqual(["p-str"]);
    expect(structured).toContain("Billing Platform");
    expect(structured).toContain(STRUCTURED_MODE_TEXT);
    expect(structured).toContain("62.5% Calculated");
    expect(structured).toContain(`href="${BASE}/projects/p-str/structured"`);
    expect(structured).toContain("Open Sprint Board");
  });

  it("says Not measurable when the server returns no percent, never 0%", () => {
    const { html } = render({ useStructuredProgress: () => ready(progress(null)) });
    const structured = html.split('data-testid="mode-card-structured"')[1];
    expect(structured).toContain("Not measurable");
    expect(structured).not.toContain("0% Calculated");
  });

  it("an Individual project without an approved figure is Not reported, never 0", () => {
    const { html } = render({ projects: ready([project({ id: "p-x", mode: "INDIVIDUAL" })]) });
    expect(html).toContain("Not reported");
    expect(html).toContain("No check-in yet");
    expect(html).not.toContain("0% reported");
  });

  it("shows empty states when no project of a mode is assigned", () => {
    const { html, calls } = render({ projects: ready([]) });
    expect(html).toContain("No Individual-mode project assigned");
    expect(html).toContain("No Structured-mode project assigned");
    expect(calls).toEqual([]);
  });
});

describe("task cards", () => {
  it("orders priority tasks critical first and shows the blocker empty state", () => {
    const { html } = render();
    const section = html.split('data-testid="priority-tasks"')[1];
    expect(section.indexOf("Fix login outage")).toBeLessThan(section.indexOf("Wire webhook"));
    expect(html).toContain("No blockers currently active.");
  });

  it("merges task deadlines, project targets and calendar deadlines soonest first", () => {
    const rows = upcomingDeadlines(BASE, DASHBOARD, PROJECTS, [
      { id: "c-1", userId: "u", title: "Release freeze", eventType: "DEADLINE", startTime: "2026-12-01T00:00:00Z", allDay: true, createdAt: "x" },
      { id: "c-2", userId: "u", title: "Team lunch", eventType: "PERSONAL", startTime: "2026-11-25T00:00:00Z", allDay: true, createdAt: "x" },
    ], NOW);
    expect(rows.map((r) => r.id)).toEqual(["task-t-due", "cal-c-1", "project-p-ind-soon", "project-p-str", "project-p-ind-late"]);
    const { html } = render();
    expect(html).toContain("INV-12");
    expect(html).toContain(`href="${BASE}/calendar"`);
  });
});

describe("GitHub evidence", () => {
  it("never renders Invalid Date for ISO, epoch-second, null or junk timestamps", () => {
    const { html } = render();
    expect(html).not.toContain("Invalid Date");
    expect(html).toContain("Evidence only; never changes progress");
    expect(html).toContain("PULL_REQUEST");
    expect(html).toContain("acme/api");
    expect(html).toContain(`href="${BASE}/github"`);
    const times = [...html.matchAll(/data-testid="git-time">([^<]*)</g)].map((m) => m[1]);
    expect(times).toHaveLength(4);
    expect(times[0]).toContain("2h ago");
    expect(times[1]).toContain("2025");
    expect(times[2]).toBe("-");
    expect(times[3]).toBe("-");
  });

  it("parses each timestamp shape", () => {
    expect(parseInstant("2026-11-24T10:00:00Z")?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(parseInstant(1764000000)?.toISOString()).toBe("2025-11-24T16:00:00.000Z");
    expect(parseInstant(1764000000000)?.toISOString()).toBe("2025-11-24T16:00:00.000Z");
    expect(parseInstant("1764000000.5")?.getTime()).toBe(1764000000500);
    expect(parseInstant([2026, 11, 24, 10, 0, 0])?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant("garbage")).toBeNull();
    expect(instantText(undefined)).toBe("-");
    expect(gitEventTime({ id: "x" }, NOW)).toBe("-");
  });
});

describe("retained sections and data sources", () => {
  it("keeps the previous dashboard's panels and links", () => {
    const { html } = render();
    for (const text of ["Work in progress", "Review feedback", "Open blockers", "My projects"]) expect(html).toContain(text);
    for (const href of ["tasks", "reviews", "blockers", "projects", "calendar"]) expect(html).toContain(`href="${BASE}/${href}"`);
  });

  it("reads only real API data: no store, mock or seed imports", () => {
    for (const file of [
      "../src/components/developer/DeveloperDashboardView.tsx",
      "../src/app/(workspace)/org/[orgId]/developer/dashboard/page.tsx",
    ]) {
      const src = readFileSync(resolve(__dirname, file), "utf8");
      const imports = src.match(/from\s+["'][^"']+["']/g) ?? [];
      for (const imp of imports) expect(imp).not.toMatch(/store|mock|seed|sample|fixture/i);
    }
  });
});
