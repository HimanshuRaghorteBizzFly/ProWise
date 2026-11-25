/**
 * Pure helpers for the Roles & Permissions Governance page (no React, unit-tested). Everything is derived from the
 * server's role list and capability catalog; nothing here invents users, counts or roles.
 */
import { z } from "zod";
import type { CapabilityCatalog, CapabilityModule, GovernanceRole, RoleScope } from "@/types/admin-roles";

export interface TierInfo {
  tier: number;
  title: string;
  tag: string;
  scopeLabel: string;
  description: string;
}

/** The five governance tiers plus the Custom Roles tier (tier numbers come from the server). */
export const TIERS: TierInfo[] = [
  {
    tier: 1,
    title: "Platform Governance",
    tag: "Root & Ops",
    scopeLabel: "Platform Scope",
    description: "Global platform authority: root governance and delegated operations. No tenant data access by default.",
  },
  {
    tier: 2,
    title: "Tenant Administration",
    tag: "Tenant Admin",
    scopeLabel: "Organization Scope",
    description: "Ownership and administration inside one organization: members, roles, teams and settings.",
  },
  {
    tier: 3,
    title: "Delivery Leadership",
    tag: "Delivery & Teams",
    scopeLabel: "Organization Scope",
    description: "Plans and steers delivery: milestones, scope, deadlines, workload and check-in approval.",
  },
  {
    tier: 4,
    title: "Engineering & Quality Verification",
    tag: "Engineering & QA",
    scopeLabel: "Organization Scope",
    description: "Builds and verifies the work: task updates, progress check-ins and review of submitted work.",
  },
  {
    tier: 5,
    title: "Stakeholder & Read-Only Governance",
    tag: "Read-Only",
    scopeLabel: "Organization Scope",
    description: "Visibility without change: dashboards, project progress and health.",
  },
  {
    tier: 6,
    title: "Custom Roles",
    tag: "Custom",
    scopeLabel: "Platform or Organization",
    description: "Roles created by a Super Admin that do not belong to one of the governance tiers.",
  },
];

export function tierInfo(tier: number): TierInfo {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[TIERS.length - 1];
}

/** Short labels for the rank selector strip. */
const SHORT_NAMES: Record<string, string> = {
  "organization-owner": "Org Owner",
  "organization-admin": "Org Admin",
};

export function rankPillLabel(role: GovernanceRole): string {
  return `${role.rank ?? ""}. ${SHORT_NAMES[role.slug] ?? role.name}`;
}

export type RoleTab = "all" | "system" | "custom" | "platform" | "organization";
export type TypeFilter = "all" | "system" | "custom";
export type StatusFilter = "all" | "active" | "inactive";
export type SortKey = "hierarchy" | "name" | "users" | "capabilities";

export const TAB_LABELS: Record<RoleTab, string> = {
  all: "All Roles",
  system: "System Roles",
  custom: "Custom Roles",
  platform: "Platform Scope",
  organization: "Organization Scope",
};

export function inTab(role: GovernanceRole, tab: RoleTab): boolean {
  switch (tab) {
    case "system":
      return role.is_system;
    case "custom":
      return !role.is_system;
    case "platform":
      return role.scope === "PLATFORM";
    case "organization":
      return role.scope === "ORGANIZATION";
    default:
      return true;
  }
}

export function tabCounts(roles: GovernanceRole[]): Record<RoleTab, number> {
  const tabs: RoleTab[] = ["all", "system", "custom", "platform", "organization"];
  return Object.fromEntries(tabs.map((t) => [t, roles.filter((r) => inTab(r, t)).length])) as Record<RoleTab, number>;
}

export interface RoleQuery {
  tab: RoleTab;
  search: string;
  type: TypeFilter;
  status: StatusFilter;
  sort: SortKey;
  /** Role ids whose real holders match the search text (server holder search). */
  holderMatches?: ReadonlySet<string>;
}

/** Hierarchy order: tier, then system rank, then the server's order (custom roles after their tier's system roles). */
function hierarchyCompare(order: Map<string, number>) {
  return (a: GovernanceRole, b: GovernanceRole) =>
    a.tier - b.tier ||
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
}

