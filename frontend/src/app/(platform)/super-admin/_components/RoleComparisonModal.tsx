"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Minus,
  Search,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { AdminRole } from "../_types";
import {
  ACTION_LABELS,
  GranularActionId,
  PERMISSION_MODULES,
  PermissionModuleId,
} from "../_services/permission-matrix";
import {
  AdminButton,
  AdminModal,
  AdminSelect,
  StatusBadge,
} from "./SuperAdminPrimitives";

interface RoleComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: AdminRole[];
  initialRoleAId?: string;
  initialRoleBId?: string;
}

export const RoleComparisonModal: React.FC<RoleComparisonModalProps> = ({
  isOpen,
  onClose,
  roles,
  initialRoleAId,
  initialRoleBId,
}) => {
  const [roleAId, setRoleAId] = useState<string>(
    initialRoleAId || roles[0]?.id || ""
  );
  const [roleBId, setRoleBId] = useState<string>(
    initialRoleBId || roles[1]?.id || roles[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [diffOnly, setDiffOnly] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>("ALL");

  // Keep state synchronized if initialRoleAId changes
  React.useEffect(() => {
    if (initialRoleAId) setRoleAId(initialRoleAId);
  }, [initialRoleAId]);

  React.useEffect(() => {
    if (initialRoleBId) setRoleBId(initialRoleBId);
  }, [initialRoleBId]);

  const roleA = useMemo(
    () => roles.find((r) => r.id === roleAId) || roles[0],
    [roles, roleAId]
  );
  const roleB = useMemo(
    () => roles.find((r) => r.id === roleBId) || roles[1] || roles[0],
    [roles, roleBId]
  );

  const swapRoles = () => {
    const temp = roleAId;
    setRoleAId(roleBId);
    setRoleBId(temp);
  };

  // Helper check
  const hasPerm = (role: AdminRole | undefined, permKey: string): boolean => {
    if (!role) return false;
    if (role.slug === "super-admin") return true;
    return role.permissions.includes(permKey);
  };

  // Module status comparison
  const comparisonData = useMemo(() => {
    if (!roleA || !roleB) return [];

    const query = searchQuery.trim().toLowerCase();

    return PERMISSION_MODULES.map((mod) => {
      const actions = mod.supportedActions.map((action) => {
        const key = `${mod.id}.${action}`;
        const inA = hasPerm(roleA, key);
        const inB = hasPerm(roleB, key);
        const isDiff = inA !== inB;

        let status: "BOTH" | "A_ONLY" | "B_ONLY" | "NEITHER";
        if (inA && inB) status = "BOTH";
        else if (inA && !inB) status = "A_ONLY";
        else if (!inA && inB) status = "B_ONLY";
        else status = "NEITHER";

        return {
          key,
          action,
          label: ACTION_LABELS[action]?.label || action,
          inA,
          inB,
          isDiff,
          status,
        };
      });

      const filteredActions = actions.filter((act) => {
        if (diffOnly && !act.isDiff) return false;
        if (!query) return true;
        return (
          mod.name.toLowerCase().includes(query) ||
          act.label.toLowerCase().includes(query) ||
          act.key.toLowerCase().includes(query)
        );
      });

      const moduleDiffCount = actions.filter((a) => a.isDiff).length;
      const bothCount = actions.filter((a) => a.status === "BOTH").length;

      return {
        module: mod,
        actions: filteredActions,
        totalActions: actions.length,
        diffCount: moduleDiffCount,
        bothCount,
        hasVisibleActions: filteredActions.length > 0,
      };
    }).filter((item) => {
      if (selectedModule !== "ALL" && item.module.id !== selectedModule) {
        return false;
      }
      return item.hasVisibleActions;
    });
  }, [roleA, roleB, searchQuery, diffOnly, selectedModule]);

  // Overall statistics
  const stats = useMemo(() => {
    if (!roleA || !roleB)
      return { totalA: 0, totalB: 0, matching: 0, differences: 0 };

    let totalA = 0;
    let totalB = 0;
    let matching = 0;
    let differences = 0;

    PERMISSION_MODULES.forEach((mod) => {
      mod.supportedActions.forEach((act) => {
        const key = `${mod.id}.${act}`;
        const inA = hasPerm(roleA, key);
        const inB = hasPerm(roleB, key);

        if (inA) totalA++;
        if (inB) totalB++;
        if (inA && inB) matching++;
        if (inA !== inB) differences++;
      });
    });

    return { totalA, totalB, matching, differences };
  }, [roleA, roleB]);

  if (!isOpen) return null;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Role Permission Comparison"
      description="Examine side-by-side granular capabilities, access differentials, and policy drift."
      maxWidth="5xl"
    >
      <div className="space-y-5">
        {/* Role Selectors Bar */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Role A (Baseline)
            </label>
            <AdminSelect
              value={roleAId}
              onChange={(e) => setRoleAId(e.target.value)}
              className="font-medium"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id} disabled={r.id === roleBId}>
                  {r.name} ({r.scope || "ORG"} • {r.permissions.length} perms)
                </option>
              ))}
            </AdminSelect>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats.totalA}
              </span>{" "}
              capabilities enabled
              {roleA?.isSystem && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 font-medium">
                  System
                </span>
              )}
            </div>
          </div>

          <div className="md:col-span-1 flex justify-center py-1">
            <button
              type="button"
              onClick={swapRoles}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 transition shadow-sm"
              title="Swap Roles"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Role B (Comparison)
            </label>
            <AdminSelect
              value={roleBId}
              onChange={(e) => setRoleBId(e.target.value)}
              className="font-medium"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id} disabled={r.id === roleAId}>
                  {r.name} ({r.scope || "ORG"} • {r.permissions.length} perms)
                </option>
              ))}
            </AdminSelect>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900 dark:text-white">
                {stats.totalB}
              </span>{" "}
              capabilities enabled
              {roleB?.isSystem && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 font-medium">
                  System
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Pill Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
              Role A Total
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {stats.totalA}
            </span>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
              Role B Total
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {stats.totalB}
            </span>
          </div>
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <span className="text-emerald-700 dark:text-emerald-400 block text-[11px] font-medium">
              Granted in Both
            </span>
            <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
              {stats.matching}
            </span>
          </div>
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <span className="text-amber-700 dark:text-amber-400 block text-[11px] font-medium">
              Differentials
            </span>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
              {stats.differences}
            </span>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by capability or module..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All 12 Modules</option>
              {PERMISSION_MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setDiffOnly(!diffOnly)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium flex items-center gap-1.5 ${
                diffOnly
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Differences Only
            </button>
          </div>
        </div>

        {/* Matrix Comparison Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-[50vh] overflow-y-auto">
          {comparisonData.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              No matching permissions found for current filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {comparisonData.map(({ module, actions, diffCount }) => (
                <div key={module.id} className="p-3">
                  {/* Module header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {module.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({actions.length} capabilities)
                      </span>
                    </div>
                    {diffCount > 0 ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        {diffCount} difference{diffCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        Identical
                      </span>
                    )}
                  </div>

                  {/* Actions list */}
                  <div className="grid grid-cols-1 gap-1.5">
                    {actions.map((act) => (
                      <div
                        key={act.key}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs transition ${
                          act.isDiff
                            ? "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-slate-400">
                            {act.key}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {act.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                          {/* Role A Indicator */}
                          <div className="flex items-center gap-1.5 w-24 justify-end">
                            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
                              {roleA?.name?.slice(0, 10)}
                            </span>
                            {act.inA ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>

                          {/* Role B Indicator */}
                          <div className="flex items-center gap-1.5 w-24 justify-end">
                            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
                              {roleB?.name?.slice(0, 10)}
                            </span>
                            {act.inB ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="w-24 text-right">
                            {act.status === "BOTH" && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                Both Have
                              </span>
                            )}
                            {act.status === "A_ONLY" && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                Role A Only
                              </span>
                            )}
                            {act.status === "B_ONLY" && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                                Role B Only
                              </span>
                            )}
                            {act.status === "NEITHER" && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                Neither
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Least-privilege verification: always audit elevated access before granting to multi-tenant users.
          </p>
          <AdminButton variant="outline" size="sm" onClick={onClose}>
            Close Comparison
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
};
