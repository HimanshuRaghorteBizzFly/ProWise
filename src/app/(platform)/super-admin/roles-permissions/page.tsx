"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  Lock,
  Mail,
  Plug,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, PermissionCategory, PermissionKey } from "../_types";
import { PERMISSION_CATALOG } from "../_data/seed";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
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

const ROLE_COLORS: Record<
  AdminRole["color"],
  {
    stripe: string;
    ring: string;
    badge: string;
    progress: string;
  }
> = {
  blue: {
    stripe: "bg-blue-500",
    ring: "border-blue-500 ring-1 ring-blue-500/40",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
    progress: "bg-blue-500",
  },
  emerald: {
    stripe: "bg-emerald-500",
    ring: "border-emerald-500 ring-1 ring-emerald-500/40",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    progress: "bg-emerald-500",
  },
  violet: {
    stripe: "bg-violet-500",
    ring: "border-violet-500 ring-1 ring-violet-500/40",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30",
    progress: "bg-violet-500",
  },
  amber: {
    stripe: "bg-amber-500",
    ring: "border-amber-500 ring-1 ring-amber-500/40",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30",
    progress: "bg-amber-500",
  },
  slate: {
    stripe: "bg-cyan-500",
    ring: "border-cyan-500 ring-1 ring-cyan-500/40",
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30",
    progress: "bg-cyan-500",
  },
};

