import { describe, it, expect, vi, afterEach } from "vitest";
import { getRoleDashboardPath } from "../src/store/auth-store";
import { ROUTES } from "../src/config/routes";
import { getNavigationConfig } from "../src/config/navigation";
import { loadViewerProjects } from "../src/app/(workspace)/org/[orgId]/viewer/_services/useViewerProjects";
import { apiClient } from "../src/lib/api";

describe("Viewer Panel Routing & UI/UX Integrity", () => {
  it("sends users without an active organization to workspace selection", () => {
    const defaultPath = getRoleDashboardPath("VIEWER");
    expect(defaultPath).toBe("/select-workspace");
    expect(getRoleDashboardPath("VIEWER", "")).toBe("/select-workspace");
  });

  it("routes an active organization to its Viewer dashboard", () => {
    expect(getRoleDashboardPath("VIEWER", "org-test-123")).toBe(
      "/org/org-test-123/viewer/dashboard",
    );
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

  it("lists only Viewer modules backed by a live API in the sidebar", () => {
    const titles = getNavigationConfig("VIEWER", "org-acme").flatMap((s) => s.items).map((i) => i.title);
    expect(titles).toEqual(["Dashboard", "Projects", "Progress", "Approvals"]); // Approvals: live review queue for chosen approvers
    for (const hidden of ["Tasks & Work", "Reports", "Calendar", "Team Directory", "Files & Evidence", "Activity", "Notifications", "Settings"]) {
      expect(titles).not.toContain(hidden);
    }
  });
});

describe("Viewer project loading (real API only)", () => {
  afterEach(() => vi.restoreAllMocks());

  const project = (id: string) => ({ id, key: id.toUpperCase(), name: id }) as never;

  it("follows the API cursor until has_more is false", async () => {
    const spy = vi
      .spyOn(apiClient, "projects")
      .mockResolvedValueOnce({ items: [project("p1"), project("p2")], next_cursor: "c1", has_more: true })
      .mockResolvedValueOnce({ items: [project("p3")], next_cursor: null, has_more: false });

    const projects = await loadViewerProjects("org-1");

    expect(projects.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(spy).toHaveBeenNthCalledWith(1, "org-1", { limit: 50, cursor: undefined });
    expect(spy).toHaveBeenNthCalledWith(2, "org-1", { limit: 50, cursor: "c1" });
  });

  it("returns an empty list when the organization has no projects (no sample fallback)", async () => {
    vi.spyOn(apiClient, "projects").mockResolvedValueOnce({ items: [], next_cursor: null, has_more: false });
    await expect(loadViewerProjects("org-1")).resolves.toEqual([]);
  });

  it("propagates API failures instead of substituting data", async () => {
    vi.spyOn(apiClient, "projects").mockRejectedValueOnce(new Error("boom"));
    await expect(loadViewerProjects("org-1")).rejects.toThrow("boom");
  });

  it("stops on a repeated cursor instead of looping forever", async () => {
    vi.spyOn(apiClient, "projects")
      .mockResolvedValueOnce({ items: [project("p1")], next_cursor: "c1", has_more: true })
      .mockResolvedValueOnce({ items: [project("p2")], next_cursor: "c1", has_more: true });
    const projects = await loadViewerProjects("org-1");
    expect(projects.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
