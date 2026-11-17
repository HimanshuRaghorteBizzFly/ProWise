import { describe, it, expect } from "vitest";
import {
  assertReadOnly,
  getViewerProjects,
  getViewerTasks,
  getViewerFiles,
  getViewerFileById,
  generateProgressCsv,
  generateMilestonesJson,
} from "../src/app/(workspace)/org/[orgId]/viewer/_services/viewer-service";

describe("Viewer Panel RBAC & Scoping Security Contract", () => {
  it("enforces read-only RBAC by throwing 403 error on any mutation attempt", () => {
    expect(() => assertReadOnly("createWorkItem")).toThrowError(/403 FORBIDDEN/);
    expect(() => assertReadOnly("deleteProject")).toThrowError(/403 FORBIDDEN/);
    expect(() => assertReadOnly("approveDelivery")).toThrowError(/403 FORBIDDEN/);
  });

  it("strictly scopes projects to active organization (no cross-tenant leakage)", () => {
    const acmeProjects = getViewerProjects("org-acme");
    expect(acmeProjects.length).toBeGreaterThan(0);
    expect(acmeProjects.every((p) => p.orgId === "org-acme")).toBe(true);

    const novaProjects = getViewerProjects("org-nova");
    expect(novaProjects.every((p) => p.orgId === "org-nova")).toBe(true);

    // Cross-tenant verification: Nova project NOVA-900 should not appear under Acme
    expect(acmeProjects.some((p) => p.key === "NOVA-900")).toBe(false);
  });

  it("filters tasks by tenant and respects project boundaries", () => {
    const acmeTasks = getViewerTasks("org-acme", "proj-structured-cds");
    expect(acmeTasks.length).toBeGreaterThan(0);
    expect(acmeTasks.every((t) => t.projectId === "proj-structured-cds")).toBe(true);
  });

  it("identifies restricted credential files and blocks clearance", () => {
    const restrictedFile = getViewerFileById("org-acme", "file-restricted-keys");
    expect(restrictedFile).toBeDefined();
    expect(restrictedFile?.isRestricted).toBe(true);
    expect(restrictedFile?.permittedDownload).toBe(false);

    const permittedFile = getViewerFileById("org-acme", "file-spec-fhir");
    expect(permittedFile).toBeDefined();
    expect(permittedFile?.isRestricted).toBe(false);
    expect(permittedFile?.permittedDownload).toBe(true);
  });

  it("generates permitted CSV progress export with required headers", () => {
    const csv = generateProgressCsv("org-acme");
    expect(csv).toContain("Project Key");
    expect(csv).toContain("Delivery Mode");
    expect(csv).toContain("Progress Percent");
    expect(csv).toContain("CRM-100");
  });

  it("generates permitted JSON milestone compliance audit with metadata", () => {
    const jsonStr = generateMilestonesJson("org-acme");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.exportType).toBe("MILESTONE_COMPLIANCE_AUDIT");
    expect(parsed.governanceScope).toBe("READ_ONLY_VIEWER");
    expect(Array.isArray(parsed.milestones)).toBe(true);
  });
});
