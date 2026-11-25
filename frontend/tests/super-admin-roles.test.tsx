import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import { createCommercialApi, type CallInit } from "../src/lib/admin-api/commercial";
import type { CapabilityCatalog, GovernanceRole } from "../src/types/admin-roles";
import { STALE_VERSION_MESSAGE, MutationErrorNotice } from "../src/components/super-admin/commercial/mutation";
import { RolesGovernanceView, type RolesGovernanceViewProps } from "../src/components/super-admin/roles/RolesGovernanceView";
import { PermissionMatrix, detailsChanges } from "../src/components/super-admin/roles/RoleDialogs";
import {
  filterRoles,
  groupByTier,
  keysOwnersCannotGrant,
  modulesForScope,
  permissionDiff,
  rankPillLabel,
  resyncItems,
  roleKpis,
  roleMenu,
  slugify,
  tabCounts,
  toggleModule,
  validateRoleDetails,
} from "../src/components/super-admin/roles/role-model";

const noop = () => {};

function role(over: Partial<GovernanceRole> & Pick<GovernanceRole, "id" | "slug" | "name">): GovernanceRole {
  return {
    subtitle: null,
    description: null,
    kind: "ORGANIZATION_TEMPLATE",
    scope: "ORGANIZATION",
    tier: 2,
    tier_name: "Tenant Administration",
    rank: null,
    rank_label: "#?",
    is_system: true,
    is_active: true,
    is_protected: false,
    permissions_editable: true,
    assignable: true,
    enforcement: "ORGANIZATION_TEMPLATE",
    enforcement_note: "Enforced for every organization through grants.",
    color: "blue",
    icon: "Shield",
    template_name: null,
    permissions: [],
    capability_count: 0,
    catalog_size: 40,
    user_count: 0,
    organization_count: 0,
    baseline_drift: false,
    baseline_permissions: null,
    created_by: null,
    created_at: null,
    updated_at: null,
    version: 0,
    ...over,
  };
}

const superAdmin = role({
  id: "sa", slug: "super-admin", name: "Super Admin", subtitle: "Platform Root Authority", kind: "SUPER_ADMIN",
  scope: "PLATFORM", tier: 1, tier_name: "Platform Governance", rank: 1, rank_label: "#1", is_protected: true,
  permissions_editable: false, enforcement: "PLATFORM_AUTHORITY", capability_count: 40, user_count: 2, color: "amber",
  permissions: ["platform.roles.manage", "org.manage", "role.manage", "project.read"], baseline_drift: null,
});
const operator = role({
  id: "po", slug: "platform-operator", name: "Platform Operator", kind: "PLATFORM_OPERATOR", scope: "PLATFORM", tier: 1,
  tier_name: "Platform Governance", rank: 2, rank_label: "#2", enforcement: "OPERATOR_DEPARTMENTS", capability_count: 12,
  user_count: 3, permissions: ["incidents.management:view"],
});
const owner = role({
  id: "oo", slug: "organization-owner", name: "Organization Owner", subtitle: "Tenant Ownership & Billing", rank: 3,
  rank_label: "#3", capability_count: 3, user_count: 5, organization_count: 5,
  permissions: ["org.manage", "role.manage", "project.read"],
});
const developer = role({
  id: "dev", slug: "developer", name: "Developer", tier: 4, tier_name: "Engineering & Quality Verification", rank: 7,
  rank_label: "#7", capability_count: 2, user_count: 11, permissions: ["project.read", "task.update"], baseline_drift: true,
});
const custom = role({
  id: "c1", slug: "release-manager", name: "Release Manager", description: "Ships releases", kind: "CUSTOM", tier: 4,
  tier_name: "Engineering & Quality Verification", rank_label: "#7.1", is_system: false, capability_count: 1,
  permissions: ["report.export"], is_active: false, baseline_drift: null,
});
const ROLES = [superAdmin, operator, owner, developer, custom];

