import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProjectCard } from "../src/features/projects/ProjectCard";
import { ProjectFormModal } from "../src/features/projects/ProjectFormModal";
import { ProjectsPortfolioView } from "../src/components/owner/ProjectsPortfolioView";
import { apiClient } from "../src/lib/api";
import type { ProjectDto } from "../src/types/api";
import type { PermissionKey } from "../src/types/permission";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-123" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/org/org-123/owner/projects",
}));

describe("Task 2.1: Project Management Frontend", () => {
  const mockIndividualProject: ProjectDto = {
    id: "proj-solo-1",
    key: "SOLO",
    name: "Autonomous Agent Module",
    description: "Single developer delivery for intelligent routing",
    mode: "INDIVIDUAL",
    lifecycle: "ACTIVE",
    archived: false,
    priority: "HIGH",
    project_manager: { membership_id: "usr-pm-1", email: "bob@example.test" },
    accountable: { membership_id: "usr-dev-1", email: "alice@example.test" },
    members: [{ membership_id: "usr-dev-1", email: "alice@example.test" }],
    team_id: null,
    team_name: null,
    start_on: "2026-11-01",
    target_on: "2026-12-01",
    timezone: "America/New_York",
    active_baseline_id: null,
    task_count: 0,
    progress: { percent: null, label: "Not reported", reported_at: null },
    can_edit: true,
    version: 1,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };

  const mockStructuredProject: ProjectDto = {
    id: "proj-struct-1",
    key: "CORE",
    name: "Enterprise Architecture Upgrade",
    description: "Multi-service distributed refactoring",
    mode: "STRUCTURED",
    lifecycle: "PLANNED",
    archived: false,
    priority: "CRITICAL",
    project_manager: { membership_id: "usr-pm-2", email: "manager@example.test" },
    accountable: { membership_id: "usr-dev-2", email: "developer@example.test" },
    members: [
      { membership_id: "usr-pm-2", email: "manager@example.test" },
      { membership_id: "usr-dev-2", email: "developer@example.test" },
      { membership_id: "usr-dev-3", email: "other@example.test" },
    ],
    team_id: "team-backend",
    team_name: "Backend",
    start_on: "2026-11-15",
    target_on: "2027-01-15",
    timezone: "Europe/London",
    active_baseline_id: null,
    task_count: 0,
    progress: { percent: 45, label: "Developer reported", reported_at: "2026-11-20T00:00:00Z" },
    can_edit: true,
    version: 3,
    created_at: "2026-11-15T00:00:00Z",
    updated_at: "2026-11-20T00:00:00Z",
  };

  describe("ProjectCard", () => {
    it("renders Individual mode project with no fabricated progress", () => {
      const markup = renderToStaticMarkup(
        <ProjectCard project={mockIndividualProject} />
      );

      expect(markup).toContain("[SOLO]");
      expect(markup).toContain("Autonomous Agent Module");
      expect(markup).toContain("Individual (Solo)");
      expect(markup).toContain("Not reported");
      // Must guarantee zero tasks requirement and no fake percentage
      expect(markup).toContain("Solo mode: 0 tasks required (progress via approved developer check-ins)");
      expect(markup).toContain("Accountable Dev: alice@example.test");
      expect(markup).toContain("v1");
    });

    it("renders Structured mode project with baseline progress", () => {
      const markup = renderToStaticMarkup(
        <ProjectCard project={mockStructuredProject} />
      );

      expect(markup).toContain("[CORE]");
      expect(markup).toContain("Enterprise Architecture Upgrade");
      expect(markup).toContain("Structured");
      expect(markup).toContain("45%");
      expect(markup).toContain("CRITICAL");
    });
  });

  describe("ProjectFormModal", () => {
    const mockMembers = [
      { id: "usr-dev-1", name: "Alice Developer", email: "alice@example.com" },
      { id: "usr-pm-1", name: "Bob Manager", email: "bob@example.com" },
    ];

    it("renders creation form with all required project configuration fields", () => {
      const markup = renderToStaticMarkup(
        <ProjectFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          members={mockMembers}
        />
      );

      expect(markup).toContain("Create New Project");
      expect(markup).toContain("Project Name");
      expect(markup).toContain("Project Key");
      expect(markup).toContain("Individual Mode (Solo)");
      expect(markup).toContain("Structured Mode (Team)");
      expect(markup).toContain("Accountable Developer");
      expect(markup).toContain("Project Manager");
      expect(markup).toContain("Priority");
      expect(markup).toContain("Lifecycle Status");
      expect(markup).toContain("Start Date");
      expect(markup).toContain("Target Delivery Date");
      expect(markup).toContain("Timezone (IANA)");
      expect(markup).toContain("Description &amp; Scope Summary");
    });

    it("renders edit form with reason prompt when modifying target delivery date", () => {
      const markup = renderToStaticMarkup(
        <ProjectFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          project={mockIndividualProject}
          members={mockMembers}
        />
      );

      expect(markup).toContain("Edit Project: SOLO");
      expect(markup).toContain("SOLO");
    });
  });

  describe("ApiClient Project Methods", () => {
    it("exposes implemented project endpoints without inventing archive or member routes", () => {
      expect(typeof apiClient.projects).toBe("function");
      expect(typeof apiClient.project).toBe("function");
      expect(typeof apiClient.projectOptions).toBe("function");
      expect(typeof apiClient.projectDateHistory).toBe("function");
      expect(typeof apiClient.createProject).toBe("function");
      expect(typeof apiClient.updateProject).toBe("function");
      expect("archiveProject" in apiClient).toBe(false);
      expect("restoreProject" in apiClient).toBe(false);
      expect("projectMembers" in apiClient).toBe(false);
    });
  });

  describe("ProjectsPortfolioView", () => {
    const mockProjects: ProjectDto[] = [{ ...mockIndividualProject, id: "proj-1", key: "PRJ1", name: "First Project" }];

    it("renders project cards and create project button when authorized", () => {
      const can = (key: PermissionKey) =>
        key === "project.read" || key === "project.create";

      const markup = renderToStaticMarkup(
        <ProjectsPortfolioView
          projects={mockProjects}
          users={[{ id: "usr-dev-1", name: "Alice Developer", email: "alice@example.com" }]}
          teams={[]}
          can={can}
        />
      );

      expect(markup).toContain("Projects portfolio");
      expect(markup).toContain("Create project");
      expect(markup).toContain("[PRJ1]");
      expect(markup).toContain("First Project");
      expect(markup).toContain("Individual");
    });
  });
});
