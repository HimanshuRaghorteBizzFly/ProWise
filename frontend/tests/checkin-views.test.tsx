import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import type { CheckInDto, PendingReviewDto, ProgressSummaryDto } from "../src/types/api";

// Task 2.2 (T17, T18, T28, AS-01): Individual check-ins with Team Lead approval on the real API.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1", projectId: "p-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/developer/checkins",
}));

const {
  ApprovalQueue,
  CheckInForm,
  CheckInFormView,
  ProgressSummaryContent,
  ProjectProgressView,
  percentText,
  validateCheckIn,
} = await import("../src/components/progress/CheckInViews");

function entry(extra: Partial<CheckInDto> = {}): CheckInDto {
  return {
    id: "c-1",
    project_id: "p-1",
    revision_seq: 1,
    revision_of: null,
    percent: 45,
    accomplished: "Lead import works",
    next_steps: "Test call routing",
    blockers: null,
    projected_finish: "2026-11-20",
    evidence: null,
    downward_reason: null,
    status: "PENDING",
    method: "developer_reported",
    label: "Developer reported",
    author: { user_id: "u-dev", email: "dev@example.test" },
    submitted_at: "2026-11-02T09:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    version: 0,
    ...extra,
  };
}

function summary(extra: Partial<ProgressSummaryDto> = {}): ProgressSummaryDto {
  return {
    project_id: "p-1",
    project_key: "CRM",
    project_name: "Customer portal",
    mode: "INDIVIDUAL",
    lifecycle: "ACTIVE",
    archived: false,
    current: { percent: null, label: "Not reported", method: null, reported_at: null, approved_at: null, checkin_id: null },
    pending: null,
    approver: { user_id: "u-lead", email: "lead@example.test" },
    approver_note: null,
    can_submit: true,
    can_decide: false,
    history: [],
    ...extra,
  };
}

const APPROVED_40 = {
  percent: 40, label: "Developer reported", method: "developer_reported" as const,
  reported_at: "2026-11-01T09:00:00Z", approved_at: "2026-11-01T10:00:00Z", checkin_id: "c-0",
};

function render(node: React.ReactElement, seed: (client: QueryClient) => void = () => undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("check-in API client", () => {
  it("submits with the caller's Idempotency-Key, decides with expected_version, reads the queue", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({})));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await client.submitCheckIn("p-1", { percent: 45, accomplished: "a", next_steps: "b" }, "key-1");
    await client.submitCheckIn("p-1", { percent: 45, accomplished: "a", next_steps: "b" }, "key-1");
    await client.decideCheckIn("c-1", { decision: "REJECT", reason: "Demo fails", expected_version: 2 });
    await client.pendingReviews("org-1");
    await client.progressSummary("p-1");

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/projects/p-1/checkins");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get(IDEMPOTENCY_KEY_HEADER)).toBe("key-1");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get(IDEMPOTENCY_KEY_HEADER)).toBe("key-1"); // replay-safe retry
    expect(fetchMock.mock.calls[2][0]).toBe("http://api.test/v1/checkins/c-1/decision");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ decision: "REJECT", reason: "Demo fails", expected_version: 2 });
    expect(fetchMock.mock.calls[3][0]).toBe("http://api.test/v1/organizations/org-1/reviews/pending");
    expect(fetchMock.mock.calls[4][0]).toBe("http://api.test/v1/projects/p-1/checkins/summary");
  });
});