const CATALOG: CapabilityCatalog = {
  total: 6,
  module_count: 3,
  modules: [
    { id: "platform-root", name: "Platform Root", group: "root", scope: "PLATFORM", capabilities: [
      { key: "platform.roles.manage", action: "manage", label: "Govern roles", description: "d", risk: "HIGH", scope: "PLATFORM", super_admin_only: true },
    ] },
    { id: "projects", name: "Projects", group: "org", scope: "ORGANIZATION", capabilities: [
      { key: "project.read", action: "read", label: "View projects", description: "d", risk: "LOW", scope: "ORGANIZATION", super_admin_only: false },
      { key: "task.update", action: "update", label: "Update tasks", description: "d", risk: "LOW", scope: "ORGANIZATION", super_admin_only: false },
      { key: "report.export", action: "export", label: "Export reports", description: "d", risk: "MEDIUM", scope: "ORGANIZATION", super_admin_only: false },
    ] },
    { id: "ops-incidents", name: "Operator · Incidents", group: "ops", scope: "PLATFORM", capabilities: [
      { key: "incidents.management:view", action: "view", label: "View · Incidents", description: "d", risk: "LOW", scope: "PLATFORM", super_admin_only: false },
      { key: "incidents.management:edit", action: "edit", label: "Edit · Incidents", description: "d", risk: "MEDIUM", scope: "PLATFORM", super_admin_only: false },
    ] },
  ],
};

function viewProps(over: Partial<RolesGovernanceViewProps> = {}): RolesGovernanceViewProps {
  return {
    roles: { status: "ready", data: ROLES },
    catalog: { status: "ready", data: CATALOG },
    onRetry: noop, onCreate: noop, onCompare: noop, onAuditLog: noop, onResync: noop, onPreview: noop, onEdit: noop, onMenu: noop,
    ...over,
  };
}

/* ------------------------------------------------------------------ typed client */

describe("roles client", () => {
  function setup() {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: noop });
    const api = createCommercialApi(<T,>(path: string, init: CallInit = {}) => client.call<T>(path, init));
    const calls = () =>
      fetchMock.mock.calls.map(([url, init]) => ({
        url: String(url).replace("http://api.test", ""),
        method: init.method as string,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        key: new Headers(init.headers).get(IDEMPOTENCY_KEY_HEADER),
      }));
    return { api, calls };
  }

  it("calls the governance endpoints with expected_version and Idempotency-Key on mutations", async () => {
    const { api, calls } = setup();
    await api.roles.list();
    await api.roles.permissions();
    await api.roles.holders("dev");
    await api.roles.holderSearch("ana@");
    await api.roles.history("dev");
    await api.roles.auditLog();
    await api.roles.compare(["a", "b"]);
    await api.roles.updatePermissions("dev", 3, ["project.read"], "k1");
    await api.roles.resetBaseline("dev", 4, "k2");
    await api.roles.resyncSystem([{ id: "sa", version: 1 }, { id: "dev", version: 5 }], "k3");
    await api.roles.remove("c1", 2, "k4");

    const c = calls();
    expect(c.map((x) => `${x.method} ${x.url}`)).toEqual([
      "GET /v1/admin/roles",
      "GET /v1/admin/permissions",
      "GET /v1/admin/roles/dev/holders",
      "GET /v1/admin/roles/holder-search?q=ana%40",
      "GET /v1/admin/roles/dev/history",
      "GET /v1/admin/roles/audit-log",
      "GET /v1/admin/roles/compare?ids=a,b",
      "PUT /v1/admin/roles/dev/permissions",
      "POST /v1/admin/roles/dev/reset-baseline",
      "POST /v1/admin/roles/system/resync",
      "DELETE /v1/admin/roles/c1?expectedVersion=2",
    ]);
    expect(c[7].body).toEqual({ permissions: ["project.read"], expected_version: 3 });
    expect(c[8].body).toEqual({ expected_version: 4 });
    expect(c[9].body).toEqual({ items: [{ id: "sa", expected_version: 1 }, { id: "dev", expected_version: 5 }] });
    expect(c.slice(7).map((x) => x.key)).toEqual(["k1", "k2", "k3", "k4"]);
  });
});

/* ------------------------------------------------------------------ pure model */

