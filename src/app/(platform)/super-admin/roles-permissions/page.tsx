"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpDown,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Code,
  Copy,
  Edit3,
  Eye,
  Filter,
  Globe,
  History,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, RoleAssignedUser, RoleScope } from "../_types";
import {
  ALL_GRANULAR_PERMISSIONS,
  EXACT_NINE_SYSTEM_ROLES,
  PERMISSION_MODULES,
  TOTAL_CAPABILITIES_COUNT,
  reconcileRoles,
} from "../_services/permission-matrix";
import {
  useAdminPermissions,
  useSuperAdminStore,
} from "../_store/useSuperAdminStore";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  EmptyStateView,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";
import { RoleCard } from "../_components/RoleCard";
import { PermissionDrawer } from "../_components/PermissionDrawer";
import { CustomRoleWizardModal } from "../_components/CustomRoleWizardModal";
import { RoleComparisonModal } from "../_components/RoleComparisonModal";
import { AssignUsersModal } from "../_components/AssignUsersModal";
import { RoleAuditHistoryModal } from "../_components/RoleAuditHistoryModal";

type ScopeTabType = "ALL" | "SYSTEM" | "CUSTOM" | "PLATFORM" | "ORGANIZATION";

interface HierarchyTierInfo {
  tierNumber: number;
  tierId: string;
  title: string;
  scope: RoleScope;
  ranks: number[];
  description: string;
  badge: string;
  icon: React.ElementType;
}

const HIERARCHY_TIERS: HierarchyTierInfo[] = [
  {
    tierNumber: 1,
    tierId: "tier-platform",
    title: "Tier 1: Platform Governance Tier",
    scope: "PLATFORM",
    ranks: [1, 2],
    description: "Platform root governance, multi-tenant orchestration, operator staff management, global security policies, and audit oversight.",
    badge: "Platform Scope (Root & Ops)",
    icon: ShieldAlert,
  },
  {
    tierNumber: 2,
    tierId: "tier-tenant",
    title: "Tier 2: Tenant Administration Tier",
    scope: "ORGANIZATION",
    ranks: [3, 4],
    description: "Tenant ownership, subscription plan lifecycle, billing invoices, workspace governance, member directory, and team invitations.",
    badge: "Organization Scope (Tenant Admin)",
    icon: Building2,
  },
  {
    tierNumber: 3,
    tierId: "tier-delivery",
    title: "Tier 3: Delivery Leadership Tier",
    scope: "ORGANIZATION",
    ranks: [5, 6],
    description: "Project scope, milestones, delivery mode assignment, sprint execution, blocker escalation, and review coordination.",
    badge: "Organization Scope (Delivery & Teams)",
    icon: Briefcase,
  },
  {
    tierNumber: 4,
    tierId: "tier-engineering",
    title: "Tier 4: Engineering & Quality Verification Tier",
    scope: "ORGANIZATION",
    ranks: [7, 8],
    description: "Hands-on implementation, task check-ins, evidence submission, quality verification, test checklists, and deliverable acceptance.",
    badge: "Organization Scope (Engineering & QA)",
    icon: Code,
  },
  {
    tierNumber: 5,
    tierId: "tier-stakeholder",
    title: "Tier 5: Stakeholder & Read-Only Governance Tier",
    scope: "ORGANIZATION",
    ranks: [9],
    description: "Read-only executive visibility into delivery dashboards, sprint velocity, milestone roadmaps, and cross-project reports.",
    badge: "Organization Scope (Read-Only)",
    icon: Eye,
  },
];

