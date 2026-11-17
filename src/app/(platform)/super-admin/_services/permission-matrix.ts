import { AdminRole, RoleAssignedUser } from "../_types";

export type PermissionModuleId =
  | "organizations"
  | "workspaces"
  | "projects"
  | "tasks"
  | "reviews"
  | "billing"
  | "integrations"
  | "security"
  | "incidents"
  | "communication"
  | "reports"
  | "platform";

export type GranularActionId =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "manage";

export interface PermissionDefinitionExtended {
  key: string;
  moduleId: PermissionModuleId;
  actionId: GranularActionId;
  label: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  isSensitive?: boolean;
  requiresPermission?: string;
  isPlatformOnly?: boolean;
}

export interface PermissionModuleMeta {
  id: PermissionModuleId;
  name: string;
  description: string;
  category: "Platform & Governance" | "Workspace & Delivery" | "Operations & System";
  supportedActions: GranularActionId[];
  isPlatformScopeOnly?: boolean;
}

/** 12 Enterprise SaaS RBAC Modules */
export const PERMISSION_MODULES: PermissionModuleMeta[] = [
  {
    id: "organizations",
    name: "Organizations & Members",
    description: "Customer workspaces, tenant accounts, ownership transfers, and member directory.",
    category: "Platform & Governance",
    supportedActions: ["view", "create", "edit", "delete", "export", "manage"],
  },
  {
    id: "workspaces",
    name: "Workspaces & Teams",
    description: "Multi-workspace hierarchy, functional team clusters, and department allocations.",
    category: "Workspace & Delivery",
    supportedActions: ["view", "create", "edit", "delete", "export", "manage"],
  },
  {
    id: "projects",
    name: "Projects & Delivery",
    description: "Delivery roadmaps, scope governance, project modes, milestones, and deadlines.",
    category: "Workspace & Delivery",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "tasks",
    name: "Tasks & Check-ins",
    description: "Task execution, daily check-in workflows, commit evidence, and delivery blockers.",
    category: "Workspace & Delivery",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "reviews",
    name: "Reviews & Approvals",
    description: "Peer code reviews, test checklists, deliverable verification, and sign-offs.",
    category: "Workspace & Delivery",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "billing",
    name: "Billing & Subscriptions",
    description: "Commercial plans, seat subscriptions, payment transactions, and tax invoices.",
    category: "Operations & System",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "integrations",
    name: "Integrations & GitHub",
    description: "GitHub Apps, webhooks, REST API telemetry, and third-party SaaS relays.",
    category: "Operations & System",
    supportedActions: ["view", "create", "edit", "delete", "export", "manage"],
  },
  {
    id: "security",
    name: "Security & Access",
    description: "MFA enforcement, break-glass session approvals, and threat telemetry.",
    category: "Platform & Governance",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "incidents",
    name: "Incidents & Support",
    description: "Platform outage responses, SLA escalation queues, and operator assignments.",
    category: "Operations & System",
    supportedActions: ["view", "create", "edit", "delete", "approve", "export", "manage"],
  },
  {
    id: "communication",
    name: "Communication",
    description: "System announcements, outbound email configurations, and lifecycle templates.",
    category: "Platform & Governance",
    supportedActions: ["view", "create", "edit", "delete", "export", "manage"],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    description: "Executive dashboards, cross-tenant utilization, velocity, and audit summaries.",
    category: "Operations & System",
    supportedActions: ["view", "export", "manage"],
  },
  {
    id: "platform",
    name: "Platform Configuration & Audit",
    description: "Global system switches, staff operator directory, RBAC governance, and SOC2 audit trail.",
    category: "Platform & Governance",
    supportedActions: ["view", "create", "edit", "delete", "export", "manage"],
    isPlatformScopeOnly: true,
  },
];

export const ACTION_LABELS: Record<
  GranularActionId,
  { label: string; badge: string; risk: "LOW" | "MEDIUM" | "HIGH" }
> = {
  view: { label: "View", badge: "Read Only", risk: "LOW" },
  create: { label: "Create", badge: "Provision", risk: "MEDIUM" },
  edit: { label: "Edit", badge: "Modify", risk: "MEDIUM" },
  delete: { label: "Delete", badge: "Destructive", risk: "HIGH" },
  approve: { label: "Approve", badge: "Sign-Off", risk: "HIGH" },
  export: { label: "Export", badge: "Download", risk: "LOW" },
  manage: { label: "Manage", badge: "Administrative", risk: "HIGH" },
};

