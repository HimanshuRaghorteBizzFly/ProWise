import { describe, it, expect } from "vitest";
import { getRoleDashboardPath } from "../src/store/auth-store";
import { ROUTES } from "../src/config/routes";
import { getNavigationConfig } from "../src/config/navigation";
import {
  getViewerProjects,
  getViewerTasks,
  getViewerMilestones,
  getViewerActivity,
  getViewerFiles,
  getViewerMembers,
  getViewerCalendarEvents,
} from "../src/app/(workspace)/org/[orgId]/viewer/_services/viewer-service";

describe("Viewer Panel Routing & UI/UX Integrity", () => {
  it("resolves the viewer dashboard path safely without 404", () => {
    const defaultPath = getRoleDashboardPath("VIEWER");
    expect(defaultPath).toBe("/org/org-acme/viewer/dashboard");

    const customOrgPath = getRoleDashboardPath("VIEWER", "org-test-123");
    expect(customOrgPath).toBe("/org/org-test-123/viewer/dashboard");

    const emptyOrgPath = getRoleDashboardPath("VIEWER", "");
    expect(emptyOrgPath).toBe("/org/org-acme/viewer/dashboard");
  });

  it("has complete viewer routes registered in ROUTES config", () => {
    const orgRoutes = ROUTES.ORG("org-acme");
    expect(orgRoutes.VIEWER.DASHBOARD).toBe("/org/org-acme/viewer/dashboard");
    expect(orgRoutes.VIEWER.PROJECTS).toBe("/org/org-acme/viewer/projects");
    expect(orgRoutes.VIEWER.TASKS).toBe("/org/org-acme/viewer/tasks");
    expect(orgRoutes.VIEWER.PROGRESS).toBe("/org/org-acme/viewer/progress");
    expect(orgRoutes.VIEWER.REPORTS).toBe("/org/org-acme/viewer/reports");
    expect(orgRoutes.VIEWER.TEAM).toBe("/org/org-acme/viewer/team");
    expect(orgRoutes.VIEWER.CALENDAR).toBe("/org/org-acme/viewer/calendar");
    expect(orgRoutes.VIEWER.FILES).toBe("/org/org-acme/viewer/files");
    expect(orgRoutes.VIEWER.ACTIVITY).toBe("/org/org-acme/viewer/activity");
    expect(orgRoutes.VIEWER.NOTIFICATIONS).toBe("/org/org-acme/viewer/notifications");
    expect(orgRoutes.VIEWER.SETTINGS).toBe("/org/org-acme/viewer/settings");
    expect(orgRoutes.VIEWER.MILESTONES).toBe("/org/org-acme/viewer/milestones");
    expect(orgRoutes.VIEWER.DELIVERY_STATUS).toBe("/org/org-acme/viewer/delivery-status");
  });

  it("provides all 10 sidebar navigation items for Viewer role", () => {
    const navSections = getNavigationConfig("VIEWER", "org-acme");
    const allItems = navSections.flatMap((s) => s.items);

    expect(allItems.length).toBeGreaterThanOrEqual(10);
    const titles = allItems.map((i) => i.title);

    expect(titles).toContain("Dashboard");
    expect(titles).toContain("Projects");
    expect(titles).toContain("Tasks & Work");
    expect(titles).toContain("Progress");
    expect(titles).toContain("Reports");
    expect(titles).toContain("Calendar");
    expect(titles).toContain("Team Directory");
    expect(titles).toContain("Files & Evidence");
    expect(titles).toContain("Activity");
    expect(titles).toContain("Notifications");
    expect(titles).toContain("Settings");
  });

  it("serves persistent demo data for all viewer services", () => {
    const projects = getViewerProjects("org-acme");
    expect(projects.length).toBeGreaterThan(0);

    const tasks = getViewerTasks("org-acme");
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].primaryAssignee).toBeDefined();

    const milestones = getViewerMilestones("org-acme");
    expect(milestones.length).toBeGreaterThan(0);

    const activity = getViewerActivity("org-acme");
    expect(activity.length).toBeGreaterThan(0);

    const files = getViewerFiles("org-acme");
    expect(files.length).toBeGreaterThan(0);

    const members = getViewerMembers("org-acme");
    expect(members.length).toBeGreaterThan(0);

    const events = getViewerCalendarEvents("org-acme");
    expect(events.length).toBeGreaterThan(0);
  });
});
