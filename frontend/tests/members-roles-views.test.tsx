import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MembersView } from "../src/components/owner/MembersView";
import { RolesView } from "../src/components/owner/RolesView";
import { OwnerLaterBadge } from "../src/components/owner/OwnerLaterBadge";
import { FIXTURE_MEMBERS, FIXTURE_ROLES } from "../src/lib/fixtures/org-admin";
import { FIXTURE_GRANTS } from "../src/lib/fixtures/permissions";
import { canWithGrants } from "../src/lib/permissions";
import type { PermissionKey } from "../src/types/permission";

const canFor = (role: keyof typeof FIXTURE_GRANTS) => (key: PermissionKey) => canWithGrants(FIXTURE_GRANTS[role], key);
const members = FIXTURE_MEMBERS("org-acme");

describe("OwnerLaterBadge", () => {
  it("renders the standard Later label", () => {
    expect(renderToStaticMarkup(<OwnerLaterBadge task="1.2" />)).toContain("Later · task 1.2");
  });

  it("renders the after-task variant for work gated on another task", () => {
    expect(renderToStaticMarkup(<OwnerLaterBadge task="1.4" after />)).toContain("Later · after task 1.4");
  });
});

describe("MembersView", () => {
  const render = (props: Partial<React.ComponentProps<typeof MembersView>> = {}) =>
    renderToStaticMarkup(
      <MembersView
        family="owner"
        orgId="org-acme"
        members={members}
        source="fixture"
        can={canFor("ORGANIZATION_OWNER")}
        isCurrentOwner
        {...props}
      />,
    );

  it("lists members with name, email and status", () => {
    const markup = render();
    expect(members.length).toBeGreaterThan(0);
    expect(markup).toContain(members[0].displayName);
    expect(markup).toContain(members[0].email);
    expect(markup).toContain("Active");
  });

  it("marks every write as Later and wires no write handler", () => {
    const markup = render();
    expect(markup).toContain("Later · task 1.2");
    expect(markup).not.toMatch(/<button(?![^>]*disabled)[^>]*>\s*(Disable|Transfer ownership|Invite member)/);
  });

  it("shows transfer ownership only to the current owner holding org.manage", () => {
    expect(render()).toContain("Transfer ownership");
    expect(render({ isCurrentOwner: false })).not.toContain("Transfer ownership");
    expect(render({ family: "admin", can: canFor("ORGANIZATION_ADMIN"), isCurrentOwner: true })).not.toContain(
      "Transfer ownership",
    );
  });

  it("hides actions whose keys are missing", () => {
    const onlyRoleManage = (key: PermissionKey) => key === "role.manage";
    const markup = render({ can: onlyRoleManage, isCurrentOwner: false });
    expect(markup).not.toContain("Invite member");
    expect(markup).not.toContain(">Disable<");
  });

  it("shows the forbidden state without role.manage (the member list API requires it)", () => {
    const markup = render({ can: (key) => key === "member.invite" });
    expect(markup).toContain("Access Restricted");
    expect(markup).toContain("role.manage");
    expect(markup).not.toContain(members[0].email);
  });

  it("shows a specific empty state", () => {
    expect(render({ members: [] })).toContain("No members yet");
  });

  it("keeps admin links inside the admin family", () => {
    const markup = render({ family: "admin", can: canFor("ORGANIZATION_ADMIN"), isCurrentOwner: false });
    expect(markup).not.toContain("/owner/");
  });
});

describe("RolesView", () => {
  const render = (props: Partial<React.ComponentProps<typeof RolesView>> = {}) =>
    renderToStaticMarkup(
      <RolesView
        roles={FIXTURE_ROLES}
        source="fixture"
        canManageRoles
        heldGrants={FIXTURE_GRANTS.ORGANIZATION_OWNER}
        {...props}
      />,
    );

  it("lists template and custom roles with their keys", () => {
    const markup = render();
    expect(markup).toContain("Organization Owner");
    expect(markup).toContain("Template");
    expect(markup).toContain("Custom");
    expect(markup).toContain("org.manage");
  });

  it("is read-only: writes are visible only with role.manage and always Later", () => {
    const markup = render();
    expect(markup).toContain("Create custom role");
    expect(markup).toContain("Later · after task 1.4");
    expect(markup).not.toContain("Later · task 1.3");
    expect(markup).not.toMatch(/<button(?![^>]*disabled)[^>]*>\s*(Create custom role|Edit role|Grant role)/);
  });

  it("shows the forbidden state without role.manage", () => {
    const markup = render({ canManageRoles: false });
    expect(markup).toContain("Access Restricted");
    expect(markup).not.toContain("Create custom role");
  });

  it("tells an admin which keys they cannot grant", () => {
    const markup = render({ heldGrants: FIXTURE_GRANTS.ORGANIZATION_ADMIN });
    expect(markup).toContain("You cannot grant");
  });

  it("shows a specific empty state", () => {
    expect(render({ roles: [] })).toContain("No roles defined");
  });
});