/** All Granular Permissions Generated Across the 12 Modules */
export const ALL_GRANULAR_PERMISSIONS: PermissionDefinitionExtended[] = PERMISSION_MODULES.flatMap(
  (mod) =>
    mod.supportedActions.map((action) => {
      const isSensitive = action === "delete" || action === "manage" || action === "approve";
      const risk: "LOW" | "MEDIUM" | "HIGH" =
        action === "delete" || (mod.id === "security" && action !== "view")
          ? "HIGH"
          : action === "create" || action === "edit" || action === "approve" || action === "manage"
          ? "MEDIUM"
          : "LOW";

      return {
        key: `${mod.id}.${action}`,
        moduleId: mod.id,
        actionId: action,
        label: `${ACTION_LABELS[action].label} ${mod.name}`,
        description: `Authorizes user to ${action} resources in ${mod.name}.`,
        riskLevel: risk,
        isSensitive,
        requiresPermission: action !== "view" ? `${mod.id}.view` : undefined,
        isPlatformOnly: mod.isPlatformScopeOnly || (mod.id === "security" && action === "manage"),
      };
    })
);

export const TOTAL_CAPABILITIES_COUNT = ALL_GRANULAR_PERMISSIONS.length;

/** Backward-compatible legacy aliases map */
export const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  "orgs.view": ["organizations.view"],
  "orgs.create": ["organizations.create"],
  "orgs.edit": ["organizations.edit"],
  "orgs.suspend": ["organizations.manage"],
  "orgs.delete": ["organizations.delete"],
  "operators.view": ["platform.view"],
  "operators.manage": ["platform.manage"],
  "roles.manage": ["platform.manage"],
  "plans.manage": ["billing.manage"],
  "subscriptions.manage": ["billing.manage"],
  "payments.view": ["billing.view"],
  "payments.refund": ["billing.approve"],
  "invoices.manage": ["billing.manage"],
  "integrations.manage": ["integrations.manage"],
  "security.manage": ["security.manage"],
  "smtp.configure": ["communication.manage"],
  "templates.manage": ["communication.edit"],
  "announcements.manage": ["communication.manage"],
  "config.manage": ["platform.manage"],
  "support.manage": ["incidents.manage"],
  "audit.view": ["platform.view", "reports.view"],
  "system.export": ["reports.export", "organizations.export"],
  // Legacy module mappings
  "dashboard.view": ["reports.view"],
  "dashboard.export": ["reports.export"],
  "dashboard.manage": ["platform.manage"],
  "settings.view": ["platform.view"],
  "settings.create": ["platform.create"],
  "settings.edit": ["platform.edit"],
  "settings.delete": ["platform.delete"],
  "settings.export": ["platform.export"],
  "settings.manage": ["platform.manage"],
};

