import { describe, expect, it } from "vitest";

import { getNavigationConfig } from "../src/config/navigation";
import type { PermissionKey } from "../src/types/permission";

const flatten = (can: (key: PermissionKey) => boolean) =>
  getNavigationConfig("PROJECT_MANAGER", "org-acme", can).flatMap((section) => section.items);

describe("Project Manager navigation", () => {
  it("uses permission grants and omits pages outside the approved routes", () => {
    const items = flatten((key) => key === "project.read" || key === "project.create");

    expect(items.map((item) => item.title)).toContain("Create & plan");
    expect(items.map((item) => item.title)).not.toContain("Reviews");
    expect(items.map((item) => item.title)).not.toContain("Settings");
    expect(items.some((item) => item.href.endsWith("/project-planning"))).toBe(false);
  });

  it("hides create-and-plan when project.create is absent", () => {
    const items = flatten((key) => key === "project.read");
    expect(items.map((item) => item.title)).not.toContain("Create & plan");
  });
});
