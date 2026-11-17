"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Check,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AdminRole, RoleAssignedUser } from "../_types";
import { SAMPLE_ASSIGNABLE_USERS } from "../_services/permission-matrix";
import {
  AdminButton,
  AdminModal,
  StatusBadge,
} from "./SuperAdminPrimitives";

interface AssignUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: AdminRole | null;
  onSave: (roleId: string, assignedUsers: RoleAssignedUser[]) => void;
}

export const AssignUsersModal: React.FC<AssignUsersModalProps> = ({
  isOpen,
  onClose,
  role,
  onSave,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Deduplicate and combine candidate pool with role's existing users
  const candidateUsers = useMemo<RoleAssignedUser[]>(() => {
    const map = new Map<string, RoleAssignedUser>();
    SAMPLE_ASSIGNABLE_USERS.forEach((u) => map.set(u.id, u));
    if (role?.assignedUsers) {
      role.assignedUsers.forEach((u) => map.set(u.id, u));
    }
    return Array.from(map.values());
  }, [role]);

  // Synchronize selection with role.assignedUsers when modal opens
  useEffect(() => {
    if (role && role.assignedUsers) {
      setSelectedUserIds(new Set(role.assignedUsers.map((u) => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
    setSearchQuery("");
    setFilterMode("ALL");
  }, [role, isOpen]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidateUsers.filter((u) => {
      const isAssigned = selectedUserIds.has(u.id);

      if (filterMode === "ASSIGNED" && !isAssigned) return false;
      if (filterMode === "UNASSIGNED" && isAssigned) return false;

      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q))
      );
    });
  }, [candidateUsers, selectedUserIds, searchQuery, filterMode]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.delete(u.id));
      return next;
    });
  };

  const handleSave = () => {
    if (!role) return;
    const finalUsers = candidateUsers.filter((u) => selectedUserIds.has(u.id));
    onSave(role.id, finalUsers);
    onClose();
  };

  if (!isOpen || !role) return null;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Users — ${role.name}`}
      description={`Manage operators and team members authorized with this ${role.scope?.toLowerCase() || "organization"} role.`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Role Brief Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  {role.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {role.scope || "ORGANIZATION"}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {role.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {selectedUserIds.size}
            </span>
            <span className="text-xs text-slate-400 block">Assigned</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterMode("ALL")}
              className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
                filterMode === "ALL"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              All ({candidateUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("ASSIGNED")}
              className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
                filterMode === "ASSIGNED"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Assigned ({selectedUserIds.size})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("UNASSIGNED")}
              className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
                filterMode === "UNASSIGNED"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Unassigned ({candidateUsers.length - selectedUserIds.size})
            </button>
          </div>
        </div>

        {/* Selection helper row */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-[11px]"
            >
              Select All Filtered
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={deselectAllFiltered}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-[11px]"
            >
              Deselect Filtered
            </button>
          </div>
        </div>

        {/* Users Checklist List */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto bg-white dark:bg-slate-900">
          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <Users className="w-7 h-7 mx-auto mb-1.5 text-slate-400" />
              No users match your search query.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isChecked = selectedUserIds.has(u.id);
              const initials = u.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <label
                  key={u.id}
                  className={`flex items-center justify-between p-3 cursor-pointer transition select-none ${
                    isChecked
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {u.name}
                        </span>
                        {u.department && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {u.department}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {u.email}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isChecked
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isChecked ? "Assigned" : "Available"}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-400">
            Changes will take effect immediately across all active tenant sessions.
          </p>
          <div className="flex items-center gap-2">
            <AdminButton variant="outline" size="sm" onClick={onClose}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleSave}>
              Save Assignments ({selectedUserIds.size})
            </AdminButton>
          </div>
        </div>
      </div>
    </AdminModal>
  );
};
