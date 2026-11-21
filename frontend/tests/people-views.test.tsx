import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import type { InvitationDto, MemberOwnershipDto, OwnershipDto, RoleDto } from "../src/types/api";

// Task 1.2 (T02, T03): people screens on the real API.

const allowed = new Set<string>();

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1", memberId: "m-2" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/owner/members",
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: (key: string) => allowed.has(key), retry: () => undefined }),
}));

const { InvitationsListView, InviteMemberView, MemberDisableView, TransferOwnershipView } = await import(
  "../src/components/org-console/ApiPeopleViews"
);

function render(node: React.ReactElement, seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const INVITATION: InvitationDto = {
  id: "i-1",
  email: "dana@example.test",
  template_role_id: "r-dev",
  role_name: "DEVELOPER",
  team_id: null,
  team_name: null,
  status: "EXPIRED",
  expires_at: "2026-11-20T10:00:00Z",
  invited_by_email: "owner@example.test",
  created_at: "2026-11-13T10:00:00Z",
  last_sent_at: "2026-11-13T10:00:00Z",
  send_count: 1,
  accepted_at: null,
  revoked_at: null,
  version: 0,
};

function role(name: string, keys: string[], extra: Partial<RoleDto> = {}): RoleDto {
  return { id: `r-${name}`, name, template: true, owner_only: false, version: 0, grant_count: 0, permission_keys: keys, ...extra };
}

beforeEach(() => {
  allowed.clear();
});

describe("people API client", () => {
  it("creates an invitation with an Idempotency-Key and keeps tokens out of URLs", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    await client.createInvitation("org-1", { email: "a@b.test", template_role_id: "r", expires_in_days: 7 });
    await client.previewInvitation("secret-token");
    await client.acceptInvitation("secret-token");
    await client.changeMemberStatus("org-1", "m-1", { status: "DISABLED", expected_version: 3, emergency: true });
    await client.transferOwnership("org-1", { new_owner_membership_id: "m-2", confirmation: "acme", expected_version: 4 });

    const [createUrl, createInit] = fetchMock.mock.calls[0];
    expect(createUrl).toBe("http://api.test/v1/organizations/org-1/invitations");
    expect(new Headers(createInit.headers).get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
    for (const call of fetchMock.mock.calls.slice(1, 3)) {
      expect(String(call[0])).not.toContain("secret-token");
      expect(JSON.parse(call[1].body)).toEqual({ token: "secret-token" });
    }
    expect(fetchMock.mock.calls[3][0]).toBe("http://api.test/v1/organizations/org-1/members/m-1/status");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({ status: "DISABLED", emergency: true, expected_version: 3 });
    expect(fetchMock.mock.calls[4][0]).toBe("http://api.test/v1/organizations/org-1/ownership/transfer");
  });
});

describe("invitations", () => {
  it("lists invitations with their effective status and never a link or token", () => {
    allowed.add("member.invite");
    const markup = render(<InvitationsListView family="owner" />, (client) => client.setQueryData(["invitations", "org-1"], [INVITATION]));
    expect(markup).toContain("dana@example.test");
    expect(markup).toContain("EXPIRED");
    expect(markup).toContain("Invite member");
    expect(markup.toLowerCase()).not.toContain("token");
  });

  it("does not offer roles above the inviter's own powers and never the owner role", () => {
    allowed.add("member.invite");
    allowed.add("project.read");
    const roles = [
      role("ORGANIZATION_OWNER", ["org.manage"], { owner_only: true }),
      role("PROJECT_MANAGER", ["project.read", "project.edit"]),
      role("VIEWER", ["project.read"]),
    ];
    const markup = render(<InviteMemberView family="admin" />, (client) => {
      client.setQueryData(["roles", "org-1"], roles);
      client.setQueryData(["teams", "org-1"], []);
    });
    expect(markup).not.toContain("r-ORGANIZATION_OWNER");
    expect(markup).toMatch(/<option value="r-PROJECT_MANAGER" disabled="">[^<]*needs 1 permission you don&#x27;t hold/);
    expect(markup).toMatch(/<option value="r-VIEWER">/);
  });
});

describe("departure handover", () => {
  it("shows what the member owns and both planned and emergency paths on its own page", () => {
    allowed.add("member.disable");
    const ownership: MemberOwnershipDto = {
      id: "m-2",
      email: "leaver@example.test",
      status: "ACTIVE",
      role_template: "DEVELOPER",
      version: 2,
      owned: [
        { subject_type: "TEAM_LEAD", subject_id: "t-1", label: "Lead of team Mobile" },
        { subject_type: "PROJECT_OWNER", subject_id: "p-1", label: "Accountable owner of project Checkout" },
      ],
    };
    const markup = render(<MemberDisableView family="owner" memberId="m-2" />, (client) => {
      client.setQueryData(["member-ownership", "org-1", "m-2"], ownership);
      client.setQueryData(["members", "org-1"], [
        { id: "m-2", display_name: "x", email: "leaver@example.test", status: "ACTIVE", role_template: "DEVELOPER", version: 2 },
        { id: "m-3", display_name: "y", email: "heir@example.test", status: "ACTIVE", role_template: "DEVELOPER", version: 0 },
      ]);
    });
    expect(markup).toContain("Lead of team Mobile");
    expect(markup).toContain("Accountable owner of project Checkout");
    expect(markup).toContain("Planned handover");
    expect(markup).toContain("Emergency disable");
    expect(markup).toContain("heir@example.test");
    expect(markup).toContain("Back to member");
    expect(markup).not.toContain('role="dialog"');
  });
});

describe("ownership transfer", () => {
  const base: OwnershipDto = {
    owner_membership_id: "m-1",
    owner_email: "owner@example.test",
    organization_slug: "acme",
    version: 4,
    caller_is_owner: true,
    eligible: [{ membership_id: "m-2", email: "next@example.test", role_template: "ORGANIZATION_ADMIN" }],
  };

  it("lets the current owner choose an eligible active member", () => {
    allowed.add("org.manage");
    const markup = render(<TransferOwnershipView />, (client) => client.setQueryData(["ownership", "org-1"], base));
    expect(markup).toContain("1 · Choose the new owner");
    expect(markup).toContain("next@example.test");
  });

  it("tells anyone else that only the owner can transfer", () => {
    allowed.add("org.manage");
    const markup = render(<TransferOwnershipView />, (client) =>
      client.setQueryData(["ownership", "org-1"], { ...base, caller_is_owner: false }));
    expect(markup).toContain("Only the owner can transfer");
    expect(markup).not.toContain("Choose the new owner");
  });
});
