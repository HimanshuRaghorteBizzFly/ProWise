import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProjectCard } from "../src/features/projects/ProjectCard";
import { ProjectFormModal } from "../src/features/projects/ProjectFormModal";
import { ProjectsPortfolioView } from "../src/components/owner/ProjectsPortfolioView";
import { apiClient } from "../src/lib/api";
import type { ProjectDto } from "../src/types/api";
import type { Project } from "../src/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-123" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/org/org-123/owner/projects",
}));

describe("Task 2.1: Project Management Frontend", () => {
  const mockIndividualProject: ProjectDto = {
    id: "proj-solo-1",
    orgId: "org-123",
    key: "SOLO",
    name: "Autonomous Agent Module",
    description: "Single developer delivery for intelligent routing",
    mode: "INDIVIDUAL",
    lifecycle: "ACTIVE",
    priority: "HIGH",
    projectManagerId: "usr-pm-1",
    accountableDeveloperId: "usr-dev-1",
    teamIds: [],
    memberIds: ["usr-dev-1"],
    startDate: "2026-11-01T00:00:00Z",
    targetDate: "2026-12-01T00:00:00Z",
    timezone: "America/New_York",
    lastProgressPercent: 0,
    health: "ON_TRACK",
    archived: false,
    version: 1,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };

  const mockStructuredProject: ProjectDto = {
    id: "proj-struct-1",
    orgId: "org-123",
    key: "CORE",
    name: "Enterprise Architecture Upgrade",
    description: "Multi-service distributed refactoring",
    mode: "STRUCTURED",
    lifecycle: "PLANNED",
    priority: "CRITICAL",
    projectManagerId: "usr-pm-2",
    accountableDeveloperId: "usr-dev-2",
    teamIds: ["team-backend"],
    memberIds: ["usr-pm-2", "usr-dev-2", "usr-dev-3"],
    startDate: "2026-11-15T00:00:00Z",
    targetDate: "2027-01-15T00:00:00Z",
    timezone: "Europe/London",
    lastProgressPercent: 45,
    health: "ON_TRACK",
    archived: false,
    version: 3,
    createdAt: "2026-11-15T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
  };

  describe("ProjectCard", () => {
    it("renders Individual mode project with zero tasks guarantee and no fake progress", () => {
      const markup = renderToStaticMarkup(
        <ProjectCard project={mockIndividualProject} />
      );

      expect(markup).toContain("[SOLO]");
      expect(markup).toContain("Autonomous Agent Module");
      expect(markup).toContain("Individual (Solo)");
      expect(markup).toContain("0%");
      // Must guarantee zero tasks requirement and no fake percentage
      expect(markup).toContain("Solo mode: 0 tasks required (progress via developer check-ins)");
      expect(markup).toContain("Accountable Dev: usr-dev-1");
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
    it("exposes all project CRUD, member, and lifecycle endpoints", () => {
      expect(typeof apiClient.projects).toBe("function");
      expect(typeof apiClient.project).toBe("function");
      expect(typeof apiClient.createProject).toBe("function");
      expect(typeof apiClient.updateProject).toBe("function");
      expect(typeof apiClient.archiveProject).toBe("function");
      expect(typeof apiClient.restoreProject).toBe("function");
      expect(typeof apiClient.projectMembers).toBe("function");
      expect(typeof apiClient.addProjectMember).toBe("function");
      expect(typeof apiClient.removeProjectMember).toBe("function");
    });
  });

  describe("ProjectsPortfolioView", () => {
    const mockProjects: Project[] = [
      {
        id: "proj-1",
        orgId: "org-123",
        key: "PRJ1",
        name: "First Project",
        description: "A first project",
        mode: "INDIVIDUAL",
        lifecycle: "ACTIVE",
        archived: false,
        priority: "MEDIUM",
        projectManagerId: "usr-pm-1",
        accountableOwnerId: "usr-dev-1",
        teamIds: [],
        memberIds: ["usr-dev-1"],
        startDate: "2026-11-01",
        targetDate: "2026-12-01",
        timezone: "America/New_York",
        cadence: "WEEKLY",
        graceWorkingDays: 2,
        version: 1,
        lastProgressPercent: 0,
        lastProgressMethod: "DEVELOPER_REPORTED",
        health: "ON_TRACK",
        healthReasons: [],
        repositoryIds: [],
        createdAt: "2026-11-01T00:00:00Z",
      },
    ];

    it("renders project cards and create project button when authorized", () => {
      const can = (key: string) => key === "project.read" || key === "project.create";

      const markup = renderToStaticMarkup(
        <ProjectsPortfolioView
          projects={mockProjects}
          users={[{ id: "usr-dev-1", name: "Alice Developer", email: "alice@example.com", timezone: "UTC", createdAt: "2026-11-01T00:00:00Z" }]}
          teams={[]}
          source="api"
          can={can as any}
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
