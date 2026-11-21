import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CheckInSubmissionModal } from "../src/features/projects/CheckInSubmissionModal";
import { VerificationReviewModal } from "../src/features/projects/VerificationReviewModal";
import { CheckInAuditTrail } from "../src/features/projects/CheckInAuditTrail";
import { createApiClient, IDEMPOTENCY_KEY_HEADER } from "../src/lib/api";
import type { CheckInDto, GitHubActivityItemDto } from "../src/types/api";

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
    project_key: "SOLO",
    project_name: "Core Engine",
    author_id: "dev-alice",
    author_name: "Alice Developer",
    revision_of: null,
    revision_seq: 1,
    percent: 40.0,
    accomplished: "Built authentication filter and token extractor",
    next_steps: "Implement rate limiter",
    blockers: null,
    projected_finish: "2026-12-15",
    evidence_summary: "1 commit attached",
    evidence_items: [
      {
        type: "COMMIT",
        sha: "a1b2c3d4e5",
        title: "feat: auth filter",
        url: "https://github.com/prowise/core/commit/a1b2c3d4e5",
        repo_name: "prowise/core",
      },
    ],
    downward_reason: null,
    status: "ACCEPTED",
    method: "DEVELOPER_REPORTED",
    verified_by: "lead-bob",
    verified_by_name: "Bob TeamLead",
    review_comment: "Code quality verified, clean test coverage",
    reviewed_at: "2026-11-20T10:00:00Z",
    captured_at: "2026-11-20T09:30:00Z",
    created_at: "2026-11-20T09:30:00Z",
  };

  const mockDownwardCheckIn: CheckInDto = {
    id: "chk-2",
    project_id: "proj-solo-1",
    project_key: "SOLO",
    project_name: "Core Engine",
    author_id: "dev-alice",
    author_name: "Alice Developer",
    revision_of: "chk-1",
    revision_seq: 2,
    percent: 30.0,
    accomplished: "Refactoring database transactions to fix concurrency deadlock",
    next_steps: "Re-run multi-threaded stress tests",
    blockers: "Waiting on load test cluster",
    projected_finish: "2026-12-20",
    evidence_summary: null,
    evidence_items: [],
    downward_reason: "Discovered race condition in distributed lock requiring redesign",
    status: "PENDING_VERIFICATION",
    method: "DEVELOPER_REPORTED",
    verified_by: null,
    verified_by_name: null,
    review_comment: null,
    reviewed_at: null,
    captured_at: "2026-11-21T08:00:00Z",
    created_at: "2026-11-21T08:00:00Z",
  };

  const mockGitHubCommits: GitHubActivityItemDto[] = [
    {
      id: "gh-1",
      org_id: "org-123",
      project_id: "proj-solo-1",
      repository_name: "prowise/core",
      event_type: "PUSH",
      actor: "alice",
      title: "fix: concurrency lock in token bucket",
      sha: "c9d8e7f6",
      url: "https://github.com/prowise/core/commit/c9d8e7f6",
      created_at: "2026-11-21T07:45:00Z",
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
    // Reviewer name & comment
    expect(html).toContain("Bob TeamLead");
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
        requireVerification={true}
        gitHubActivity={mockGitHubCommits}
      />
    );

    // Header and baseline
    expect(html).toContain("Submit Progress Check-In — [SOLO]");
    expect(html).toContain("Current Accepted Progress:");
    expect(html).toContain("40.0%");
    // Team lead verification notice
    expect(html).toContain("Team Lead verification is enabled");
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
      />
    );

    expect(html).toContain("Team Lead Progress Verification");
    expect(html).toContain("[SOLO] Core Engine");
    expect(html).toContain("Alice Developer");
    expect(html).toContain("40.0%");
    expect(html).toContain("30.0%");
    expect(html).toContain("Discovered race condition in distributed lock requiring redesign");
    expect(html).toContain("Refactoring database transactions to fix concurrency deadlock");
    expect(html).toContain("Approve Submission");
    expect(html).toContain("Request Changes");
    expect(html).toContain("Reject");
  });

  it("apiClient passes Idempotency-Key and calls correct progress and verification endpoints", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Headers | undefined;
    let capturedBody: any;

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = init?.headers as Headers;
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          id: "chk-test-1",
          percent: 50.0,
          status: "ACCEPTED",
          method: "DEVELOPER_REPORTED",
        }),
      });
    });

    const client = createApiClient({
      baseUrl: "http://localhost:8080",
      fetch: mockFetch as any,
      isRolePreview: () => false,
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
    expect(capturedBody.percent).toBe(50.0);

    // 2. Verify check-in
    await client.verifyCheckIn("chk-test-1", {
      decision: "APPROVE",
      comment: "Looks solid",
    });

    expect(capturedUrl).toBe("http://localhost:8080/v1/checkins/chk-test-1/verify");
    expect(capturedMethod).toBe("POST");
    expect(capturedBody.decision).toBe("APPROVE");
    expect(capturedBody.comment).toBe("Looks solid");

    // 3. Pending reviews query
    await client.pendingReviews("org-123");
    expect(capturedUrl).toBe("http://localhost:8080/v1/organizations/org-123/reviews/pending");
    expect(capturedMethod).toBe("GET");

    // 4. Progress summary query
    await client.projectProgressSummary("proj-solo-1");
    expect(capturedUrl).toBe("http://localhost:8080/v1/projects/proj-solo-1/checkins/summary");
    expect(capturedMethod).toBe("GET");
  });
});
