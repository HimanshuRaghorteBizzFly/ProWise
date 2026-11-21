import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccessMapView } from "../src/components/owner/AccessMapView";
import { FIXTURE_GRANTS } from "../src/lib/fixtures/permissions";
import { PERMISSION_KEYS } from "../src/lib/permissions";

const render = (props: Partial<React.ComponentProps<typeof AccessMapView>> = {}) =>
  renderToStaticMarkup(
    <AccessMapView
      family="owner"
      grants={FIXTURE_GRANTS.ORGANIZATION_OWNER}
      source="fixture"
      scopeReported
      isCurrentOwner
      {...props}
    />,
  );

describe("Access Map", () => {
  it("lists all 22 documented keys", () => {
    const markup = render();
    for (const key of PERMISSION_KEYS) expect(markup).toContain(key);
  });

  it("summarises allowed and denied counts for the owner", () => {
    const markup = render();
    expect(markup).toContain("21 allowed");
    expect(markup).toContain("2 denied"); // progress override (every role) and check-in approval (Team Lead only, task 2.2)
  });

  it("explains that progress override is denied to every role", () => {
    expect(render()).toContain("Denied to every role");
  });

  it("explains missing grants for the admin and keeps owner-only actions denied", () => {
    const markup = render({ family: "admin", grants: FIXTURE_GRANTS.ORGANIZATION_ADMIN, isCurrentOwner: false });
    expect(markup).toContain("10 allowed");
    expect(markup).toContain("13 denied");
    expect(markup).toContain("Not granted to your active membership");
    expect(markup).toContain("Transfer ownership");
    expect(markup).toContain("Only the current owner with org.manage");
    expect(markup).toContain("You cannot grant permissions you do not hold");
  });

  it("shows transfer ownership as allowed-but-later only for the current owner", () => {
    expect(render()).toContain("Later · task 1.2");
    expect(render({ isCurrentOwner: false })).toContain("Only the current owner with org.manage");
  });

  it("warns when the API does not report scope", () => {
    const markup = render({
      source: "api",
      scopeReported: false,
      grants: [{ key: "project.read", scope: "ORG" }],
    });
    expect(markup).toContain("Scope not reported by API");
    expect(markup).not.toContain("Sample data");
  });

  it("shows project scope for project-scoped grants", () => {
    const markup = render({ family: "admin", grants: FIXTURE_GRANTS.DEVELOPER, isCurrentOwner: false });
    expect(markup).toContain("Project: proj-individual-solo");
    expect(markup).not.toContain("Scope not reported by API");
  });

  it("labels fixture data", () => {
    expect(render()).toContain("Sample data");
  });
});