describe("role model", () => {
  it("tabs, filters, search by holder and hierarchy order", () => {
    expect(tabCounts(ROLES)).toEqual({ all: 5, system: 4, custom: 1, platform: 2, organization: 3 });
    const base = { tab: "all" as const, search: "", type: "all" as const, status: "all" as const, sort: "hierarchy" as const };
    expect(filterRoles(ROLES, base).map((r) => r.id)).toEqual(["sa", "po", "oo", "dev", "c1"]);
    expect(filterRoles(ROLES, { ...base, tab: "custom" }).map((r) => r.id)).toEqual(["c1"]);
    expect(filterRoles(ROLES, { ...base, status: "inactive" }).map((r) => r.id)).toEqual(["c1"]);
    expect(filterRoles(ROLES, { ...base, search: "release" }).map((r) => r.id)).toEqual(["c1"]);
    expect(filterRoles(ROLES, { ...base, search: "ana@acme", holderMatches: new Set(["dev"]) }).map((r) => r.id)).toEqual(["dev"]);
    expect(filterRoles(ROLES, { ...base, sort: "users" })[0].id).toBe("dev");
  });

  it("groups tiers with rank ranges and counts KPIs from real data", () => {
    const groups = groupByTier(ROLES);
    expect(groups.map((g) => g.info.title)).toEqual(["Platform Governance", "Tenant Administration", "Engineering & Quality Verification"]);
    expect(groups[0].rankRange).toBe("Ranks #1 & #2");
    expect(groups[2].roles.map((r) => r.id)).toEqual(["dev", "c1"]);
    expect(roleKpis(ROLES, CATALOG)).toMatchObject({ total: 5, active: 4, system: 4, platform: 2, organization: 3, custom: 1, capabilities: 6, modules: 3 });
    expect(rankPillLabel(owner)).toBe("3. Org Owner");
    expect(rankPillLabel(developer)).toBe("7. Developer");
  });

  it("menus: Super Admin is protected, system roles reset, custom roles delete", () => {
    const sa = roleMenu(superAdmin);
    expect(sa.find((i) => i.action === "edit-details")?.disabledReason).toBeUndefined();
    expect(sa.filter((i) => i.action !== "edit-details").every((i) => i.disabledReason)).toBe(true);
    const sys = roleMenu(developer).map((i) => i.action);
    expect(sys).toContain("reset-baseline");
    expect(sys).not.toContain("delete");
    expect(roleMenu(owner).find((i) => i.action === "reset-baseline")?.disabledReason).toBeTruthy();
    const cus = roleMenu(custom);
    expect(cus.map((i) => i.action)).toEqual(["edit-details", "clone", "toggle-active", "delete"]);
    expect(cus.find((i) => i.action === "toggle-active")?.label).toBe("Activate");
    expect(roleMenu({ ...custom, user_count: 2 }).find((i) => i.action === "delete")?.disabledReason).toMatch(/Deactivate/);
  });

  it("permission matrix helpers", () => {
    expect(permissionDiff(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
    const projects = CATALOG.modules[1];
    expect(toggleModule(["project.read"], projects)).toEqual(["project.read", "report.export", "task.update"]);
    expect(toggleModule(["project.read", "report.export", "task.update"], projects)).toEqual([]);
    expect(modulesForScope(CATALOG, "ORGANIZATION").map((m) => m.id)).toEqual(["projects"]);
    expect(modulesForScope(CATALOG, "PLATFORM").map((m) => m.id)).toEqual(["ops-incidents"]);
    expect(keysOwnersCannotGrant(ROLES, ["project.read", "report.export"], "ORGANIZATION")).toEqual(["report.export"]);
    expect(keysOwnersCannotGrant(ROLES, ["x"], "PLATFORM")).toEqual([]);
  });

  it("form validation, slugs and re-sync items", () => {
    const ok = { name: "Release Manager", slug: "", subtitle: "", description: "", scope: "ORGANIZATION" as const, tier: 3, color: "blue", icon: "Shield", base_role_id: "" };
    expect(validateRoleDetails(ok)).toEqual({});
    expect(validateRoleDetails({ ...ok, tier: 1 }).tier).toBeTruthy();
    expect(validateRoleDetails({ ...ok, scope: "PLATFORM", tier: 1 })).toEqual({});
    expect(validateRoleDetails({ ...ok, name: "ab" }).name).toBeTruthy();
    expect(validateRoleDetails({ ...ok, slug: "Bad Slug" }).slug).toBeTruthy();
    expect(slugify("  QA & Release Lead! ")).toBe("qa-release-lead");
    expect(resyncItems(ROLES)).toEqual([
      { id: "sa", version: 0 }, { id: "po", version: 0 }, { id: "oo", version: 0 }, { id: "dev", version: 0 },
    ]);
    expect(detailsChanges(developer, { ...ok, name: "Developer", subtitle: "", description: "", color: "rose", icon: "Shield", tier: 4 }))
      .toEqual({ color: "rose" });
    expect(detailsChanges(developer, { ...ok, name: "Developer", color: "blue", tier: 6 })).toBeNull();
  });
});

/* ------------------------------------------------------------------ view */

describe("Roles & Permissions Governance view", () => {
  it("hierarchy tiers: header, KPIs, rank strip, real counts and rule 12", () => {
    const markup = renderToStaticMarkup(<RolesGovernanceView {...viewProps()} />);
    expect(markup).toContain("Roles &amp; Permissions Governance");
    expect(markup).toContain("4 Roles Active");
    for (const label of ["Re-sync System Roles", "Audit Log", "Compare", "Create Custom Role", "Total Roles", "System Roles",
      "Platform Roles", "Organization Roles", "Custom Roles", "Capabilities", "Across 3 core modules", "Hierarchy Tiers", "Grid",
      "All Types", "All Status", "Hierarchy Order (#1-#9)"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("grants nothing by itself");
    expect(markup).toContain("1. Super Admin");
    expect(markup).toContain("3. Org Owner");
    expect(markup).toContain("Tier 1: Platform Governance");
    expect(markup).toContain("Ranks #1 &amp; #2");
    expect(markup).toContain("Edit Permissions");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Changed from baseline");
    expect(markup).toMatch(/<strong[^>]*>11<\/strong> users/);
    expect(markup).not.toContain("<nav aria-label=\"Pagination");
  });

  it("grid view: tiles, authority line, footer actions and pagination footer", () => {
    const markup = renderToStaticMarkup(<RolesGovernanceView {...viewProps({ initialView: "grid" })} />);
    for (const label of ["Scope", "Permissions", "Users", "View", "Edit", "Clone", "Delete", "Showing", "Rows:", "Prev", "Next", "1 / 1"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("Platform Governance</span> / Platform Root Authority");
    expect(markup).toContain("release-manager");
    expect(markup).toContain("Inactive");
  });

  it("selected rank opens the detail with enforcement and capabilities by module", () => {
    const markup = renderToStaticMarkup(<RolesGovernanceView {...viewProps({ initialSelectedId: "dev" })} />);
    expect(markup).toContain("#7 Developer");
    expect(markup).toContain("Enforced for every organization through grants.");
    expect(markup).toContain("Capabilities by module (2)");
    expect(markup).toContain("Update tasks");
    expect(markup).toContain('aria-pressed="true"');
  });

  it("loading, empty and error states", () => {
    expect(renderToStaticMarkup(<RolesGovernanceView {...viewProps({ roles: { status: "loading" } })} />)).toContain('aria-label="Loading"');
    expect(renderToStaticMarkup(<RolesGovernanceView {...viewProps({ roles: { status: "ready", data: [] } })} />)).toContain("No roles defined");
    const error = renderToStaticMarkup(<RolesGovernanceView {...viewProps({ roles: { status: "error", message: "denied by server" } })} />);
    expect(error).toContain("denied by server");
    expect(error).toContain("Retry");
  });

  it("matrix: Super Admin is locked with the reason; stale writes show the reload notice", () => {
    const locked = renderToStaticMarkup(
      <PermissionMatrix modules={CATALOG.modules} selected={superAdmin.permissions} original={superAdmin.permissions} onChange={noop}
        lockedReason="Super Admin always holds every capability" />,
    );
    expect(locked).toContain("Super Admin always holds every capability");
    expect(locked).toContain("disabled");
    const diff = renderToStaticMarkup(
      <PermissionMatrix modules={[CATALOG.modules[1]]} selected={["project.read", "report.export"]} original={["project.read", "task.update"]} onChange={noop} />,
    );
    expect(diff).toContain("1 added");
    expect(diff).toContain("1 removed");
    const stale = renderToStaticMarkup(<MutationErrorNotice failure={{ kind: "stale", message: STALE_VERSION_MESSAGE }} onReload={noop} />);
    expect(stale).toContain("This record was changed by someone else. Reload to see the latest version.");
    expect(stale).toContain("Reload");
  });
});

/* ------------------------------------------------------------------ source guards */

describe("no invented people or in-memory roles in the governance page", () => {
  const root = resolve(__dirname, "../src");
  const files = [
    "app/(platform)/super-admin/roles-permissions/page.tsx",
    "components/super-admin/roles/RolesGovernanceView.tsx",
    "components/super-admin/roles/RoleDialogs.tsx",
    "components/super-admin/roles/role-model.ts",
    "types/admin-roles.ts",
  ];
  it.each(files)("%s", (file) => {
    const source = readFileSync(resolve(root, file), "utf8");
    expect(source).not.toMatch(/Marcus|Elena|Devon Lee|Jordan Mercer|assigned_users|useSuperAdminStore|_data\/seed|localStorage\.setItem/);
    expect(source).not.toMatch(/Site Reliability Engineer|Workspace Administrator|Full-Stack Developer|Executive Delivery Viewer/);
  });
});