/** Helper to generate template permissions */
export function getTemplatePermissions(templateCode: string): string[] {
  const allKeys = ALL_GRANULAR_PERMISSIONS.map((p) => p.key);

  switch (templateCode) {
    case "SUPER_ADMIN":
      return [...allKeys];

    case "PLATFORM_OPERATOR":
      return allKeys.filter((k) => {
        const [mod, act] = k.split(".");
        // Read & Export on all system monitors
        if (act === "view" || act === "export") return true;
        // Operational governance in Incidents, Support, Integrations & Communication
        if (mod === "incidents" || mod === "integrations" || mod === "communication") return true;
        if (mod === "security" && (act === "approve" || act === "edit")) return true;
        if (mod === "organizations" && (act === "edit" || act === "manage")) return true;
        if (mod === "tasks" && (act === "approve" || act === "edit")) return true;
        return false;
      });

    case "ORGANIZATION_OWNER":
      return allKeys.filter((k) => {
        const [mod, act] = k.split(".");
        // Cannot manage global platform infrastructure
        if (mod === "platform") return false;
        if (mod === "incidents") return act === "view" || act === "create";
        return true;
      });

    case "ORGANIZATION_ADMIN":
      return allKeys.filter((k) => {
        const [mod, act] = k.split(".");
        if (mod === "platform") return false;
        if (mod === "billing" && (act === "delete" || act === "approve")) return false;
        if (mod === "security" && (act === "delete" || act === "manage")) return false;
        if (mod === "organizations" && act === "delete") return false;
        if (mod === "incidents") return act === "view" || act === "create";
        return true;
      });

    case "PROJECT_MANAGER":
      return allKeys.filter((k) => {
        const [mod, act] = k.split(".");
        if (mod === "platform" || mod === "billing" || mod === "security" || mod === "incidents") return false;
        if (mod === "organizations") return act === "view";
        if (mod === "workspaces") return act === "view" || act === "edit";
        return true;
      });

    case "TEAM_LEAD":
      return allKeys.filter((k) => {
        const [mod, act] = k.split(".");
        if (act === "delete" || mod === "billing" || mod === "platform" || mod === "security") return false;
        if (mod === "tasks" || mod === "reviews") return true;
        if (mod === "projects" && (act === "view" || act === "edit" || act === "approve")) return true;
        if (mod === "workspaces" && (act === "view" || act === "edit")) return true;
        if (mod === "reports") return true;
        return act === "view";
      });

    case "DEVELOPER":
      return [
        "projects.view",
        "tasks.view",
        "tasks.create",
        "tasks.edit",
        "reviews.view",
        "reviews.create",
        "workspaces.view",
        "reports.view",
      ];

    case "QA_REVIEWER":
      return [
        "projects.view",
        "tasks.view",
        "reviews.view",
        "reviews.create",
        "reviews.edit",
        "reviews.approve",
        "reviews.export",
        "reports.view",
        "workspaces.view",
      ];

    case "VIEWER":
      return [
        "organizations.view",
        "workspaces.view",
        "projects.view",
        "tasks.view",
        "reviews.view",
        "reports.view",
        "reports.export",
      ];

    default:
      return ["projects.view", "tasks.view", "reports.view"];
  }
}

