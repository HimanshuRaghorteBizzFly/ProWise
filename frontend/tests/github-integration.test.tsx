import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type {
  DraftViewDto, GitHubAppStatusDto, GitHubConnectionDto, GitHubFeedItemDto, GitHubFeedPageDto, GitHubInstallationDto,
} from "../src/types/flow";

// GitHub through the Prowise GitHub App: connect once per organization, a repository + branch per project, the
// activity tab. Real API shapes only; every state (not configured, not connected, empty, connected) is covered.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/manager/projects/p-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: () => true, retry: () => undefined }),
}));

const { OrgGitHubIntegration, GitHubRepoPicker, AppConnectionView, GitHubActivityPanel, FeedRow } =
  await import("../src/components/flow/GitHubIntegration");
const { DraftStepView } = await import("../src/components/flow/DraftWizard");

const INSTALLATION: GitHubInstallationDto = {
  id: "inst-1", github_installation_id: 4242, account: "acme", account_type: "Organization", repository_selection: "selected",
  status: "ACTIVE", version: 0, connected_at: "2026-11-25T09:00:00Z", connected_by: "admin@example.test", project_count: 1,
  manage_url: "https://github.com/organizations/acme/settings/installations/4242",
};
const STATUS = (over: Partial<GitHubAppStatusDto> = {}): GitHubAppStatusDto => ({
  configured: true, app_slug: "prowise", can_manage: true, installations: [INSTALLATION], ...over,
});
const CONNECTION: GitHubConnectionDto = {
  connected: true, id: "prl-1", repository: "acme/web", status: "ACTIVE", connected_by: "pm@example.test",
  last_synced_at: "2026-11-25T10:00:00Z", last_error: null, webhook_url: null, version: 2, can_manage: true, webhook_secret: null,
  token_last4: null, repository_url: "https://github.com/acme/web", provider: "GITHUB_APP", branch: "main",
  installation_id: "inst-1", installation_account: "acme", private_repository: true, activity_count: 3,
};
const PULL: GitHubFeedItemDto = {
  id: "gha-1", type: "PULL_REQUEST", sha: null, pr_number: 7, title: "PRW-1 login page", message: null, author: "dev-gh",
  branch: "feature/PRW-1", base_branch: "main", state: "merged", url: "https://github.com/acme/web/pull/7",
  occurred_at: "2026-11-25T10:00:00Z", additions: 40, deletions: 5, files_changed: 4, task_keys: ["PRW-1"], source: "IMPORT",
};
const COMMIT: GitHubFeedItemDto = {
  ...PULL, id: "gha-2", type: "COMMIT", sha: "abc1234def5678", pr_number: null, title: "chore: bump deps", branch: "main",
  base_branch: null, state: null, additions: null, deletions: null, files_changed: null, task_keys: [],
};
const FEED = (over: Partial<GitHubFeedPageDto> = {}): GitHubFeedPageDto => ({
  connected: true, repository: "acme/web", repository_url: "https://github.com/acme/web", branch: "main",
  last_synced_at: "2026-11-25T10:00:00Z", last_error: null, items: [PULL, COMMIT], total: 2, page: 0, size: 20,
  branches: ["feature/PRW-1", "main"], authors: ["dev-gh"], ...over,
});

