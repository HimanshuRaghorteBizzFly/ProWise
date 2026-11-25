/**
 * Roles & Permissions Governance (backend SuperAdminRoleDTOs, task 1.5). JSON is snake_case.
 *
 * `enforcement` says what editing a role does:
 * - ORGANIZATION_TEMPLATE: the role is a global role template; its capabilities are the template's permissions,
 *   effective through each organization's grants (changes apply immediately to every holder).
 * - PLATFORM_AUTHORITY: Super Admin, enforced by the platform; it always holds every capability.
 * - OPERATOR_DEPARTMENTS: Platform Operator; sign-in uses operator department permissions, the set here documents it.
 * - DEFINITION_ONLY: platform-scope custom role; not assignable.
 */
export type RoleKind = "SUPER_ADMIN" | "PLATFORM_OPERATOR" | "ORGANIZATION_TEMPLATE" | "CUSTOM";
export type RoleScope = "PLATFORM" | "ORGANIZATION";
export type RoleEnforcement = "ORGANIZATION_TEMPLATE" | "PLATFORM_AUTHORITY" | "OPERATOR_DEPARTMENTS" | "DEFINITION_ONLY";

export interface GovernanceRole {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: RoleKind;
  scope: RoleScope;
  tier: number;
  tier_name: string;
  rank: number | null;
  rank_label: string;
  is_system: boolean;
  is_active: boolean;
  is_protected: boolean;
  permissions_editable: boolean;
  assignable: boolean;
  enforcement: RoleEnforcement;
  enforcement_note: string;
  color: string;
  icon: string;
  template_name: string | null;
  permissions: string[];
  capability_count: number;
  catalog_size: number;
  user_count: number;
  organization_count: number;
  baseline_drift: boolean | null;
  baseline_permissions: string[] | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

export interface Capability {
  key: string;
  action: string;
  label: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | string;
  scope: RoleScope;
  super_admin_only: boolean;
}

export interface CapabilityModule {
  id: string;
  name: string;
  group: string;
  scope: RoleScope;
  capabilities: Capability[];
}

export interface CapabilityCatalog {
  total: number;
  module_count: number;
  modules: CapabilityModule[];
}

export interface RoleHolder {
  id: string;
  name: string | null;
  email: string;
  organization_name: string | null;
  detail: string | null;
}

export interface HolderMatch {
  role_id: string;
  name: string | null;
  email: string;
  organization_name: string | null;
}

export interface RoleHistoryEntry {
  id: string;
  action: string;
  summary: string;
  actor_email: string;
  target_label: string | null;
  severity: string;
  timestamp: string;
}

export interface CompareRow {
  key: string;
  label: string;
  module_name: string;
  held: boolean[];
  differs: boolean;
}

export interface CompareResult {
  roles: GovernanceRole[];
  rows: CompareRow[];
}

export interface ResyncResult {
  changed: string[];
  roles: GovernanceRole[];
}

/** POST /v1/admin/roles. `permissions` or `base_role_id` is required; slug is derived from the name when empty. */
export interface CreateRoleBody {
  name: string;
  slug?: string | null;
  subtitle?: string | null;
  description?: string | null;
  scope?: RoleScope | null;
  tier?: number | null;
  color?: string | null;
  icon?: string | null;
  base_role_id?: string | null;
  permissions?: string[] | null;
}

/** PUT /v1/admin/roles/{id}: details only (system roles keep slug, tier and rank). */
export interface UpdateRoleBody {
  name?: string | null;
  subtitle?: string | null;
  description?: string | null;
  tier?: number | null;
  color?: string | null;
  icon?: string | null;
}

export interface CloneRoleBody {
  new_name: string;
  new_slug?: string | null;
  description?: string | null;
  tier?: number | null;
}