/** EXACT 9 SYSTEM ROLES DEFINITION IN STRICT HIERARCHICAL ORDER (1 - 9) */
export const EXACT_NINE_SYSTEM_ROLES: AdminRole[] = [
  // Tier 1: Platform Governance Tier (Platform Scope)
  {
    id: "role-super-admin",
    name: "Super Admin",
    slug: "super-admin",
    description: "Platform governance, organizations, operator management, plans, billing, security policies, global configuration and audit oversight.",
    isSystem: true,
    scope: "PLATFORM",
    hierarchyRank: 1,
    hierarchyTier: "Platform Governance Tier",
    hierarchyTitle: "Platform Root Authority",
    color: "blue",
    icon: "ShieldAlert",
    permissions: getTemplatePermissions("SUPER_ADMIN"),
    userCount: 1,
    assignedUsers: [
      { id: "u-1", name: "Arthur Pendelton", email: "superadmin@prowise.io", department: "Platform Governance" },
    ],
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },
  {
    id: "role-platform-operator",
    name: "Platform Operator",
    slug: "platform-operator",
    description: "Delegated monitoring, incidents, support, GitHub/webhook operations, queues, maintenance and alerts.",
    isSystem: true,
    scope: "PLATFORM",
    hierarchyRank: 2,
    hierarchyTier: "Platform Governance Tier",
    hierarchyTitle: "Delegated Operations & SRE",
    color: "violet",
    icon: "UserCog",
    permissions: getTemplatePermissions("PLATFORM_OPERATOR"),
    userCount: 4,
    assignedUsers: [
      { id: "u-2", name: "Jordan Mercer", email: "operator@prowise.io", department: "Site Reliability" },
      { id: "u-3", name: "Priya Nair", email: "priya.nair@prowise.io", department: "Revenue Operations" },
      { id: "u-4", name: "Marcus Vance", email: "marcus.vance@prowise.io", department: "Infra Security" },
      { id: "u-5", name: "Elena Rostova", email: "elena.rostova@prowise.io", department: "Escalations" },
    ],
    isActive: true,
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },

  // Tier 2: Tenant Administration Tier (Organization Scope)
  {
    id: "role-org-owner",
    name: "Organization Owner",
    slug: "organization-owner",
    description: "Own organization, subscription, billing, workspaces, members, organization settings.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 3,
    hierarchyTier: "Tenant Administration Tier",
    hierarchyTitle: "Tenant Ownership & Billing",
    color: "emerald",
    icon: "Building2",
    permissions: getTemplatePermissions("ORGANIZATION_OWNER"),
    userCount: 12,
    assignedUsers: [
      { id: "u-6", name: "Sarah Chen", email: "sarah.chen@acmehealth.com", department: "Executive" },
      { id: "u-7", name: "Robert Taylor", email: "robert@nexusfin.com", department: "Executive" },
    ],
    isActive: true,
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },
  {
    id: "role-org-admin",
    name: "Organization Admin",
    slug: "organization-admin",
    description: "Delegated organization administration, members, teams, invitations and access.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 4,
    hierarchyTier: "Tenant Administration Tier",
    hierarchyTitle: "Workspace & Member Delegation",
    color: "blue",
    icon: "ShieldCheck",
    permissions: getTemplatePermissions("ORGANIZATION_ADMIN"),
    userCount: 28,
    assignedUsers: [
      { id: "u-8", name: "Alex Rivera", email: "alex.rivera@acmehealth.com", department: "IT Admin" },
    ],
    isActive: true,
    createdAt: "2026-02-10T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },

  // Tier 3: Delivery Leadership Tier (Organization Scope)
  {
    id: "role-project-manager",
    name: "Project Manager",
    slug: "project-manager",
    description: "Assigned projects, scope, modes, milestones, dependencies, deadlines, progress and delivery.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 5,
    hierarchyTier: "Delivery Leadership Tier",
    hierarchyTitle: "Milestones, Scope & Delivery",
    color: "amber",
    icon: "Briefcase",
    permissions: getTemplatePermissions("PROJECT_MANAGER"),
    userCount: 45,
    assignedUsers: [
      { id: "u-9", name: "David Kim", email: "david.kim@acmehealth.com", department: "Product Delivery" },
    ],
    isActive: true,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },
  {
    id: "role-team-lead",
    name: "Team Lead",
    slug: "team-lead",
    description: "Assigned teams, tasks, blockers, workload, review coordination and reporting.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 6,
    hierarchyTier: "Delivery Leadership Tier",
    hierarchyTitle: "Workload & Review Coordination",
    color: "violet",
    icon: "Users",
    permissions: getTemplatePermissions("TEAM_LEAD"),
    userCount: 62,
    assignedUsers: [
      { id: "u-10", name: "Maya Lin", email: "maya.lin@acmehealth.com", department: "Engineering" },
    ],
    isActive: true,
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },

  // Tier 4: Engineering & Quality Verification Tier (Organization Scope)
  {
    id: "role-developer",
    name: "Developer",
    slug: "developer",
    description: "Assigned tasks, Individual Mode check-ins, Structured Mode updates, evidence and blockers.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 7,
    hierarchyTier: "Engineering & QA Tier",
    hierarchyTitle: "Task Implementation & Check-ins",
    color: "blue",
    icon: "Code",
    permissions: getTemplatePermissions("DEVELOPER"),
    userCount: 184,
    assignedUsers: [
      { id: "u-11", name: "John Doe", email: "john.developer@acmehealth.com", department: "Frontend" },
    ],
    isActive: true,
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },
  {
    id: "role-qa-reviewer",
    name: "QA / Reviewer",
    slug: "qa-reviewer",
    description: "Assigned reviews, checklists, evidence verification, approvals and feedback.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 8,
    hierarchyTier: "Engineering & QA Tier",
    hierarchyTitle: "Verification & Acceptance Testing",
    color: "emerald",
    icon: "CheckSquare",
    permissions: getTemplatePermissions("QA_REVIEWER"),
    userCount: 36,
    assignedUsers: [
      { id: "u-12", name: "Emily Watson", email: "emily.watson@acmehealth.com", department: "Quality Engineering" },
    ],
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },

  // Tier 5: Stakeholder & Read-Only Governance Tier (Organization Scope)
  {
    id: "role-viewer",
    name: "Viewer",
    slug: "viewer",
    description: "Authorized read-only project dashboards, milestones, progress and reports.",
    isSystem: true,
    scope: "ORGANIZATION",
    hierarchyRank: 9,
    hierarchyTier: "Stakeholder & Audit Tier",
    hierarchyTitle: "Read-Only Dashboards & Progress",
    color: "slate",
    icon: "Eye",
    permissions: getTemplatePermissions("VIEWER"),
    userCount: 95,
    assignedUsers: [
      { id: "u-13", name: "Michael Chang", email: "m.chang@partnerinvest.com", department: "Stakeholder" },
    ],
    isActive: true,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
  },
];

/** Standard Custom Roles - Cleared per user requirement to remove extra custom roles */
export const DEFAULT_CUSTOM_ROLES: AdminRole[] = [];

/** Combined Initial Roles (Strictly the 9 System Roles) */
export const DEFAULT_NINE_ROLES: AdminRole[] = [...EXACT_NINE_SYSTEM_ROLES];

/** Candidate pool of users available for role assignment */
export const SAMPLE_ASSIGNABLE_USERS: RoleAssignedUser[] = [
  { id: "u-1", name: "Arthur Pendelton", email: "superadmin@prowise.io", department: "Platform Governance" },
  { id: "u-2", name: "Jordan Mercer", email: "operator@prowise.io", department: "Site Reliability" },
  { id: "u-3", name: "Priya Nair", email: "priya.nair@prowise.io", department: "Revenue Operations" },
  { id: "u-4", name: "Marcus Vance", email: "marcus.vance@prowise.io", department: "Infra Security" },
  { id: "u-5", name: "Elena Rostova", email: "elena.rostova@prowise.io", department: "Escalations" },
  { id: "u-6", name: "Sarah Chen", email: "sarah.chen@acmehealth.com", department: "Executive" },
  { id: "u-7", name: "Robert Taylor", email: "robert@nexusfin.com", department: "Executive" },
  { id: "u-8", name: "Alex Rivera", email: "alex.rivera@acmehealth.com", department: "IT Admin" },
  { id: "u-9", name: "David Kim", email: "david.kim@acmehealth.com", department: "Product Delivery" },
  { id: "u-10", name: "Maya Lin", email: "maya.lin@acmehealth.com", department: "Engineering" },
  { id: "u-11", name: "John Doe", email: "john.developer@acmehealth.com", department: "Frontend" },
  { id: "u-12", name: "Emily Watson", email: "emily.watson@acmehealth.com", department: "Quality Engineering" },
  { id: "u-13", name: "Michael Chang", email: "m.chang@partnerinvest.com", department: "Stakeholder" },
  { id: "u-14", name: "Hannah Vance", email: "hannah@deloitte-audit.com", department: "External Audit" },
  { id: "u-15", name: "Devon Ross", email: "devon@contracting-services.net", department: "Vendor Team" },
  { id: "u-16", name: "Claire Beauchamp", email: "claire@biotechlabs.org", department: "Bio Informatics" },
  { id: "u-17", name: "Liam O'Connor", email: "liam@finscale.io", department: "Security Operations" },
  { id: "u-18", name: "Liam Chen", email: "liam.chen@prowise.io", department: "Customer Communications" },
  { id: "u-19", name: "Sophia Rossi", email: "sophia.rossi@prowise.io", department: "Trust & Compliance" },
  { id: "u-20", name: "Hannah Brooks", email: "hannah.brooks@prowise.io", department: "Finance & Tax" },
];

/**
 * Reconciles any loaded or persisted roles to ensure:
 * 1. Exactly the 9 official system roles are present with stable IDs and correct scopes.
 * 2. Legacy non-standard system roles (Billing & Revenue Admin, Platform Operations Lead) are migrated/replaced.
 * 3. Communications Manager, Compliance Auditor, and Security are preserved as optional custom roles.
 * 4. User assignments from legacy roles are safely migrated.
 */
export function reconcileRoles(existingRoles?: AdminRole[]): {
  roles: AdminRole[];
  migrated: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  let migrated = false;

  if (!existingRoles || existingRoles.length === 0) {
    return {
      roles: [...EXACT_NINE_SYSTEM_ROLES],
      migrated: true,
      notes: ["Initialized standard 9 hierarchy system roles."],
    };
  }

  // 1. Map existing roles by ID and detect legacy/extra roles
  const roleMap = new Map<string, AdminRole>();
  const legacyRolesFound: AdminRole[] = [];

  const REMOVED_EXTRA_ROLE_IDS = new Set([
    "role-comms-mgr",
    "role-auditor",
    "role-security-admin",
    "role-contractor",
    "role-billing-admin",
    "role-ops-lead",
  ]);

  existingRoles.forEach((r) => {
    // Check if this is a legacy non-standard role definition or extra custom role to be removed
    if (r.id === "role-billing-admin" || r.slug === "billing-admin" || r.name.includes("Billing & Revenue Admin")) {
      legacyRolesFound.push(r);
      migrated = true;
      notes.push(`Replaced legacy role "${r.name}" (${r.id})`);
    } else if (r.id === "role-ops-lead" || r.slug === "platform-ops-lead" || r.name.includes("Platform Operations Lead")) {
      legacyRolesFound.push(r);
      migrated = true;
      notes.push(`Replaced legacy role "${r.name}" (${r.id})`);
    } else if (REMOVED_EXTRA_ROLE_IDS.has(r.id)) {
      // Remove extra custom role per user requirement
      legacyRolesFound.push(r);
      migrated = true;
      notes.push(`Removed extra custom role "${r.name}" (${r.id})`);
    } else {
      roleMap.set(r.id, r);
    }
  });

  // 2. Ensure each of the 9 official system roles is present, with hierarchy attributes and custom permissions preserved
  const finalSystemRoles: AdminRole[] = EXACT_NINE_SYSTEM_ROLES.map((official) => {
    const existing = roleMap.get(official.id);
    if (!existing) {
      migrated = true;
      notes.push(`Restored missing system role "${official.name}" (${official.id}) with scope ${official.scope}`);
      return { ...official };
    }

    // Role exists: preserve any assignedUsers while forcing official attributes
    const mergedUsers = [...(existing.assignedUsers || [])];
    
    // If this is Platform Operator, also fold in any users from removed extra roles
    if (official.id === "role-platform-operator") {
      legacyRolesFound.forEach((leg) => {
        if (leg.assignedUsers) {
          leg.assignedUsers.forEach((u) => {
            if (!mergedUsers.some((m) => m.id === u.id)) {
              mergedUsers.push(u);
              notes.push(`Migrated user ${u.name} from removed role to Platform Operator`);
            }
          });
        }
      });
    }

    const needsFix =
      !existing.isSystem ||
      existing.scope !== official.scope ||
      existing.name !== official.name ||
      existing.hierarchyRank !== official.hierarchyRank;

    if (needsFix) {
      migrated = true;
      notes.push(`Updated metadata for system role "${official.name}" (Hierarchy Rank: ${official.hierarchyRank})`);
    }

    return {
      ...official,
      userCount: mergedUsers.length,
      assignedUsers: mergedUsers,
      // Preserve any user-edited permissions!
      permissions:
        existing.permissions && existing.permissions.length > 0
          ? existing.permissions
          : official.permissions,
      isActive: true, // system roles always active
    };
  });

  // 3. Process remaining truly user-created custom roles (where user manually clicked Create Role)
  const finalCustomRoles: AdminRole[] = [];
  const systemRoleIds = new Set(EXACT_NINE_SYSTEM_ROLES.map((r) => r.id));

  roleMap.forEach((role, id) => {
    if (!systemRoleIds.has(id) && !REMOVED_EXTRA_ROLE_IDS.has(id)) {
      finalCustomRoles.push({
        ...role,
        isSystem: false,
        scope: role.scope || "ORGANIZATION",
        hierarchyRank: role.hierarchyRank || 10,
        hierarchyTier: role.hierarchyTier || "Custom Roles Tier",
      });
    }
  });

  // Sort custom roles by hierarchyRank or name
  finalCustomRoles.sort((a, b) => (a.hierarchyRank || 10) - (b.hierarchyRank || 10) || a.name.localeCompare(b.name));

  const finalRoles = [...finalSystemRoles, ...finalCustomRoles];

  return {
    roles: finalRoles,
    migrated,
    notes,
  };
}

/** Check permission dependencies */
export function checkPermissionDependencies(
  actionKey: string,
  currentPermissions: string[]
): {
  valid: boolean;
  missingRequirements: string[];
} {
  const [mod, act] = actionKey.split(".");
  if (act === "view") return { valid: true, missingRequirements: [] };

  const requiredView = `${mod}.view`;
  if (!currentPermissions.includes(requiredView)) {
    return {
      valid: false,
      missingRequirements: [requiredView],
    };
  }

  return { valid: true, missingRequirements: [] };
}