describe("project progress (T28, AS-01)", () => {
  it("shows Not reported when nothing is approved, never 0%", () => {
    const html = render(<ProgressSummaryContent summary={summary()} submitHref="/new" />);
    expect(html).toContain("Not reported");
    expect(html).not.toContain(">0%<");
    expect(html).toContain("New check-in");
  });

  it("keeps the approved figure and shows the pending entry separately", () => {
    const html = render(<ProgressSummaryContent summary={summary({
      current: APPROVED_40,
      pending: entry({ percent: 60, revision_seq: 2 }),
      can_submit: false,
      history: [entry({ percent: 60, revision_seq: 2 }), entry({ id: "c-0", status: "APPROVED", percent: 40,
        decided_by: { user_id: "u-lead", email: "lead@example.test" }, decided_at: "2026-11-01T10:00:00Z" })],
    })} submitHref="/new" />);
    expect(html).toMatch(/data-testid="approved-figure".*40%/s);
    expect(html).toContain("Developer reported · reported");
    expect(html).toMatch(/data-testid="pending-entry".*60% proposed/s);
    expect(html).toContain("Team Lead lead@example.test decides");
    expect(html).toContain("Approved by lead@example.test");
    expect(html).toContain("method developer_reported");
    expect(html).not.toContain("New check-in"); // one pending entry at a time
  });

  it("explains a missing team lead and that 100% does not deliver", () => {
    const noLead = render(<ProgressSummaryContent summary={summary({
      approver: null, approver_note: "No team lead is assigned to this project's team, so check-ins stay pending until one is.",
      pending: entry(),
    })} />);
    expect(noLead).toContain("No team lead is assigned");
    const full = render(<ProgressSummaryContent summary={summary({ current: { ...APPROVED_40, percent: 100 } })} />);
    expect(full).toContain("Delivery still needs a separate, authorized acceptance");
  });

  it("renders the page from the summary query, and an unreadable project as not found", () => {
    const seeded = render(
      <ProjectProgressView projectId="p-1" crumbs={[]} back={{ href: "/back", label: "Back" }} submitHref="/new" />,
      (client) => client.setQueryData(["progress-summary", "p-1"], summary({ current: APPROVED_40 })),
    );
    expect(seeded).toContain("CRM · Customer portal");
    expect(seeded).toContain("40%");
    expect(seeded).toContain("/back");
  });
});

describe("developer check-in form (T17, T18)", () => {
  it("validates range and required text, and asks for a reason only below the approved figure", () => {
    const base = { percent: "45", accomplished: "a", nextSteps: "b", blockers: "", projectedFinish: "", evidence: "", downwardReason: "" };
    expect(validateCheckIn(base, null)).toEqual({});
    expect(validateCheckIn({ ...base, percent: "101" }, null).percent).toBeTruthy();
    expect(validateCheckIn({ ...base, percent: "-1" }, null).percent).toBeTruthy();
    expect(validateCheckIn({ ...base, percent: "" }, null).percent).toBeTruthy();
    expect(validateCheckIn({ ...base, accomplished: " " }, null).accomplished).toBeTruthy();
    expect(validateCheckIn({ ...base, percent: "30" }, 45).downwardReason).toContain("approved 45%");
    expect(validateCheckIn({ ...base, percent: "30", downwardReason: "Found a race" }, 45)).toEqual({});
    expect(validateCheckIn({ ...base, percent: "50" }, 45)).toEqual({});
  });

  it("is a page form (no dialog) that says it stays pending until approved", () => {
    const html = render(
      <CheckInFormView projectId="p-1" crumbs={[]} back={{ href: "/progress", label: "Back to progress" }} />,
      (client) => client.setQueryData(["progress-summary", "p-1"], summary({ current: APPROVED_40 })),
    );
    expect(html).toContain('data-testid="checkin-form"');
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain("Submit for approval");
    expect(html).toContain("stays pending until your Team Lead approves it");
    expect(html).toContain("Back to progress");
  });

  it("does not offer the form while an entry is pending or to someone who is not accountable", () => {
    const pending = render(<CheckInForm projectId="p-1" backHref="/p" summary={summary({ can_submit: false, pending: entry() })} />);
    expect(pending).toContain("waiting for the Team Lead");
    expect(pending).not.toContain('data-testid="checkin-form"');
    const other = render(<CheckInForm projectId="p-1" backHref="/p" summary={summary({ can_submit: false })} />);
    expect(other).toContain("Only the project&#x27;s accountable developer reports its progress.");
  });
});

describe("Team Lead approval queue", () => {
  const item: PendingReviewDto = {
    project_id: "p-1", project_key: "CRM", project_name: "Customer portal", current: APPROVED_40,
    checkin: entry({ percent: 30, revision_seq: 2, downward_reason: "Found a race", version: 3 }),
  };

  it("shows current and proposed side by side with approve and reject actions inline", () => {
    const html = render(<ApprovalQueue items={[item]} onStale={() => undefined} />);
    expect(html).toContain("CRM · Customer portal");
    expect(html).toContain("Current (approved)");
    expect(html).toContain("40%");
    expect(html).toContain("Proposed");
    expect(html).toContain("30%");
    expect(html).toContain("Found a race");
    expect(html).toContain("Approve 30%");
    expect(html).toContain("Reject");
    expect(html).not.toContain('role="dialog"');
  });

  it("shows an empty state when nothing waits", () => {
    expect(render(<ApprovalQueue items={[]} onStale={() => undefined} />)).toContain("Nothing to approve");
  });

  it("formats figures without inventing zero", () => {
    expect(percentText(null)).toBe("Not reported");
    expect(percentText(45)).toBe("45%");
    expect(percentText(12.5)).toBe("12.5%");
  });
});
