import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeliveryAcceptanceModal } from "../src/features/projects/DeliveryAcceptanceModal";
import { DeliveryReviewModal } from "../src/features/projects/DeliveryReviewModal";
import { ProjectClosureModal } from "../src/features/projects/ProjectClosureModal";
import { BlockerManagementModal } from "../src/features/projects/BlockerManagementModal";
import { createApiClient } from "../src/lib/api";
import type {
  AcceptanceRequestDto,
  CheckInDto,
  ProjectBlockerDto,
  ProjectDto,
} from "../src/types/api";

describe("Task 2.4: Deliver, Close, Archive & Restore Frontend Components", () => {
  const mockProject: ProjectDto = {
    id: "proj-core-1",
    key: "CORE",
    name: "Platform Core",
    description: "Core service engine",
    mode: "INDIVIDUAL",
    lifecycle: "ACTIVE",
    archived: false,
    priority: "HIGH",
    project_manager: { membership_id: "pm-1", email: "pm@example.test" },
    accountable: { membership_id: "dev-alice", email: "alice@example.test" },
    members: [{ membership_id: "dev-alice", email: "alice@example.test" }],
    team_id: null,
    team_name: null,
    start_on: "2026-06-01",
    target_on: "2026-06-30",
    timezone: "UTC",
    active_baseline_id: null,
    task_count: 0,
    progress: { percent: 100, label: "Developer reported", reported_at: "2026-06-25T10:00:00Z" },
    can_edit: true,
    version: 2,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-25T12:00:00Z",
  };

  const mockCheckin: CheckInDto = {
    id: "chk-100",
    project_id: "proj-core-1",
    revision_of: null,
    revision_seq: 1,
    percent: 100,
    accomplished: "Completed final milestone and integrated telemetry",
    next_steps: "Ready for formal delivery review",
    blockers: null,
    projected_finish: "2026-06-30",
    evidence: "PR #42 merged",
    downward_reason: null,
    status: "APPROVED",
    method: "developer_reported",
    label: "Developer reported",
    author: { user_id: "dev-alice", email: "alice@example.test" },
    submitted_at: "2026-06-25T10:00:00Z",
    decided_by: { user_id: "lead-bob", email: "bob@example.test" },
    decided_at: "2026-06-25T11:00:00Z",
    decision_reason: "All unit tests green",
    version: 1,
  };

  const mockAcceptanceRequest: AcceptanceRequestDto = {
    id: "accreq-101",
    org_id: "org-123",
    project_id: "proj-core-1",
    bound_checkin_id: "chk-100",
    checklist: [
      { id: "c1", label: "Core code complete", checked: true, notes: "Verified" },
      { id: "c2", label: "All automated tests passing", checked: true, notes: "Verified" },
    ],
    evidence_summary: "Pull Request #42 merged into main with 100% test coverage",
    evidence_items: [
      { type: "PR", title: "Release PR #42", url: "https://github.com/org/repo/pull/42", reference: "PR-42" },
    ],
    status: "PENDING",
    version: 1,
    created_by: "dev-alice",
    created_by_name: "Alice Developer",
    created_at: "2026-06-25T12:30:00Z",
    updated_at: "2026-06-25T12:30:00Z",
    decisions: [],
  };

  const mockCriticalBlocker: ProjectBlockerDto = {
    id: "blk-critical-1",
    project_id: "proj-core-1",
    title: "Unresolved CVE vulnerability in serialization dependency",
    description: "Requires patch or approved security waiver",
    severity: "CRITICAL",
    status: "OPEN",
    created_by: "dev-alice",
    created_at: "2026-06-25T08:00:00Z",
    resolved_at: null,
    waiver: null,
  };

  it("DeliveryAcceptanceModal renders checklist and bound 100% check-in", () => {
    const html = renderToStaticMarkup(
      <DeliveryAcceptanceModal
        isOpen={true}
        project={mockProject}
        checkins={[mockCheckin]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain("Request Delivery Acceptance");
    expect(html).toContain("Platform Core");
    expect(html).toContain("Core code implementation complete per specification");
    expect(html).toContain("Automated unit and integration test suite passing green");
    expect(html).toContain("Submit Acceptance Request");
  });

  it("DeliveryReviewModal warns about open critical blockers preventing acceptance", () => {
    const html = renderToStaticMarkup(
      <DeliveryReviewModal
        isOpen={true}
        project={mockProject}
        request={mockAcceptanceRequest}
        blockers={[mockCriticalBlocker]}
        currentUserId="lead-bob"
        onClose={vi.fn()}
        onDecide={vi.fn()}
        onWaiveBlocker={vi.fn()}
      />
    );

    expect(html).toContain("Review Delivery Acceptance");
    expect(html).toContain("Critical Blockers Unresolved (1)");
    expect(html).toContain("Unresolved CVE vulnerability in serialization dependency");
    expect(html).toContain("Grant Waiver");
    expect(html).toContain("Accept &amp; Deliver");
  });

  it("DeliveryReviewModal shows D04 Separation of Duties warning on self-approval", () => {
    const html = renderToStaticMarkup(
      <DeliveryReviewModal
        isOpen={true}
        project={mockProject}
        request={mockAcceptanceRequest}
        blockers={[]}
        currentUserId="dev-alice" // Author is Alice!
        onClose={vi.fn()}
        onDecide={vi.fn()}
      />
    );

    expect(html).toContain("Separation of Duties (Rule D04)");
    expect(html).toContain("You cannot verify or approve your own delivery request");
  });

  it("ProjectClosureModal renders mandatory handover note and closure reason", () => {
    const deliveredProject: ProjectDto = { ...mockProject, lifecycle: "DELIVERED" };
    const html = renderToStaticMarkup(
      <ProjectClosureModal
        isOpen={true}
        project={deliveredProject}
        onClose={vi.fn()}
        onCloseProject={vi.fn()}
      />
    );

    expect(html).toContain("Close Delivered Project");
    expect(html).toContain("Handover Note (Mandatory)");
    expect(html).toContain("Closure Reason (Mandatory)");
    expect(html).toContain("Confirm &amp; Close Project");
  });

  it("BlockerManagementModal renders existing blockers and allows reporting new ones", () => {
    const html = renderToStaticMarkup(
      <BlockerManagementModal
        isOpen={true}
        project={mockProject}
        blockers={[mockCriticalBlocker]}
        onClose={vi.fn()}
        onCreateBlocker={vi.fn()}
        onWaiveBlocker={vi.fn()}
        onResolveBlocker={vi.fn()}
      />
    );

    expect(html).toContain("Project Blockers &amp; Waivers");
    expect(html).toContain("+ Report New Blocker");
    expect(html).toContain("CRITICAL");
    expect(html).toContain("Unresolved CVE vulnerability in serialization dependency");
    expect(html).toContain("Resolve");
    expect(html).toContain("Waive");
  });

  it("apiClient exposes Task 2.4 delivery and lifecycle methods", () => {
    const client = createApiClient();
    expect(typeof client.deliveryStatus).toBe("function");
    expect(typeof client.acceptanceRequests).toBe("function");
    expect(typeof client.requestDeliveryAcceptance).toBe("function");
    expect(typeof client.decideDeliveryAcceptance).toBe("function");
    expect(typeof client.closeProjectLifecycle).toBe("function");
    expect(typeof client.reopenProjectLifecycle).toBe("function");
    expect(typeof client.transitionProjectLifecycle).toBe("function");
    expect(typeof client.projectBlockers).toBe("function");
    expect(typeof client.createProjectBlocker).toBe("function");
    expect(typeof client.waiveProjectBlocker).toBe("function");
    expect(typeof client.resolveProjectBlocker).toBe("function");
    expect(typeof client.projectLifecycleHistory).toBe("function");
    expect(typeof client.projectClosures).toBe("function");
  });
});