export function filterRoles(roles: GovernanceRole[], q: RoleQuery): GovernanceRole[] {
  const text = q.search.trim().toLowerCase();
  const order = new Map(roles.map((r, i) => [r.id, i]));
  const rows = roles.filter((r) => {
    if (!inTab(r, q.tab)) return false;
    if (q.type === "system" && !r.is_system) return false;
    if (q.type === "custom" && r.is_system) return false;
    if (q.status === "active" && !r.is_active) return false;
    if (q.status === "inactive" && r.is_active) return false;
    if (!text) return true;
    return (
      r.name.toLowerCase().includes(text) ||
      r.slug.toLowerCase().includes(text) ||
      (r.description ?? "").toLowerCase().includes(text) ||
      (r.subtitle ?? "").toLowerCase().includes(text) ||
      (q.holderMatches?.has(r.id) ?? false)
    );
  });
  const byHierarchy = hierarchyCompare(order);
  return [...rows].sort((a, b) => {
    switch (q.sort) {
      case "name":
        return a.name.localeCompare(b.name);
      case "users":
        return b.user_count - a.user_count || byHierarchy(a, b);
      case "capabilities":
        return b.capability_count - a.capability_count || byHierarchy(a, b);
      default:
        return byHierarchy(a, b);
    }
  });
}

export interface TierGroup {
  info: TierInfo;
  roles: GovernanceRole[];
  rankRange: string | null;
}

/** Tier panels in tier order; empty tiers are left out. */
export function groupByTier(roles: GovernanceRole[]): TierGroup[] {
  return TIERS.map((info) => {
    const inTier = roles.filter((r) => r.tier === info.tier);
    const ranks = inTier.map((r) => r.rank).filter((n): n is number => n !== null).sort((a, b) => a - b);
    const rankRange =
      ranks.length === 0 ? null : ranks.length === 1 ? `Rank #${ranks[0]}` : `Ranks ${ranks.map((n) => `#${n}`).join(" & ")}`;
    return { info, roles: inTier, rankRange };
  }).filter((g) => g.roles.length > 0);
}

export interface RoleKpis {
  total: number;
  active: number;
  system: number;
  platform: number;
  organization: number;
  custom: number;
  capabilities: number;
  modules: number;
}

export function roleKpis(roles: GovernanceRole[], catalog: CapabilityCatalog | null): RoleKpis {
  return {
    total: roles.length,
    active: roles.filter((r) => r.is_active).length,
    system: roles.filter((r) => r.is_system).length,
    platform: roles.filter((r) => r.scope === "PLATFORM").length,
    organization: roles.filter((r) => r.scope === "ORGANIZATION").length,
    custom: roles.filter((r) => !r.is_system).length,
    capabilities: catalog?.total ?? 0,
    modules: catalog?.module_count ?? 0,
  };
}

export function capabilityPercent(role: GovernanceRole): number {
  if (!role.catalog_size) return 0;
  return Math.round((role.capability_count / role.catalog_size) * 100);
}

export type RoleMenuAction = "edit-details" | "clone" | "toggle-active" | "delete" | "reset-baseline";

export interface MenuItem {
  action: RoleMenuAction;
  label: string;
  disabledReason?: string;
}

/** Kebab menu: what the server allows for this role, with the reason when something is not allowed. */
export function roleMenu(role: GovernanceRole): MenuItem[] {
  const items: MenuItem[] = [{ action: "edit-details", label: "Edit details" }];
  if (role.kind === "SUPER_ADMIN") {
    const why = "Super Admin authority is protected: it cannot be copied, deactivated or deleted.";
    items.push(
      { action: "clone", label: "Clone", disabledReason: why },
      { action: "toggle-active", label: "Deactivate", disabledReason: why },
      { action: "delete", label: "Delete", disabledReason: why },
    );
    return items;
  }
  items.push({ action: "clone", label: "Clone" });
  if (role.is_system) {
    items.push({
      action: "reset-baseline",
      label: "Reset to baseline",
      disabledReason: role.baseline_drift ? undefined : "Already matches the baseline.",
    });
    return items;
  }
  items.push(
    { action: "toggle-active", label: role.is_active ? "Deactivate" : "Activate" },
    {
      action: "delete",
      label: "Delete",
      disabledReason: role.user_count > 0 ? "Members still hold this role. Deactivate it instead." : undefined,
    },
  );
  return items;
}

/** Why the capability set cannot be changed, or null when it can. */
export function permissionsLockReason(role: GovernanceRole): string | null {
  if (role.kind === "SUPER_ADMIN") {
    return "Super Admin always holds every capability (enforced by the platform). Capabilities can never be removed.";
  }
  return null;
}

/** Catalog modules a role of this scope can hold (platform-root capabilities are never assignable). */
export function modulesForScope(catalog: CapabilityCatalog, scope: RoleScope, includeRoot = false): CapabilityModule[] {
  return catalog.modules.filter((m) => {
    const root = m.capabilities.every((c) => c.super_admin_only);
    if (root) return includeRoot;
    return m.scope === scope;
  });
}

