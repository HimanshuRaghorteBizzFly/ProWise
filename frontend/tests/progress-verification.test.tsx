import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CheckInSubmissionModal } from "../src/features/projects/CheckInSubmissionModal";
import { VerificationReviewModal } from "../src/features/projects/VerificationReviewModal";
import { CheckInAuditTrail } from "../src/features/projects/CheckInAuditTrail";
import { createApiClient, IDEMPOTENCY_KEY_HEADER } from "../src/lib/api";
import type { CheckInDto, GitHubActivityDto } from "../src/types/api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-123", projectId: "proj-solo-1" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/org/org-123/developer/projects/proj-solo-1/individual",
}));

describe("Task 2.2: Developer Progress & Team Lead Verification Frontend", () => {
  const mockAcceptedCheckIn: CheckInDto = {
    id: "chk-1",
    project_id: "proj-solo-1",
    revision_of: null,
    revision_seq: 1,
    percent: 40.0,
    accomplished: "Built authentication filter and token extractor",
    next_steps: "Implement rate limiter",
    blockers: null,
    projected_finish: "2026-12-15",
    evidence: "prowise/core a1b2c3d4e5: feat: auth filter",
    downward_reason: null,
    status: "APPROVED",
    method: "developer_reported",
    label: "Developer reported",
    author: { user_id: "dev-alice", email: "alice@example.test" },
    submitted_at: "2026-11-20T09:30:00Z",
    decided_by: { user_id: "lead-bob", email: "bob@example.test" },
    decided_at: "2026-11-20T10:00:00Z",
    decision_reason: "Code quality verified, clean test coverage",
    version: 1,
  };

  const mockDownwardCheckIn: CheckInDto = {
    id: "chk-2",
    project_id: "proj-solo-1",
    revision_of: "chk-1",
    revision_seq: 2,
    percent: 30.0,
    accomplished: "Refactoring database transactions to fix concurrency deadlock",
    next_steps: "Re-run multi-threaded stress tests",
    blockers: "Waiting on load test cluster",
    projected_finish: "2026-12-20",
    evidence: null,
    downward_reason: "Discovered race condition in distributed lock requiring redesign",
    status: "PENDING",
    method: "developer_reported",
    label: "Developer reported",
    author: { user_id: "dev-alice", email: "alice@example.test" },
    submitted_at: "2026-11-21T08:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    version: 1,
  };

  const mockGitHubCommits: GitHubActivityDto[] = [
    {
      id: "gh-1",
      repository_name: "prowise/core",
      event_type: "PUSH",
      actor: "alice",
      title: "fix: concurrency lock in token bucket",
      detail: null,
      sha: "c9d8e7f6",
      pr_number: null,
      branch: "main",
      status: null,
      linked_task_key: null,
      project_id: "proj-solo-1",
      created_at: "2026-11-21T07:45:00Z",
      org_id: "org-123",
    },
  ];

  it("T28: CheckInAuditTrail renders immutable history with 'Developer reported' label", () => {
    const html = renderToStaticMarkup(
      <CheckInAuditTrail
        checkIns={[mockDownwardCheckIn, mockAcceptedCheckIn]}
        currentProjectPercent={40.0}
        canReview={true}
      />
    );

    // Blueprint T28: "Developer reported" label must be rendered
    expect(html).toContain("Developer reported");
    // Verify percentages
    expect(html).toContain("40%");
    expect(html).toContain("30%");
    // Verify revision sequence
    expect(html).toContain("v1");
    // Downward revision reason callout
    expect(html).toContain("Discovered race condition in distributed lock requiring redesign");
    // Verification status badges
    expect(html).toContain("Verified &amp; Accepted");
    expect(html).toContain("Pending Verification");
    // Reviewer note and evidence are rendered from the persisted check-in fields.
    expect(html).toContain("bob@example.test");
    expect(html).toContain("Code quality verified, clean test coverage");
    // Code evidence commit link
    expect(html).toContain("a1b2c3d");
    // Review button for authorized reviewer on pending check-in
    expect(html).toContain("Review");
  });

  it("CheckInSubmissionModal renders progress slider and downward warning when decreasing", () => {
    const html = renderToStaticMarkup(
      <CheckInSubmissionModal
        isOpen={true}
        onClose={vi.fn()}
        projectId="proj-solo-1"
        projectName="Core Engine"
        projectKey="SOLO"
        currentPercent={40.0}
        gitHubActivity={mockGitHubCommits}
      />
    );

    // Header and baseline
    expect(html).toContain("Submit Progress Check-In — [SOLO]");
    expect(html).toContain("Current Approved Progress:");
    expect(html).toContain("40.0%");
    // Team lead verification notice
    expect(html).toContain("Every check-in starts pending");
    // Code evidence section with commits
    expect(html).toContain("fix: concurrency lock in token bucket");
    expect(html).toContain("c9d8e7f");
  });

  it("VerificationReviewModal renders comparison, evidence, and review actions", () => {
    const html = renderToStaticMarkup(
      <VerificationReviewModal
        isOpen={true}
        onClose={vi.fn()}
        checkin={mockDownwardCheckIn}
        currentProjectPercent={40.0}
        projectKey="SOLO"
        projectName="Core Engine"
      />
    );

    expect(html).toContain("Team Lead Progress Verification");
    expect(html).toContain("[SOLO] Core Engine");
    expect(html).toContain("alice@example.test");
    expect(html).toContain("40.0%");
    expect(html).toContain("30.0%");
    expect(html).toContain("Discovered race condition in distributed lock requiring redesign");
    expect(html).toContain("Refactoring database transactions to fix concurrency deadlock");
    expect(html).toContain("Approve Submission");
    expect(html).toContain("Reject");
  });

  it("apiClient passes Idempotency-Key and calls correct progress and verification endpoints", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Headers | undefined;
    let capturedBody: unknown;

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = new Headers(init?.headers);
      capturedBody = init?.body ? JSON.parse(init.body as string) as unknown : undefined;

      return Promise.resolve(new Response(JSON.stringify({
          id: "chk-test-1",
          percent: 50.0,
          status: "PENDING",
          method: "developer_reported",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
    });

    const client = createApiClient({
      baseUrl: "http://localhost:8080",
      fetch: mockFetch as typeof fetch,
    });

    // 1. Submit check-in with Idempotency-Key
    const testIdempotencyKey = "test-key-12345";
    await client.submitCheckIn(
      "proj-solo-1",
      {
        percent: 50.0,
        accomplished: "Done milestone 1",
        next_steps: "Start milestone 2",
      },
      testIdempotencyKey
    );

    expect(capturedUrl).toBe("http://localhost:8080/v1/projects/proj-solo-1/checkins");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders?.get(IDEMPOTENCY_KEY_HEADER)).toBe(testIdempotencyKey);
    expect(capturedBody).toMatchObject({ percent: 50.0 });

    // 2. Verify check-in
    await client.decideCheckIn("chk-test-1", {
      decision: "APPROVE",
      reason: "Looks solid",
      expected_version: 1,
    });

    expect(capturedUrl).toBe("http://localhost:8080/v1/checkins/chk-test-1/decision");
    expect(capturedMethod).toBe("POST");
    expect(capturedBody).toMatchObject({ decision: "APPROVE", reason: "Looks solid", expected_version: 1 });

    // 3. Pending reviews query
    await client.pendingReviews("org-123");
    expect(capturedUrl).toBe("http://localhost:8080/v1/organizations/org-123/reviews/pending");
    expect(capturedMethod).toBe("GET");

    // 4. Progress summary query
    await client.progressSummary("proj-solo-1");
    expect(capturedUrl).toBe("http://localhost:8080/v1/projects/proj-solo-1/checkins/summary");
    expect(capturedMethod).toBe("GET");
  });
});
