"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  KeyRound,
  Lock,
  PlusCircle,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, PermissionOverrideItem, PlatformOperator } from "../../_types";
import {
  AdminButton,
  ConfirmActionModal,
  StatusBadge,
  getStatusTone,
} from "../../_components/SuperAdminPrimitives";
import {
  ModulePermissionDef,
  OPERATOR_MODULE_CATALOG,
  normalizeDepartmentName,
  resolveEffectivePermission,
} from "../../../platform-operator/_services/operator-permission-service";

interface OperatorPermissionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  operator: PlatformOperator | null;
  role: AdminRole | undefined;
  onSaveOverrides: (operatorId: string, overrides: PermissionOverrideItem[]) => void;
}

const CATEGORIES: ModulePermissionDef["category"][] = [
  "Operations",
  "Incidents & Support",
  "Integrations",
  "Communications",
  "Billing Operations",
  "System Operations",
  "Account & Audit",
];

export function OperatorPermissionDrawer({
  isOpen,
  onClose,
  operator,
  role,
  onSaveOverrides,
}: OperatorPermissionDrawerProps) {
  const [stagedOverrides, setStagedOverrides] = useState<PermissionOverrideItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<"ALL" | "ALLOWED" | "OVERRIDDEN" | "DENIED">("ALL");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  useEffect(() => {
    if (operator) {
      setStagedOverrides(operator.permissionOverrides || []);
      setSearchQuery("");
      setActiveCategory("ALL");
      setFilterMode("ALL");
    }
  }, [operator]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSetActionOverride = (
    moduleKey: string,
    action: "view" | "create" | "edit" | "delete" | "execute",
    type: "DEFAULT" | "GRANT" | "DENY"
  ) => {
    setStagedOverrides((prev) => {
      const withoutCurrent = prev.filter(
        (o) => !(o.moduleKey === moduleKey && o.action === action)
      );

      if (type === "DEFAULT") {
        return withoutCurrent;
      }

      const newOverride: PermissionOverrideItem = {
        moduleKey,
        action,
        type,
        grantedBy: "Super Administrator",
        reason: `Manual administrative override (${type})`,
        createdAt: new Date().toISOString(),
      };

      return [...withoutCurrent, newOverride];
    });
  };

  const handleResetToDefaults = () => {
    setStagedOverrides([]);
    toast.info("Overrides reset to department defaults. Click 'Save Changes' to commit.");
  };

  const allModuleActions = useMemo(
    () =>
      OPERATOR_MODULE_CATALOG.flatMap((m) =>
        m.actions.map((act) => ({ module: m, action: act }))
      ),
    []
  );

  const stats = useMemo(() => {
    let allowedCount = 0;
    let grantOverridesCount = 0;
    let denyOverridesCount = 0;

    const dept = operator?.department || "Site Reliability";

    for (const item of allModuleActions) {
      const res = resolveEffectivePermission(
        dept,
        item.module.key,
        item.action,
        stagedOverrides
      );
      if (res.allowed) allowedCount++;
      if (res.state === "INDIVIDUAL_GRANT") grantOverridesCount++;
      if (res.state === "INDIVIDUAL_DENY") denyOverridesCount++;
    }

    return {
      totalActions: allModuleActions.length,
      allowedCount,
      restrictedCount: allModuleActions.length - allowedCount,
      grantOverridesCount,
      denyOverridesCount,
      totalOverrides: stagedOverrides.length,
    };
  }, [allModuleActions, operator?.department, stagedOverrides]);

  const hasUnsavedChanges = useMemo(() => {
    const original = operator?.permissionOverrides || [];
    if (original.length !== stagedOverrides.length) return true;
    return JSON.stringify(original) !== JSON.stringify(stagedOverrides);
  }, [operator?.permissionOverrides, stagedOverrides]);

  const handleConfirmSave = () => {
    if (!operator) return;
    onSaveOverrides(operator.id, stagedOverrides);
    setConfirmSaveOpen(false);
    onClose();
  };

  const q = searchQuery.trim().toLowerCase();

  if (!isOpen || !operator) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div
        className="w-full max-w-3xl bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Permission Management Drawer"
      >
        {/* Drawer Header with Operator Profile */}
        <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold text-base flex items-center justify-center shrink-0">
              {operator.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">
                  {operator.name}
                </h2>
                <StatusBadge label={operator.status} tone={getStatusTone(operator.status)} dot />
                {operator.onCall && <StatusBadge label="On-Call Shift" tone="violet" dot />}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                {operator.email} • {operator.shiftName || "Standard Shift"}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  <Shield className="w-3 h-3" />
                  {operator.department}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-[var(--color-app-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  Role: {role?.name || "Platform Operator"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                  {operator.mfaEnabled ? "MFA Enforced" : "MFA Disabled"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                  {operator.activeSessionsCount ?? 1} active session(s)
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Effective Metrics Strip */}
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-app-bg)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.allowedCount} Allowed Actions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1 font-medium text-[var(--color-text-muted)]">
              <Lock className="w-3.5 h-3.5" />
              {stats.restrictedCount} Restricted
            </span>
            {stats.grantOverridesCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <PlusCircle className="w-3 h-3" />
                +{stats.grantOverridesCount} Grant Override{stats.grantOverridesCount === 1 ? "" : "s"}
              </span>
            )}
            {stats.denyOverridesCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                <Ban className="w-3 h-3" />
                -{stats.denyOverridesCount} Deny Override{stats.denyOverridesCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <AdminButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleResetToDefaults}
            disabled={stagedOverrides.length === 0}
            title="Reset all overrides to department baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Dept Defaults
          </AdminButton>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[var(--color-border)] space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search module name, route, key, or action..."
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-9 pr-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs shrink-0">
              {(
                [
                  { label: "All", value: "ALL" },
                  { label: "Allowed", value: "ALLOWED" },
                  { label: "Overridden", value: "OVERRIDDEN" },
                  { label: "Denied", value: "DENIED" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilterMode(tab.value)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    filterMode === tab.value
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory("ALL")}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeCategory === "ALL"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-[var(--color-app-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-[var(--color-app-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Modules & Granular Actions Accordion / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-[var(--color-text-secondary)] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                Tri-State Access Resolution Precedence:
              </span>{" "}
              Explicit <strong>DENY</strong> strictly overrides department defaults and role permissions.
              Explicit <strong>GRANT</strong> permits actions not in the department baseline.
              Clicking <strong>[Default]</strong> restores baseline department inheritance.
            </div>
          </div>

          {CATEGORIES.map((category) => {
            if (activeCategory !== "ALL" && activeCategory !== category) return null;

            const categoryModules = OPERATOR_MODULE_CATALOG.filter((m) => m.category === category);

            // Filter modules by search and filterMode
            const matchingModules = categoryModules.filter((mod) => {
              const matchesSearch =
                !q ||
                mod.name.toLowerCase().includes(q) ||
                mod.key.toLowerCase().includes(q) ||
                mod.route.toLowerCase().includes(q) ||
                mod.description.toLowerCase().includes(q);

              if (!matchesSearch) return false;

              if (filterMode === "ALL") return true;

              const moduleActionResolutions = mod.actions.map((act) =>
                resolveEffectivePermission(
                  operator.department,
                  mod.key,
                  act,
                  stagedOverrides
                )
              );

              if (filterMode === "ALLOWED") {
                return moduleActionResolutions.some((r) => r.allowed);
              }
              if (filterMode === "DENIED") {
                return moduleActionResolutions.some((r) => !r.allowed);
              }
              if (filterMode === "OVERRIDDEN") {
                return moduleActionResolutions.some(
                  (r) => r.state === "INDIVIDUAL_GRANT" || r.state === "INDIVIDUAL_DENY"
                );
              }
              return true;
            });

            if (matchingModules.length === 0) return null;

            const isCollapsed = Boolean(collapsedCategories[category]);

            return (
              <div
                key={category}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] overflow-hidden shadow-xs"
              >
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category)}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--color-sidebar)] text-left hover:bg-[var(--color-hover)] transition-colors border-b border-[var(--color-border)]"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                    <span className="font-bold text-xs text-[var(--color-text-primary)]">
                      {category}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      ({matchingModules.length} module{matchingModules.length === 1 ? "" : "s"})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                    <span>
                      {matchingModules.filter((m) =>
                        m.actions.some(
                          (act) =>
                            resolveEffectivePermission(
                              operator.department,
                              m.key,
                              act,
                              stagedOverrides
                            ).allowed
                        )
                      ).length}{" "}
                      active
                    </span>
                  </div>
                </button>

                {/* Module Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-[var(--color-border)]">
                    {matchingModules.map((module) => {
                      return (
                        <div key={module.key} className="p-3.5 space-y-3 bg-[var(--color-surface)]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold text-xs text-[var(--color-text-primary)]">
                                  {module.name}
                                </h4>
                                <span className="rounded bg-[var(--color-app-bg)] border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] font-mono text-[var(--color-text-muted)]">
                                  {module.route}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {module.description}
                              </p>
                            </div>
                          </div>

                          {/* Granular Actions Tri-State Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                            {module.actions.map((action) => {
                              const permRes = resolveEffectivePermission(
                                operator.department,
                                module.key,
                                action,
                                stagedOverrides
                              );

                              const override = stagedOverrides.find(
                                (o) => o.moduleKey === module.key && o.action === action
                              );

                              return (
                                <div
                                  key={action}
                                  className={`rounded-lg border p-2.5 text-xs transition-colors space-y-2 ${
                                    permRes.allowed
                                      ? permRes.state === "INDIVIDUAL_GRANT"
                                        ? "border-emerald-500/40 bg-emerald-500/8"
                                        : "border-blue-500/30 bg-blue-500/5"
                                      : permRes.state === "INDIVIDUAL_DENY"
                                      ? "border-rose-500/40 bg-rose-500/8"
                                      : "border-[var(--color-border)] bg-[var(--color-app-bg)] opacity-85"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--color-text-primary)]">
                                      {action}
                                    </span>

                                    {/* Status Badge */}
                                    {permRes.state === "DEPARTMENT_DEFAULT" ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                        <Check className="w-2.5 h-2.5" /> Dept Default
                                      </span>
                                    ) : permRes.state === "INDIVIDUAL_GRANT" ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                        <PlusCircle className="w-2.5 h-2.5" /> Grant Override
                                      </span>
                                    ) : permRes.state === "INDIVIDUAL_DENY" ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                        <Ban className="w-2.5 h-2.5" /> Deny Override
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                        <Lock className="w-2.5 h-2.5" /> Not Assigned
                                      </span>
                                    )}
                                  </div>

                                  {/* 3-way Segmented Button */}
                                  <div className="grid grid-cols-3 gap-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetActionOverride(module.key, action, "DEFAULT")
                                      }
                                      className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors text-center ${
                                        !override
                                          ? "bg-blue-600 text-white font-bold shadow-xs"
                                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                      }`}
                                      title="Reset to default department inheritance"
                                    >
                                      Default
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetActionOverride(module.key, action, "GRANT")
                                      }
                                      className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors text-center ${
                                        override?.type === "GRANT"
                                          ? "bg-emerald-600 text-white font-bold shadow-xs"
                                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                      }`}
                                      title="Force allow this action (Individual Grant)"
                                    >
                                      Grant
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetActionOverride(module.key, action, "DENY")
                                      }
                                      className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors text-center ${
                                        override?.type === "DENY"
                                          ? "bg-rose-600 text-white font-bold shadow-xs"
                                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                      }`}
                                      title="Force deny this action (Individual Denial)"
                                    >
                                      Deny
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-sidebar)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[var(--color-text-muted)]">
            {hasUnsavedChanges ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Unsaved permission modifications ({stagedOverrides.length} override rules)
              </span>
            ) : (
              <span>All permission overrides in sync</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <AdminButton type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </AdminButton>
            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              disabled={!hasUnsavedChanges}
              onClick={() => setConfirmSaveOpen(true)}
            >
              Save Changes
            </AdminButton>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog before saving */}
      <ConfirmActionModal
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        title={`Apply Permission Changes for ${operator.name}?`}
        description={`This will commit ${stagedOverrides.length} individual permission override(s) for ${operator.name} in department "${operator.department}". Changes take effect immediately across all active platform operator sessions.`}
        confirmLabel="Confirm & Save Permissions"
        variant="primary"
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}