function render(node: React.ReactNode, data: [unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  data.forEach(([key, value]) => client.setQueryData(key, value));
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("Organization: connect GitHub once", () => {
  it("explains when the GitHub App is not configured on the server", () => {
    const markup = render(<OrgGitHubIntegration orgId="org-1" returnTo="/org/org-1/admin/integrations" />,
      [[["flow", "github-app", "org-1"], STATUS({ configured: false, installations: [] })]]);
    expect(markup).toContain("not set up on this server");
    expect(markup).toContain("GITHUB_APP_ID");
    expect(markup).not.toContain("Connect GitHub</button>");
  });

  it("offers Connect GitHub to Owner/Admin and tells others whom to ask", () => {
    const admin = render(<OrgGitHubIntegration orgId="org-1" returnTo="/x" />,
      [[["flow", "github-app", "org-1"], STATUS({ installations: [] })]]);
    expect(admin).toContain("GitHub is not connected");
    expect(admin).toContain("Connect GitHub");
    const member = render(<OrgGitHubIntegration orgId="org-1" returnTo="/x" />,
      [[["flow", "github-app", "org-1"], STATUS({ installations: [], can_manage: false })]]);
    expect(member).toContain("Ask them to open Integrations");
    expect(member).not.toContain(">Connect GitHub<");
  });

  it("lists connected accounts with where to choose repositories and Remove", () => {
    const markup = render(<OrgGitHubIntegration orgId="org-1" returnTo="/x" />, [[["flow", "github-app", "org-1"], STATUS()]]);
    expect(markup).toContain("acme");
    expect(markup).toContain("Selected repositories");
    expect(markup).toContain("1 project ");
    expect(markup).toContain("Choose repositories on GitHub");
    expect(markup).toContain(INSTALLATION.manage_url);
    expect(markup).toContain("Remove");
  });
});

describe("Project: pick a repository and branch", () => {
  it("asks a manager without org access to get GitHub connected first", () => {
    const markup = render(<GitHubRepoPicker orgId="org-1" target={{ projectId: "p-1" }} returnTo="/r" onDone={() => undefined} />,
      [[["flow", "github-app", "org-1"], STATUS({ installations: [], can_manage: false })]]);
    expect(markup).toContain("GitHub is not connected for this organization yet");
    expect(markup).toContain("Ask an Owner or Admin");
  });

  it("goes straight to the repositories of the only account, marking ones other projects use", () => {
    const markup = render(<GitHubRepoPicker orgId="org-1" target={{ projectId: "p-1" }} returnTo="/r" onDone={() => undefined} />, [
      [["flow", "github-app", "org-1"], STATUS()],
      [["flow", "github-repos", "p:p-1", "inst-1"], [
        { full_name: "acme/web", default_branch: "main", private_repository: true, description: "Web app", used_by_project: null },
        { full_name: "acme/api", default_branch: "main", private_repository: false, description: null, used_by_project: "Billing" },
      ]],
    ]);
    expect(markup).toContain("2. Repository");
    expect(markup).toContain("acme/web");
    expect(markup).toContain("Used by Billing");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*acme\/api/s);
  });

  it("shows the connected repository with branch, account, status and every action; never a credential", () => {
    const markup = render(<AppConnectionView orgId="org-1" projectId="p-1" connection={CONNECTION} returnTo="/r"
      onViewActivity={() => undefined} justImported={{ connected: true, ok: true, linked: 3, problem: null }} />);
    for (const text of ["acme/web", "main", "acme", "Connected", "3 recent commit(s)", "Sync now", "Change repository or branch",
      "Disconnect", "View GitHub Activity", "Prowise GitHub App webhook"]) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toMatch(/token/i);
  });

  it("shows a problem reported by GitHub", () => {
    const markup = render(<AppConnectionView orgId="org-1" projectId="p-1" returnTo="/r"
      connection={{ ...CONNECTION, status: "ERROR", last_error: "The GitHub App was uninstalled on GitHub." }} />);
    expect(markup).toContain("Needs attention");
    expect(markup).toContain("uninstalled");
  });
});

describe("GitHub Activity tab", () => {
  const key = ["flow", "github-feed", "p-1", { page: 0, size: 20 }];

  it("shows commits and pull requests with author, branch, state, task key and code changes", () => {
    const markup = render(<GitHubActivityPanel projectId="p-1" canSync />, [[key, FEED()]]);
    expect(markup).toContain("PRW-1 login page");
    expect(markup).toContain("#7");
    expect(markup).toContain("merged");
    expect(markup).toContain("feature/PRW-1 → main");
    expect(markup).toContain("+40");
    expect(markup).toContain("−5");
    expect(markup).toContain("4 files");
    expect(markup).toContain("abc1234");
    expect(markup).toContain("Sync now");
    expect(markup).toContain("Evidence only");
  });

  it("has empty and disconnected states, and no Sync for readers", () => {
    const empty = render(<GitHubActivityPanel projectId="p-1" canSync={false} />, [[key, FEED({ items: [], total: 0 })]]);
    expect(empty).toContain("No activity yet");
    expect(empty).not.toContain("Sync now");
    const disconnected = render(<GitHubActivityPanel projectId="p-1" canSync />, [[key, FEED({ connected: false, items: [], total: 0 })]]);
    expect(disconnected).toContain("No repository connected");
  });

  it("shows a dash when a commit has no stats yet", () => {
    const markup = renderToStaticMarkup(<ul><FeedRow item={COMMIT} /></ul>);
    expect(markup).toContain("—");
    expect(markup).not.toContain("+0");
  });
});

describe("Create project: repository through the organization's GitHub", () => {
  it("shows the checked repository, branch and account on the GitHub step and on Review", () => {
    const draft: DraftViewDto = {
      id: "d-1", status: "DRAFT", version: 3, name: "Orbit web", key: "ORB", description: null, mode: "SOLO",
      start_on: "2026-11-25", target_on: "2026-12-31", documents: [], phases: [], tasks: [], team_lead_membership_id: null,
      developer_membership_ids: [], qa_membership_ids: [], approver_membership_ids: [],
      repository: { connected: true, repository: "acme/web", token_last4: null, url: "https://github.com/acme/web",
        provider: "GITHUB_APP", branch: "main", installation_id: "inst-1", account: "acme" },
      can_connect_repository: true, project_id: null,
    };
    const options = { default_timezone: "UTC", today: "2026-11-25", people: [],
      limits: { max_total_points: 100, document_max_bytes: 1, screenshot_max_bytes: 1, max_phases: 30, max_tasks: 200 } };
    const data: [unknown[], unknown][] = [[["flow", "draft", "d-1"], draft], [["flow", "setup-options", "org-1"], options]];
    const step = render(<DraftStepView orgId="org-1" base="manager" draftId="d-1" step="repository" />, data);
    expect(step).toContain("acme/web");
    expect(step).toContain("via acme");
    expect(step).toContain("Change repository");
    expect(step).not.toContain("token ending");
    const review = render(<DraftStepView orgId="org-1" base="manager" draftId="d-1" step="review" />, data);
    expect(review).toContain("via acme");
  });
});