export function filterModules(modules: CapabilityModule[], search: string): CapabilityModule[] {
  const text = search.trim().toLowerCase();
  if (!text) return modules;
  return modules
    .map((m) => ({
      ...m,
      capabilities: m.name.toLowerCase().includes(text)
        ? m.capabilities
        : m.capabilities.filter(
            (c) =>
              c.key.toLowerCase().includes(text) ||
              c.label.toLowerCase().includes(text) ||
              c.description.toLowerCase().includes(text),
          ),
    }))
    .filter((m) => m.capabilities.length > 0);
}

export function permissionDiff(original: readonly string[], next: readonly string[]) {
  const before = new Set(original);
  const after = new Set(next);
  return {
    added: [...after].filter((k) => !before.has(k)).sort(),
    removed: [...before].filter((k) => !after.has(k)).sort(),
  };
}

/** Selecting all of a module adds every key; when every key is already selected, it removes them. */
export function toggleModule(selected: readonly string[], module: CapabilityModule): string[] {
  const keys = module.capabilities.map((c) => c.key);
  const set = new Set(selected);
  const all = keys.every((k) => set.has(k));
  keys.forEach((k) => (all ? set.delete(k) : set.add(k)));
  return [...set].sort();
}

export function toggleKey(selected: readonly string[], key: string): string[] {
  const set = new Set(selected);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set].sort();
}

/**
 * Least privilege inside a tenant: someone can grant a role only when they hold every key of it. Keys an
 * Organization Owner does not hold make the role ungrantable by owners (and everyone below them).
 */
export function keysOwnersCannotGrant(roles: GovernanceRole[], keys: readonly string[], scope: RoleScope): string[] {
  if (scope !== "ORGANIZATION") return [];
  const owner = roles.find((r) => r.slug === "organization-owner");
  if (!owner) return [];
  const held = new Set(owner.permissions);
  return keys.filter((k) => !held.has(k)).sort();
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const ROLE_COLORS = [
  "blue", "indigo", "violet", "fuchsia", "pink", "rose", "orange", "amber", "lime", "emerald", "teal", "cyan", "sky", "slate",
] as const;

export const ROLE_ICONS = [
  "Shield", "ShieldAlert", "ShieldCheck", "Activity", "Building2", "Briefcase", "Calendar", "Users", "Code",
  "CheckCircle2", "Eye", "Rocket", "Wrench", "KeyRound", "Star", "Lock",
] as const;

/** Tiers a custom role of this scope may sit in (server rule). */
export function tiersForScope(scope: RoleScope): number[] {
  return scope === "PLATFORM" ? [1, 6] : [2, 3, 4, 5, 6];
}

export const roleDetailsSchema = z.object({
  name: z.string().trim().min(3, "Name must be 3 to 100 characters.").max(100, "Name must be 3 to 100 characters."),
  slug: z
    .string()
    .trim()
    .max(40, "At most 40 characters.")
    .refine((s) => s === "" || (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3), "3 to 40 lowercase letters, digits or single dashes."),
  subtitle: z.string().trim().max(120, "At most 120 characters."),
  description: z.string().trim().max(1000, "At most 1000 characters."),
  scope: z.enum(["PLATFORM", "ORGANIZATION"]),
  tier: z.coerce.number().int().min(1).max(6),
  color: z.string().min(1),
  icon: z.string().min(1),
  base_role_id: z.string(),
});

export type RoleDetailsValues = z.infer<typeof roleDetailsSchema>;

/** Server field errors and tier/scope agreement on top of the schema. */
export function validateRoleDetails(values: RoleDetailsValues): Record<string, string> {
  const parsed = roleDetailsSchema.safeParse(values);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
  }
  if (!tiersForScope(values.scope).includes(Number(values.tier))) {
    errors.tier = values.scope === "PLATFORM" ? "Platform roles sit in tier 1 or Custom Roles." : "Organization roles sit in tiers 2 to 5 or Custom Roles.";
  }
  return errors;
}

/** Every system role with its version, as the re-sync call needs it. */
export function resyncItems(roles: GovernanceRole[]) {
  return roles.filter((r) => r.is_system).map((r) => ({ id: r.id, version: r.version }));
}

export function enforcementLabel(role: GovernanceRole): string {
  switch (role.enforcement) {
    case "PLATFORM_AUTHORITY":
      return "Enforced by the platform";
    case "OPERATOR_DEPARTMENTS":
      return "Enforced by operator departments";
    case "DEFINITION_ONLY":
      return "Definition only (not assignable)";
    default:
      return "Enforced through organization grants";
  }
}