const CATEGORY_META: {
  category: PermissionCategory;
  description: string;
  icon: React.ElementType;
  iconTone: string;
  pillTone: string;
}[] = [
  {
    category: "Organizations",
    description: "Create, inspect, update, suspend, or remove tenant workspaces.",
    icon: Building2,
    iconTone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    pillTone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    category: "Operators & Access",
    description: "Manage staff operators, role assignments, and custom access rules.",
    icon: Users,
    iconTone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    pillTone: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  {
    category: "Billing & Revenue",
    description: "Control commercial plans, subscriptions, refunds, and customer invoices.",
    icon: CreditCard,
    iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    pillTone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    category: "Integrations & Security",
    description: "Govern API connections, support access approvals, and security policies.",
    icon: Plug,
    iconTone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    pillTone: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  },
  {
    category: "Communication",
    description: "Configure outbound mail, email templates, and platform announcements.",
    icon: Mail,
    iconTone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    pillTone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  {
    category: "Platform & Audit",
    description: "Manage system limits, support escalations, audit logs, and CSV exports.",
    icon: Settings,
    iconTone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    pillTone: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
];

export default function SuperAdminRolesPermissionsPage() {
  const roles = useSuperAdminStore((s) => s.roles);
  const operators = useSuperAdminStore((s) => s.operators);
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);
  const setActiveRolePreview = useSuperAdminStore((s) => s.setActiveRolePreview);
  const createRole = useSuperAdminStore((s) => s.createRole);
  const updateRole = useSuperAdminStore((s) => s.updateRole);
  const cloneRole = useSuperAdminStore((s) => s.cloneRole);
  const deleteRole = useSuperAdminStore((s) => s.deleteRole);

  const { can } = useAdminPermissions();
  const canManageRoles = can("roles.manage");

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || "role-super-admin");
  const [permSearch, setPermSearch] = useState("");
  const [permFilter, setPermFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);

  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleColor, setRoleColor] = useState<AdminRole["color"]>("blue");
  const [formError, setFormError] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setRoleColor("violet");
    setFormError("");
    setRoleModalOpen(true);
  };

  const openEditRole = (role: AdminRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description);
    setRoleColor(role.color);
    setFormError("");
    setRoleModalOpen(true);
  };

  const handleSaveRoleMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || roleName.trim().length < 2) {
      setFormError("Role name must be at least 2 characters.");
      return;
    }

    if (editingRole) {
      const res = updateRole(editingRole.id, {
        name: roleName.trim(),
        description: roleDesc.trim(),
        color: roleColor,
      });
      if (!res.ok) {
        setFormError(res.error || "Failed to update role");
        return;
      }
      toast.success(`Updated role "${roleName.trim()}"`);
      setRoleModalOpen(false);
    } else {
      const res = createRole({
        name: roleName.trim(),
        description: roleDesc.trim() || "Custom Super Admin governance role.",
        color: roleColor,
        permissions: ["orgs.view", "audit.view"],
      });
      if (!res.ok) {
        setFormError(res.error || "Failed to create role");
        return;
      }
      toast.success(`Created custom role "${roleName.trim()}"`);
      setRoleModalOpen(false);
    }
  };

  const togglePermission = (permKey: PermissionKey, permLabel: string) => {
    if (!selectedRole || !canManageRoles) return;
    const has = selectedRole.permissions.includes(permKey);
    const next = has
      ? selectedRole.permissions.filter((p) => p !== permKey)
      : [...selectedRole.permissions, permKey];

    const res = updateRole(selectedRole.id, { permissions: next });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${has ? "Disabled" : "Enabled"} "${permLabel}" for ${selectedRole.name}`);
  };

  const toggleCategoryAll = (category: PermissionCategory) => {
    if (!selectedRole || !canManageRoles) return;
    const catKeys = PERMISSION_CATALOG.filter((p) => p.category === category).map((p) => p.key);
    const allGranted = catKeys.every((k) => selectedRole.permissions.includes(k));
    const next = allGranted
      ? selectedRole.permissions.filter((k) => !catKeys.includes(k))
      : Array.from(new Set([...selectedRole.permissions, ...catKeys]));

    const res = updateRole(selectedRole.id, { permissions: next });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${allGranted ? "Revoked all" : "Enabled all"} ${category} permissions`);
  };

  const visibleCategoriesCount = useMemo(() => {
    if (!selectedRole) return 0;
    const q = permSearch.trim().toLowerCase();
    return CATEGORY_META.filter(({ category }) =>
      PERMISSION_CATALOG.some((p) => {
        if (p.category !== category) return false;
        const enabled = selectedRole.permissions.includes(p.key);
        if (permFilter === "ENABLED" && !enabled) return false;
        if (permFilter === "DISABLED" && enabled) return false;
        if (
          q &&
          !p.label.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q) &&
          !category.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
    ).length;
  }, [selectedRole, permSearch, permFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        badge={`${roles.length} Roles`}
        description="Select a role card below to inspect or customize its permission cards by section."
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManageRoles}
            onClick={openCreateRole}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Custom Role
          </AdminButton>
        }
      />

      {/* Card Section 1: Administrative Role Cards */}
      <SurfaceCard className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              1. Select an Administrative Role
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Click any role card to view and configure its access permissions below.
            </p>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            {roles.length} configured roles
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {roles.map((role) => {
            const isSelected = selectedRole?.id === role.id;
            const isPreviewing = activeRoleId === role.id;
            const assignedOps = operators.filter((o) => o.roleId === role.id).length;
            const grantPct = Math.round(
              (role.permissions.length / Math.max(1, PERMISSION_CATALOG.length)) * 100
            );
            const colorCfg = ROLE_COLORS[role.color] || ROLE_COLORS.blue;

            return (
              <div
                key={role.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRoleId(role.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRoleId(role.id);
                  }
                }}
                className={`group relative overflow-hidden rounded-xl border p-3.5 pt-4 flex flex-col justify-between gap-3 text-left cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? `${colorCfg.ring} bg-[var(--color-elevated)] shadow-sm`
                    : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-blue-500/45 hover:bg-[var(--color-hover)]/45"
                }`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${colorCfg.stripe}`} aria-hidden="true" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
                      {role.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorCfg.badge}`}>
                      {role.isSystem ? "System" : "Custom"}
                    </span>
                    {isPreviewing && <StatusBadge label="Previewing" tone="warning" dot />}
                  </div>

                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                    {role.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-[var(--color-border)]">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>
                        <strong className="text-[var(--color-text-primary)]">
                          {role.permissions.length}
                        </strong>
                        /{PERMISSION_CATALOG.length} grants
                      </span>
                      <span>{assignedOps} staff</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-surface)] overflow-hidden border border-[var(--color-border)]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${colorCfg.progress}`}
                        style={{ width: `${grantPct}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AdminButton
                      variant={isPreviewing ? "subtle" : "ghost"}
                      size="xs"
                      onClick={() => {
                        setActiveRolePreview(role.id);
                        toast.info(`Previewing console as ${role.name}`);
                      }}
                      title="Preview console permissions as this role"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </AdminButton>

                    <div className="flex items-center gap-0.5">
                      <AdminButton
                        variant="ghost"
                        size="xs"
                        permissionLocked={!canManageRoles}
                        onClick={() => {
                          const cloned = cloneRole(role.id);
                          if (cloned) {
                            setSelectedRoleId(cloned.id);
                            toast.success(`Cloned "${role.name}"`);
                          }
                        }}
                        title="Duplicate role"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        size="xs"
                        permissionLocked={!canManageRoles}
                        onClick={() => openEditRole(role)}
                        title="Edit role details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </AdminButton>
                      {!role.isSystem && (
                        <AdminButton
                          variant="ghost"
                          size="xs"
                          permissionLocked={!canManageRoles}
                          className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => setDeleteTarget(role)}
                          title="Delete custom role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AdminButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Card Section 2: Selected Role Overview & Filter Controls */}
      {selectedRole && (
        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[var(--color-border)]">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500 shrink-0" />
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  2. {selectedRole.name} — Permissions by Section
                </h3>
                <StatusBadge
                  label={`${selectedRole.permissions.length} of ${PERMISSION_CATALOG.length} Enabled`}
                  tone="success"
                />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {selectedRole.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <AdminButton
                variant="outline"
                size="sm"
                permissionLocked={!canManageRoles}
                onClick={() => openEditRole(selectedRole)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Role Info
              </AdminButton>
              <AdminButton
                variant={activeRoleId === selectedRole.id ? "subtle" : "primary"}
                size="sm"
                onClick={() => {
                  setActiveRolePreview(selectedRole.id);
                  toast.info(`Switched active preview to ${selectedRole.name}`);
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                {activeRoleId === selectedRole.id ? "Currently Previewing" : "Preview This Role"}
              </AdminButton>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="Search permissions or section (e.g. billing, audit, orgs)..."
                aria-label="Search permissions"
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs self-start sm:self-auto">
              {[
                { label: `All (${PERMISSION_CATALOG.length})`, value: "ALL" as const },
                { label: `Enabled (${selectedRole.permissions.length})`, value: "ENABLED" as const },
                {
                  label: `Disabled (${PERMISSION_CATALOG.length - selectedRole.permissions.length})`,
                  value: "DISABLED" as const,
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPermFilter(tab.value)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    permFilter === tab.value
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Card Section 3: Modular Category Card Sections */}
      {selectedRole && (
        visibleCategoriesCount === 0 ? (
          <SurfaceCard className="p-6">
            <EmptyStateView
              icon={ShieldCheck}
              title="No permissions match your filter"
              description="Clear the permission search or switch filter back to All."
              actionLabel="Show All Permissions"
              onAction={() => {
                setPermSearch("");
                setPermFilter("ALL");
              }}
            />
          </SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {CATEGORY_META.map(({ category, description, icon: CatIcon, iconTone, pillTone }) => {
              const allCatItems = PERMISSION_CATALOG.filter((p) => p.category === category);
              const grantedInCat = allCatItems.filter((p) =>
                selectedRole.permissions.includes(p.key)
              ).length;
              const allGranted = grantedInCat === allCatItems.length;
              const q = permSearch.trim().toLowerCase();

              const visibleItems = allCatItems.filter((p) => {
                const enabled = selectedRole.permissions.includes(p.key);
                if (permFilter === "ENABLED" && !enabled) return false;
                if (permFilter === "DISABLED" && enabled) return false;
                if (
                  q &&
                  !p.label.toLowerCase().includes(q) &&
                  !p.description.toLowerCase().includes(q) &&
                  !category.toLowerCase().includes(q)
                ) {
                  return false;
                }
                return true;
              });

              if (visibleItems.length === 0) return null;

              return (
                <SurfaceCard key={category} className="p-4 sm:p-5 flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {category}
                          </h4>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pillTone}`}>
                            {grantedInCat} / {allCatItems.length} enabled
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {description}
                        </p>
                      </div>
                    </div>

                    <AdminButton
                      variant="outline"
                      size="xs"
                      permissionLocked={!canManageRoles}
                      onClick={() => toggleCategoryAll(category)}
                      className="shrink-0"
                    >
                      {allGranted ? "Revoke Section" : "Enable Section"}
                    </AdminButton>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {visibleItems.map((perm) => {
                      const enabled = selectedRole.permissions.includes(perm.key);
                      const locked =
                        !canManageRoles ||
                        (selectedRole.id === "role-super-admin" && perm.key === "roles.manage");

                      return (
                        <button
                          key={perm.key}
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          disabled={locked}
                          onClick={() => togglePermission(perm.key, perm.label)}
                          className={`w-full rounded-xl border p-3 text-left flex flex-col justify-between gap-2.5 transition-all duration-150 ${
                            enabled
                              ? "border-blue-500/40 bg-[var(--color-elevated)]"
                              : "border-[var(--color-border)] bg-[var(--color-app-bg)] opacity-80"
                          } ${
                            locked
                              ? "cursor-not-allowed opacity-65"
                              : "hover:border-blue-500/60 hover:bg-[var(--color-hover)]/50"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-snug">
                                {perm.label}
                              </span>
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  enabled
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent"
                                }`}
                              >
                                {locked && enabled ? (
                                  <Lock className="w-3 h-3" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                              {perm.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--color-border)]">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                perm.riskLevel === "HIGH"
                                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                  : perm.riskLevel === "MEDIUM"
                                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {perm.riskLevel === "HIGH"
                                ? "Sensitive"
                                : perm.riskLevel === "MEDIUM"
                                ? "Standard"
                                : "Read Access"}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                enabled
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-[var(--color-text-muted)]"
                              }`}
                            >
                              {locked && enabled
                                ? "Locked On"
                                : enabled
                                ? "Enabled"
                                : "Disabled"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )
      )}

      {/* Create / Edit Role Modal */}
      <AdminModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Create Custom Admin Role"}
        description="Define a role profile, then enable capabilities on the permission sections."
        maxWidth="md"
      >
        <form onSubmit={handleSaveRoleMeta} className="space-y-4">
          <AdminInput
            label="Role Name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Security Compliance Reviewer"
            error={formError}
          />
          <AdminTextarea
            label="Scope Description"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            placeholder="Describe responsibilities and boundaries..."
          />
          <AdminSelect
            label="Accent Color"
            value={roleColor}
            onChange={(e) => setRoleColor(e.target.value as AdminRole["color"])}
            options={[
              { label: "Blue", value: "blue" },
              { label: "Emerald", value: "emerald" },
              { label: "Violet", value: "violet" },
              { label: "Amber", value: "amber" },
              { label: "Slate", value: "slate" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editingRole ? "Save Role" : "Create Role"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete custom role "${deleteTarget?.name || ""}"?`}
        description="Assigned operators will be safely reassigned to the default read-only role."
        confirmLabel="Delete Role"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          const res = deleteRole(deleteTarget.id);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success(`Deleted role ${deleteTarget.name}`);
            setSelectedRoleId(roles[0]?.id || "role-super-admin");
          }
        }}
      />
    </div>
  );
}
