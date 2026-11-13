"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Code,
  Copy,
  Eye,
  Filter,
  Globe,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, PermissionKey } from "../_types";
import {
  ACTION_LABELS,
  ALL_GRANULAR_PERMISSIONS,
  GranularActionId,
  PERMISSION_MODULES,
  PermissionDefinitionExtended,
  PermissionModuleId,
  getTemplatePermissions,
} from "../_services/permission-matrix";
import { AdminButton, ConfirmActionModal, StatusBadge } from "./SuperAdminPrimitives";

interface PermissionDrawerProps {
  role: AdminRole | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRolePermissions: (roleId: string, permissions: string[]) => void;
  onCompareWithAnother: (role: AdminRole) => void;
  onAssignUsers: (role: AdminRole) => void;
  canManage?: boolean;
  allRoles?: AdminRole[];
  onSelectRole?: (role: AdminRole) => void;
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  "Super Admin": ShieldAlert,
  "Platform Operator": UserCog,
  "Organization Owner": Building2,
  "Organization Admin": ShieldCheck,
  "Project Manager": Briefcase,
  "Team Lead": Users,
  Developer: Code,
  "QA / Reviewer": CheckCircle2,
  Viewer: Eye,
};

export function PermissionDrawer({
  role,
  isOpen,
  onClose,
  onUpdateRolePermissions,
  onCompareWithAnother,
  onAssignUsers,
  canManage = true,
  allRoles = [],
  onSelectRole,
}: PermissionDrawerProps) {
  // 1. All hooks declared unconditionally at the very top
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("ALL");
  const [currentPermissions, setCurrentPermissions] = useState<string[]>([]);
  const [initialPermissions, setInitialPermissions] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState<AdminRole | null>(null);

  // 2. Synchronize when role changes or drawer opens
  useEffect(() => {
    if (role && isOpen) {
      const perms = role.permissions ? [...role.permissions] : [];
      setCurrentPermissions(perms);
      setInitialPermissions(perms);
      setHasUnsavedChanges(false);
      setSearchQuery("");
      setSelectedModuleFilter("ALL");
    }
  }, [role, isOpen]);

  // 3. Valid keys set to guarantee clean capability counters (no 97/75 overflow)
  const validGranularKeys = useMemo(
    () => new Set(ALL_GRANULAR_PERMISSIONS.map((p) => p.key)),
    []
  );

  const enabledCount = useMemo(
    () => currentPermissions.filter((k) => validGranularKeys.has(k)).length,
    [currentPermissions, validGranularKeys]
  );
  const totalCount = ALL_GRANULAR_PERMISSIONS.length;
  const percentage = Math.min(100, Math.round((enabledCount / totalCount) * 100));

  // 4. Filtered Modules Hook (unconditional)
  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return PERMISSION_MODULES.filter((mod) => {
      if (selectedModuleFilter !== "ALL" && mod.id !== selectedModuleFilter) {
        return false;
      }

      if (q) {
        const matchModName = mod.name.toLowerCase().includes(q);
        const matchModDesc = mod.description.toLowerCase().includes(q);
        const hasMatchingChild = ALL_GRANULAR_PERMISSIONS.some(
          (p) =>
            p.moduleId === mod.id &&
            (p.label.toLowerCase().includes(q) ||
              p.actionId.toLowerCase().includes(q) ||
              p.key.toLowerCase().includes(q))
        );
        if (!matchModName && !matchModDesc && !hasMatchingChild) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedModuleFilter]);

  // 5. Keyboard listener for Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (hasUnsavedChanges) {
          setShowUnsavedWarning(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasUnsavedChanges, onClose]);

  // Helper flags
  const isSuperAdminRole = role?.id === "role-super-admin" || role?.slug === "super-admin";
  const RoleIconComponent = (role?.name && ROLE_ICONS[role.name]) || Shield;

  // Handlers
  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const handleDiscardChanges = () => {
    setCurrentPermissions([...initialPermissions]);
    setHasUnsavedChanges(false);
    setShowUnsavedWarning(false);
    if (pendingRoleSwitch && onSelectRole) {
      onSelectRole(pendingRoleSwitch);
      setPendingRoleSwitch(null);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = () => {
    if (!role) return;
    onUpdateRolePermissions(role.id, currentPermissions);
    setHasUnsavedChanges(false);
    setShowUnsavedWarning(false);
    onClose();
  };

  const handleRoleSelectChange = (newRoleId: string) => {
    if (!onSelectRole || !role || newRoleId === role.id) return;
    const targetRole = allRoles.find((r) => r.id === newRoleId);
    if (!targetRole) return;

    if (hasUnsavedChanges) {
      // Auto-save changes for current role before switching to provide a frictionless UX
      onUpdateRolePermissions(role.id, currentPermissions);
      toast.success(`Saved permissions for ${role.name}`);
      setHasUnsavedChanges(false);
    }
    onSelectRole(targetRole);
  };

  const toggleSinglePermission = (permKey: string, permLabel: string) => {
    if (!canManage) {
      toast.error("Your role lacks permission to modify permissions.");
      return;
    }

    const [mod, act] = permKey.split(".");

    // Prevent lockout of Super Admin
    if (isSuperAdminRole && (permKey === "platform.manage" || permKey === "roles.manage")) {
      toast.error("Super Admin platform/role management permission is locked to prevent account lockout.");
      return;
    }

    const has = currentPermissions.includes(permKey);
    let next: string[];

    if (has) {
      // Disabling
      if (act === "view") {
        // If disabling view, cascade revoke dependent actions in this module
        next = currentPermissions.filter((p) => {
          if (p === permKey) return false;
          if (p.startsWith(`${mod}.`)) return false;
          return true;
        });
        toast.info(`Disabled View and dependent actions for ${mod}`);
      } else {
        next = currentPermissions.filter((p) => p !== permKey);
        toast.info(`Revoked "${permLabel}"`);
      }
    } else {
      // Enabling
      const requiredView = `${mod}.view`;
      if (!currentPermissions.includes(requiredView) && act !== "view") {
        next = [...currentPermissions, requiredView, permKey];
        toast.success(`Granted "${permLabel}" (and required View permission)`);
      } else {
        next = [...currentPermissions, permKey];
        toast.success(`Granted "${permLabel}"`);
      }
    }

    setCurrentPermissions(next);
    setHasUnsavedChanges(true);
  };

  const toggleModuleAll = (moduleId: PermissionModuleId) => {
    if (!canManage) return;

    const modulePerms = ALL_GRANULAR_PERMISSIONS.filter((p) => p.moduleId === moduleId).map(
      (p) => p.key
    );
    const allEnabled = modulePerms.every((k) => currentPermissions.includes(k));

    let next: string[];
    if (allEnabled) {
      // Revoke all in this module (except locked super admin keys)
      next = currentPermissions.filter((k) => {
        if (isSuperAdminRole && (k === "platform.manage" || k === "roles.manage")) return true;
        return !modulePerms.includes(k);
      });
      toast.info(`Revoked all capabilities in ${moduleId}`);
    } else {
      next = Array.from(new Set([...currentPermissions, ...modulePerms]));
      toast.success(`Enabled all capabilities in ${moduleId}`);
    }

    setCurrentPermissions(next);
    setHasUnsavedChanges(true);
  };

  const grantAllPermittedCapabilities = () => {
    if (!canManage || !role) return;
    const all = ALL_GRANULAR_PERMISSIONS.map((p) => p.key);
    setCurrentPermissions(all);
    setHasUnsavedChanges(true);
    toast.success(`Enabled all capabilities (${all.length}) for ${role.name}`);
  };

  const resetToTemplateBaseline = () => {
    if (!canManage || !role) return;
    let templateKey = "VIEWER";
    if (role.slug === "super-admin") templateKey = "SUPER_ADMIN";
    else if (role.slug === "platform-operator") templateKey = "PLATFORM_OPERATOR";
    else if (role.slug === "organization-owner") templateKey = "ORGANIZATION_OWNER";
    else if (role.slug === "organization-admin") templateKey = "ORGANIZATION_ADMIN";
    else if (role.slug === "project-manager") templateKey = "PROJECT_MANAGER";
    else if (role.slug === "team-lead") templateKey = "TEAM_LEAD";
    else if (role.slug === "developer") templateKey = "DEVELOPER";
    else if (role.slug === "qa-reviewer") templateKey = "QA_REVIEWER";
    else if (role.slug === "viewer") templateKey = "VIEWER";

    const baseline = getTemplatePermissions(templateKey);
    setCurrentPermissions(baseline);
    setHasUnsavedChanges(true);
    toast.info(`Reset permissions to ${role.name} baseline template`);
  };

  const clearAllCapabilities = () => {
    if (!canManage || !role) return;
    if (isSuperAdminRole) {
      setCurrentPermissions(["platform.manage", "roles.manage", "settings.manage"]);
      toast.info("Cleared non-core capabilities (Super Admin core authority retained).");
    } else {
      setCurrentPermissions([]);
      toast.info(`Cleared all capabilities for ${role.name}`);
    }
    setHasUnsavedChanges(true);
  };

  // 6. Early return strictly AFTER all hooks are called
  if (!isOpen || !role) return null;

  return (
    <>
      {/* Centered Modal Backdrop */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={handleCloseAttempt}
        className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      >
        {/* Centered SaaS Card Dialog */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col text-[var(--color-text-primary)] animate-in zoom-in-95 duration-200 overflow-hidden"
        >
          {/* ======================================================== */}
          {/* 1. SAAS CENTERED MODAL HEADER                            */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-5 border-b border-[var(--color-border)] space-y-3 shrink-0 bg-[var(--color-sidebar)]/75">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left Identity & Role Selector */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 border border-blue-500/25">
                  <RoleIconComponent className="w-5 h-5" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {role.hierarchyRank && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        Rank #{role.hierarchyRank}
                      </span>
                    )}

                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] truncate">
                      {role.name}
                    </h3>

                    {role.hierarchyTitle && (
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] hidden md:inline">
                        • {role.hierarchyTitle}
                      </span>
                    )}

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                      {role.scope === "PLATFORM" ? "Platform Scope" : "Organization Scope"}
                    </span>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        role.isSystem
                          ? "bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {role.isSystem ? "System Role" : "Custom Role"}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-1">
                    {role.description}
                  </p>
                </div>
              </div>

              {/* Right: Fast Role Switcher & Close Button */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {allRoles.length > 0 && onSelectRole && (
                  <div className="flex items-center gap-1.5 bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl px-2 py-1">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] hidden lg:inline">
                      Switch Role:
                    </span>
                    <select
                      value={role.id}
                      onChange={(e) => handleRoleSelectChange(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
                    >
                      {allRoles.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[var(--color-surface)]">
                          {r.hierarchyRank ? `#${r.hierarchyRank} ` : ""}{r.name} ({r.scope === "PLATFORM" ? "Platform" : "Org"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCloseAttempt}
                  aria-label="Close permission editor"
                  className="rounded-xl p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dynamic Metrics Strip */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-xs">
                <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">
                  Active Capabilities
                </span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <strong className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                    {enabledCount} / {totalCount}
                  </strong>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--color-app-bg)] mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-xs">
                <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">
                  Coverage Status
                </span>
                <strong className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums block mt-0.5">
                  {enabledCount === totalCount ? "Full Authority" : `${enabledCount} Authorized`}
                </strong>
                <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
                  12 Enterprise Modules
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-xs">
                <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">
                  Assigned Members
                </span>
                <button
                  type="button"
                  onClick={() => onAssignUsers(role)}
                  className="text-sm font-bold text-[var(--color-text-primary)] hover:text-blue-600 dark:hover:text-blue-400 tabular-nums flex items-center gap-1.5 mt-0.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  {role.userCount || 0} users
                </button>
                <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
                  Click to manage users
                </span>
              </div>
            </div>

            {/* Unsaved changes notice banner */}
            {hasUnsavedChanges && (
              <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  You have unsaved capability changes for {role.name}.
                </span>
                <button
                  type="button"
                  onClick={handleSaveAndClose}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline px-2.5 py-0.5 rounded bg-amber-500/15"
                >
                  Save Now
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 2. SEARCH & BATCH ACTIONS TOOLBAR                        */}
          {/* ======================================================== */}
          <div className="p-3 sm:px-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-[var(--color-surface)]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search capabilities or key (e.g. projects.view)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-9 pr-8 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={selectedModuleFilter}
                onChange={(e) => setSelectedModuleFilter(e.target.value)}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All 12 Modules</option>
                {PERMISSION_MODULES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <AdminButton
                variant="ghost"
                size="xs"
                onClick={resetToTemplateBaseline}
                title="Reset permissions to standard role baseline"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </AdminButton>

              <AdminButton
                variant="ghost"
                size="xs"
                onClick={clearAllCapabilities}
                title="Clear all granted capabilities"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Clear</span>
              </AdminButton>

              <AdminButton
                variant="ghost"
                size="xs"
                onClick={grantAllPermittedCapabilities}
                title="Grant all available capabilities"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Select All</span>
              </AdminButton>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. CENTERED CATEGORIZED PERMISSION MODULES MATRIX        */}
          {/* ======================================================== */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {filteredModules.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] space-y-2">
                <Shield className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm">No permissions match your search query.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear search query
                </button>
              </div>
            ) : (
              filteredModules.map((module) => {
                const modulePermissions = ALL_GRANULAR_PERMISSIONS.filter(
                  (p) => p.moduleId === module.id
                );
                const enabledInMod = modulePermissions.filter((p) =>
                  currentPermissions.includes(p.key)
                ).length;
                const allInModEnabled =
                  modulePermissions.length > 0 && enabledInMod === modulePermissions.length;

                return (
                  <div
                    key={module.id}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500/35 p-4 space-y-3.5 transition-all duration-150 shadow-xs"
                  >
                    {/* Module Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)]/60 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)]">
                            {module.name}
                          </h4>
                          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] tabular-nums px-2 py-0.5 rounded-full bg-[var(--color-app-bg)] border border-[var(--color-border)]">
                            {enabledInMod}/{modulePermissions.length} active
                          </span>
                          {module.isPlatformScopeOnly && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              Platform Governance
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {module.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleModuleAll(module.id)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2.5 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                        >
                          {allInModEnabled ? "Deselect Module" : "Select Module"}
                        </button>
                      </div>
                    </div>

                    {/* Module Granular Actions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {modulePermissions.map((perm) => {
                        const enabled = currentPermissions.includes(perm.key);
                        const isLocked =
                          isSuperAdminRole && (perm.key === "platform.manage" || perm.key === "roles.manage");
                        const isDisabled = isLocked && enabled;

                        return (
                          <div
                            key={perm.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (!isDisabled) {
                                toggleSinglePermission(perm.key, perm.label);
                              }
                            }}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                                e.preventDefault();
                                toggleSinglePermission(perm.key, perm.label);
                              }
                            }}
                            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2.5 transition-all cursor-pointer select-none ${
                              enabled
                                ? "border-blue-500/50 bg-blue-50/60 dark:bg-blue-950/25 shadow-xs ring-1 ring-blue-500/15"
                                : "border-[var(--color-border)] bg-[var(--color-app-bg)]/40 hover:bg-[var(--color-hover)] hover:border-blue-500/30"
                            } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[var(--color-text-primary)]">
                                  {ACTION_LABELS[perm.actionId]?.label || perm.actionId}
                                </span>
                                <span
                                  className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                                    perm.riskLevel === "HIGH"
                                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                      : perm.riskLevel === "MEDIUM"
                                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                      : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  {perm.riskLevel}
                                </span>
                                {isLocked && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                                    <Lock className="w-2.5 h-2.5" /> Protected
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-1 font-mono">
                                {perm.key}
                              </p>
                              {perm.requiresPermission && (
                                <p className="text-[9px] text-slate-400">
                                  Requires {perm.requiresPermission}
                                </p>
                              )}
                            </div>

                            {/* SaaS Checkbox Indicator */}
                            <div
                              className={`h-4.5 w-4.5 rounded-md flex items-center justify-center shrink-0 border transition-all mt-0.5 shadow-xs ${
                                enabled
                                  ? "bg-blue-600 border-blue-600 text-white shadow-blue-500/20"
                                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent hover:border-blue-500/50"
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ======================================================== */}
          {/* 4. SAAS STICKY MODAL FOOTER                              */}
          {/* ======================================================== */}
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-sidebar)]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => onCompareWithAnother(role)}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Compare</span>
              </AdminButton>

              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => onAssignUsers(role)}
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Users ({role.userCount || 0})</span>
              </AdminButton>
            </div>

            <div className="flex items-center gap-2">
              <AdminButton variant="outline" size="sm" onClick={handleCloseAttempt}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleSaveAndClose}
                className="shadow-sm font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Permissions ({enabledCount} Active)</span>
              </AdminButton>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes confirmation dialog */}
      <ConfirmActionModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={handleDiscardChanges}
        title="Discard Unsaved Changes?"
        description="You have made permission changes that have not yet been saved to this role. Discarding will revert to the previous state."
        confirmLabel="Discard Changes"
        variant="danger"
      />
    </>
  );
}