export default function SuperAdminRolesPermissionsPage() {
  const roles = useSuperAdminStore((s) => s.roles);
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);
  const setActiveRolePreview = useSuperAdminStore((s) => s.setActiveRolePreview);
  const createRole = useSuperAdminStore((s) => s.createRole);
  const updateRole = useSuperAdminStore((s) => s.updateRole);
  const cloneRole = useSuperAdminStore((s) => s.cloneRole);
  const deleteRole = useSuperAdminStore((s) => s.deleteRole);
  const assignRoleUsers = useSuperAdminStore((s) => s.assignRoleUsers);
  const toggleRoleActive = useSuperAdminStore((s) => s.toggleRoleActive);
  const reconcileSystemRoles = useSuperAdminStore((s) => s.reconcileSystemRoles);

  const { can, activeRole } = useAdminPermissions();
  const canManageRoles = can("roles.manage");

  // Filtering, Tabs, Search & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeTab, setScopeTab] = useState<ScopeTabType>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "SYSTEM" | "CUSTOM">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortBy, setSortBy] = useState<"HIERARCHY" | "NAME" | "USERS" | "CAPABILITIES">("HIERARCHY");
  const [viewMode, setViewMode] = useState<"TIERS" | "GRID">("TIERS");

  // Drawer & Modal States
  const [drawerRole, setDrawerRole] = useState<AdminRole | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<"create" | "clone">("create");
  const [wizardInitialRole, setWizardInitialRole] = useState<AdminRole | null>(null);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareRoleAId, setCompareRoleAId] = useState<string | undefined>(undefined);
  const [compareRoleBId, setCompareRoleBId] = useState<string | undefined>(undefined);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignRole, setAssignRole] = useState<AdminRole | null>(null);

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>("ALL");

  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);

  // Edit Meta Modal State
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState<AdminRole["color"]>("blue");

  // Previous role tracking for preview exit
  const [previousRoleId, setPreviousRoleId] = useState<string>("role-super-admin");

  // Auto-reconcile on mount to guarantee exact 9 system roles (2 Platform, 7 Organization) in hierarchy order and purge extra custom roles
  useEffect(() => {
    reconcileSystemRoles();
  }, [reconcileSystemRoles]);

  // Key KPI metrics
  const platformRolesCount = useMemo(
    () => roles.filter((r) => r.scope === "PLATFORM").length,
    [roles]
  );
  const orgRolesCount = useMemo(
    () => roles.filter((r) => r.scope !== "PLATFORM").length,
    [roles]
  );
  const customRolesCount = useMemo(
    () => roles.filter((r) => !r.isSystem).length,
    [roles]
  );
  const systemRolesCount = useMemo(
    () => roles.filter((r) => r.isSystem).length,
    [roles]
  );

  // Filtered & Sorted roles list
  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = roles.filter((role) => {
      // Tab filter
      if (scopeTab === "SYSTEM" && !role.isSystem) return false;
      if (scopeTab === "CUSTOM" && role.isSystem) return false;
      if (scopeTab === "PLATFORM" && role.scope !== "PLATFORM") return false;
      if (scopeTab === "ORGANIZATION" && role.scope === "PLATFORM") return false;

      // Secondary type filter
      if (typeFilter === "SYSTEM" && !role.isSystem) return false;
      if (typeFilter === "CUSTOM" && role.isSystem) return false;

      // Status filter
      if (statusFilter === "ACTIVE" && role.isActive === false) return false;
      if (statusFilter === "INACTIVE" && role.isActive !== false) return false;

      // Text search
      if (!q) return true;
      const matchName = role.name.toLowerCase().includes(q);
      const matchSlug = role.slug.toLowerCase().includes(q);
      const matchDesc = role.description.toLowerCase().includes(q);
      const matchUser = role.assignedUsers?.some(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
      return matchName || matchSlug || matchDesc || matchUser;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === "USERS") {
        return (b.userCount || 0) - (a.userCount || 0);
      }
      if (sortBy === "CAPABILITIES") {
        return b.permissions.length - a.permissions.length;
      }
      if (sortBy === "NAME") {
        return a.name.localeCompare(b.name);
      }
      // Strict Hierarchy Rank Order (1 to 9, then custom)
      const rankA = a.hierarchyRank ?? 99;
      const rankB = b.hierarchyRank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [roles, searchQuery, scopeTab, typeFilter, statusFilter, sortBy]);

  // Distinct system and custom lists for separate section presentation
  const systemRolesList = useMemo(
    () => filteredRoles.filter((r) => r.isSystem),
    [filteredRoles]
  );

  const customRolesList = useMemo(
    () => filteredRoles.filter((r) => !r.isSystem),
    [filteredRoles]
  );

  // Open Permission Drawer
  const handleOpenDrawer = (role: AdminRole) => {
    setDrawerRole(role);
    setIsDrawerOpen(true);
  };

  // Open User Assignment Modal
  const handleOpenAssignModal = (role: AdminRole) => {
    setAssignRole(role);
    setIsAssignOpen(true);
  };

  // Open Compare Modal with specific role
  const handleOpenCompare = (role?: AdminRole) => {
    if (role) {
      setCompareRoleAId(role.id);
      const otherRole = roles.find((r) => r.id !== role.id);
      setCompareRoleBId(otherRole?.id);
    } else {
      setCompareRoleAId(roles[0]?.id);
      setCompareRoleBId(roles[1]?.id || roles[0]?.id);
    }
    setIsCompareOpen(true);
  };

  // Open Clone in Wizard
  const handleCloneRole = (role: AdminRole) => {
    setWizardMode("clone");
    setWizardInitialRole(role);
    setIsWizardOpen(true);
  };

  // Open Create Role Wizard
  const handleCreateRole = () => {
    setWizardMode("create");
    setWizardInitialRole(null);
    setIsWizardOpen(true);
  };

  // Open Edit Metadata Modal
  const handleEditMeta = (role: AdminRole) => {
    if (role.isSystem) {
      toast.error("System roles cannot be renamed or re-scoped.");
      return;
    }
    setEditingRole(role);
    setEditName(role.name);
    setEditDesc(role.description);
    setEditColor(role.color || "blue");
    setIsEditMetaOpen(true);
  };

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    if (!editName.trim() || editName.trim().length < 2) {
      toast.error("Role name must be at least 2 characters.");
      return;
    }

    const res = updateRole(editingRole.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      color: editColor,
    });

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(`Updated role metadata for "${editName.trim()}"`);
    setIsEditMetaOpen(false);
  };

  // Toggle active state
  const handleToggleActive = (role: AdminRole) => {
    if (role.isSystem) {
      toast.error("The 9 system roles are permanent and cannot be deactivated.");
      return;
    }
    const res = toggleRoleActive(role.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${role.isActive !== false ? "Deactivated" : "Activated"} role "${role.name}"`
    );
  };

  // Handle Delete Target
  const handleDeleteRoleClick = (role: AdminRole) => {
    if (role.isSystem) {
      toast.error("The 9 default system roles are protected and cannot be deleted.");
      return;
    }
    const assignedUsersCount = (role.assignedUsers?.length || 0) + (role.userCount || 0);
    if (assignedUsersCount > 0) {
      toast.error(`Cannot delete role "${role.name}" while ${assignedUsersCount} user(s) remain assigned. Reassign or remove all users first.`);
      return;
    }
    setDeleteTarget(role);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const res = deleteRole(deleteTarget.id);
    if (!res.ok) {
      toast.error(res.error);
      setDeleteTarget(null);
      return;
    }
    toast.success(`Deleted custom role "${deleteTarget.name}"`);
    if (drawerRole?.id === deleteTarget.id) {
      setIsDrawerOpen(false);
    }
    setDeleteTarget(null);
  };

  // Handle Role Preview Switch
  const handlePreviewRole = (role: AdminRole) => {
    setPreviousRoleId(activeRoleId);
    setActiveRolePreview(role.id);
    toast.info(`Switched preview view to "${role.name}" (${role.scope || "ORGANIZATION"})`);
  };

  // Exit Role Preview
  const handleExitPreview = () => {
    const target = roles.find((r) => r.id === previousRoleId) || roles.find((r) => r.slug === "super-admin") || roles[0];
    setActiveRolePreview(target.id);
    toast.success(`Exited preview mode. Restored view to "${target.name}".`);
  };

  // Drawer permission updates
  const handleDrawerPermissionsUpdate = (roleId: string, perms: string[]) => {
    const res = updateRole(roleId, { permissions: perms });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const current = useSuperAdminStore.getState().roles.find((r) => r.id === roleId);
    if (current) {
      setDrawerRole({ ...current, permissions: perms });
    }
    toast.success(`Saved ${perms.length} capabilities for "${current?.name || "role"}"`);
  };

  // User assignments save
  const handleSaveAssignments = (roleId: string, users: RoleAssignedUser[]) => {
    const res = assignRoleUsers(roleId, users);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Assigned ${users.length} user(s) to role`);
  };

  // Manual repair / reconcile action
  const handleManualReconcile = () => {
    const res = reconcileSystemRoles();
    toast.success(`Standard system roles verified: exactly 9 system roles active.`);
  };

  const isPreviewingNonAdmin = activeRole && activeRole.slug !== "super-admin";

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <PageHeader
        title="Roles & Permissions Governance"
        description="Enterprise SaaS RBAC architecture: 9 default system roles, scoped tenant access, and granular capabilities across 12 modules."
        badge={`${roles.length} Roles Active`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleManualReconcile}
              className="flex items-center gap-1.5"
              title="Verify and repair system roles definition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Re-sync System Roles
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => {
                setAuditRoleFilter("ALL");
                setIsAuditOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <History className="w-4 h-4 text-blue-500" />
              Audit Log
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => handleOpenCompare()}
              className="flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4 text-violet-500" />
              Compare
            </AdminButton>

            {canManageRoles && (
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleCreateRole}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Custom Role
              </AdminButton>
            )}
          </div>
        }
      />

      {/* Role Preview Banner */}
      {isPreviewingNonAdmin && (
        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Role Preview Mode Active: </span>
              Currently simulating console permissions as{" "}
              <span className="font-semibold underline">{activeRole?.name}</span> (
              {activeRole?.scope || "ORGANIZATION"} scope). Navigation and permitted controls reflect this profile without altering actual credentials.
            </div>
          </div>
          <button
            type="button"
            onClick={handleExitPreview}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/80 hover:bg-amber-200 text-amber-900 dark:text-amber-100 font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Exit Preview Mode
          </button>
        </div>
      )}

      {/* Dynamic KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">Total Roles</span>
            <Shield className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
            {roles.length}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Active definitions
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">System Roles</span>
            <Lock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {systemRolesCount}
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
            Protected baseline
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">Platform Roles</span>
            <Globe className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
            {platformRolesCount}
          </div>
          <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
            Global governance
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">Organization Roles</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
            {orgRolesCount}
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            Tenant &amp; project scope
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">Custom Roles</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {customRolesCount}
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            Tailored roles
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
            <span className="text-xs font-medium">Capabilities</span>
            <Layers className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
            {TOTAL_CAPABILITIES_COUNT}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            12 core modules
          </span>
        </div>
      </div>

      {/* Scope Navigation Tabs & Search/Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          {/* Scope Segmented Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-sidebar)] border border-[var(--color-border)] self-start overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setScopeTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                scopeTab === "ALL"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              All Roles
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
                {roles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab("SYSTEM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                scopeTab === "SYSTEM"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              System Roles
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
                {systemRolesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab("CUSTOM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                scopeTab === "CUSTOM"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Custom Roles
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
                {customRolesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab("PLATFORM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                scopeTab === "PLATFORM"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-violet-500" />
              Platform Scope
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
                {platformRolesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab("ORGANIZATION")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                scopeTab === "ORGANIZATION"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              Organization Scope
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
                {orgRolesCount}
              </span>
            </button>
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search roles, slug, or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Tiers vs Flat Grid */}
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)]">
              <button
                type="button"
                onClick={() => setViewMode("TIERS")}
                className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === "TIERS"
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
                title="View roles grouped by authority tiers"
              >
                <Network className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Hierarchy Tiers</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === "GRID"
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
                title="View roles in responsive grid"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
            >
              <option value="ALL">All Types</option>
              <option value="SYSTEM">System Roles (9)</option>
              <option value="CUSTOM">Custom Roles</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
            >
              <option value="HIERARCHY">Hierarchy Order (#1 - #9)</option>
              <option value="NAME">Sort by Name</option>
              <option value="USERS">Sort by Users</option>
              <option value="CAPABILITIES">Sort by Capabilities</option>
            </select>

            {(searchQuery || typeFilter !== "ALL" || statusFilter !== "ALL" || sortBy !== "HIERARCHY") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("ALL");
                  setStatusFilter("ALL");
                  setSortBy("HIERARCHY");
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-1 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Displaying Roles in Strict Hierarchy Order */}
      {filteredRoles.length === 0 ? (
        <EmptyStateView
          icon={ShieldAlert}
          title="No Matching Roles Found"
          description="No roles match your search criteria or active filters. Try clearing your search query or selecting another scope tab."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setScopeTab("ALL");
            setTypeFilter("ALL");
            setStatusFilter("ALL");
            setSortBy("HIERARCHY");
          }}
        />
      ) : viewMode === "TIERS" ? (
        /* ======================================================== */
        /* HIERARCHY TIERS VIEW: STRICT CHAIN OF COMMAND & SCOPES   */
        /* ======================================================== */
        <div className="space-y-8">
          {HIERARCHY_TIERS.map((tier) => {
            const tierRoles = filteredRoles.filter(
              (r) => r.isSystem && tier.ranks.includes(r.hierarchyRank || 0)
            );
            if (tierRoles.length === 0) return null;

            const TierIcon = tier.icon;

            return (
              <div
                key={tier.tierId}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-sidebar)]/40 p-4 sm:p-5 space-y-4 shadow-xs"
              >
                {/* Tier Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[var(--color-border)] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 border border-blue-500/20">
                      <TierIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
                          {tier.title}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          Ranks #{tier.ranks.join(" & #")}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                          {tier.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                        {tier.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-[var(--color-text-muted)] shrink-0 self-end sm:self-auto">
                    {tierRoles.length} {tierRoles.length === 1 ? "role" : "roles"}
                  </span>
                </div>

                {/* Roles inside this Hierarchy Tier */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tierRoles.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      isSelected={drawerRole?.id === role.id && isDrawerOpen}
                      isPreviewing={activeRoleId === role.id}
                      onOpenDrawer={handleOpenDrawer}
                      onPreviewRole={handlePreviewRole}
                      onCloneRole={handleCloneRole}
                      onEditRoleMeta={handleEditMeta}
                      onAssignUsers={handleOpenAssignModal}
                      onToggleActive={handleToggleActive}
                      onDeleteRole={handleDeleteRoleClick}
                      canManage={true}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Optional User-Created Custom Roles Tier */}
          {customRolesList.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-sidebar)]/40 p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[var(--color-border)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
                        Custom Delegated Roles ({customRolesCount})
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        Tailored Profiles
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      User-configured roles extending the standard 9 system roles.
                    </p>
                  </div>
                </div>

                <AdminButton
                  variant="primary"
                  size="sm"
                  onClick={handleCreateRole}
                  className="self-end sm:self-auto shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Custom Role
                </AdminButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customRolesList.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    isSelected={drawerRole?.id === role.id && isDrawerOpen}
                    isPreviewing={activeRoleId === role.id}
                    onOpenDrawer={handleOpenDrawer}
                    onPreviewRole={handlePreviewRole}
                    onCloneRole={handleCloneRole}
                    onEditRoleMeta={handleEditMeta}
                    onAssignUsers={handleOpenAssignModal}
                    onToggleActive={handleToggleActive}
                    onDeleteRole={handleDeleteRoleClick}
                    canManage={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state when Custom Roles tab is active and count is 0 */}
          {scopeTab === "CUSTOM" && customRolesList.length === 0 && (
            <SurfaceCard className="p-8 text-center space-y-3 border-dashed">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                  No Extra Custom Roles Configured
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mt-1">
                  All standard operations are governed by the 9 default system roles. You can create custom roles anytime if your enterprise requires specialized profiles.
                </p>
              </div>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleCreateRole}
                className="mx-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Role
              </AdminButton>
            </SurfaceCard>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* RESPONSIVE FLAT GRID VIEW (SORTED BY HIERARCHY RANK)    */
        /* ======================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={drawerRole?.id === role.id && isDrawerOpen}
              isPreviewing={activeRoleId === role.id}
              onOpenDrawer={handleOpenDrawer}
              onPreviewRole={handlePreviewRole}
              onCloneRole={handleCloneRole}
              onEditRoleMeta={handleEditMeta}
              onAssignUsers={handleOpenAssignModal}
              onToggleActive={handleToggleActive}
              onDeleteRole={handleDeleteRoleClick}
              canManage={true}
            />
          ))}
        </div>
      )}

      {/* Permission Matrix Drawer */}
      <PermissionDrawer
        role={drawerRole}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateRolePermissions={handleDrawerPermissionsUpdate}
        onCompareWithAnother={(role) => handleOpenCompare(role)}
        onAssignUsers={(role) => handleOpenAssignModal(role)}
        canManage={true}
        allRoles={roles}
        onSelectRole={(newRole) => setDrawerRole(newRole)}
      />

      {/* Guided 5-Step Custom Role Wizard */}
      <CustomRoleWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreateRole={(roleData) => {
          const res = createRole(roleData);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(`Successfully created custom role "${roleData.name}"`);
          setIsWizardOpen(false);
        }}
        initialRole={wizardInitialRole}
        mode={wizardMode}
        existingRoles={roles}
      />

      {/* Side-by-side Role Comparison Modal */}
      <RoleComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        roles={roles}
        initialRoleAId={compareRoleAId}
        initialRoleBId={compareRoleBId}
      />

      {/* User Assignment Modal */}
      <AssignUsersModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        role={assignRole}
        onSave={handleSaveAssignments}
      />

      {/* RBAC Governance Audit History Modal */}
      <RoleAuditHistoryModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        roles={roles}
        initialRoleFilter={auditRoleFilter}
      />

      {/* Edit Custom Role Metadata Modal */}
      <AdminModal
        isOpen={isEditMetaOpen}
        onClose={() => setIsEditMetaOpen(false)}
        title="Edit Role Details"
        description="Modify role display name, scope description, and visual theme."
        maxWidth="md"
      >
        <form onSubmit={handleSaveMeta} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Role Display Name <span className="text-red-500">*</span>
            </label>
            <AdminInput
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Senior Delivery Lead"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Description &amp; Purpose
            </label>
            <AdminTextarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Explain the scope and responsibilities..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Card Theme Color
            </label>
            <AdminSelect
              value={editColor}
              onChange={(e) => setEditColor(e.target.value as any)}
            >
              <option value="blue">Blue (Default)</option>
              <option value="violet">Violet (Governance / Operator)</option>
              <option value="emerald">Emerald (Deliverables / QA)</option>
              <option value="amber">Amber (Engineering / Security)</option>
              <option value="slate">Slate (Auditor / Read-Only)</option>
            </AdminSelect>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditMetaOpen(false)}
            >
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Save Changes
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Confirm Deletion Modal */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete Role "${deleteTarget?.name}"?`}
        description={
          deleteTarget?.userCount && deleteTarget.userCount > 0
            ? `Warning: This role currently has ${deleteTarget.userCount} assigned user(s). Deleting it will revoke all assigned capabilities. This action cannot be undone.`
            : `Are you sure you want to permanently delete this custom role definition? This action cannot be undone.`
        }
        confirmLabel="Delete Role"
        variant="danger"
      />
    </div>
  );
}
