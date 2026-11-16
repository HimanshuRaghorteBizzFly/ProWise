"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Building2,
  Check,
  CheckSquare,
  Code,
  Copy,
  Edit3,
  Eye,
  FileCheck,
  Globe,
  Lock,
  MoreVertical,
  Power,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Trash2,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { AdminRole } from "../_types";
import { TOTAL_CAPABILITIES_COUNT } from "../_services/permission-matrix";
import { AdminButton, StatusBadge } from "./SuperAdminPrimitives";

interface RoleCardProps {
  role: AdminRole;
  isSelected?: boolean;
  isPreviewing?: boolean;
  onOpenDrawer: (role: AdminRole) => void;
  onPreviewRole: (role: AdminRole) => void;
  onCloneRole: (role: AdminRole) => void;
  onEditRoleMeta: (role: AdminRole) => void;
  onAssignUsers: (role: AdminRole) => void;
  onToggleActive: (role: AdminRole) => void;
  onDeleteRole: (role: AdminRole) => void;
  canManage: boolean;
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  "Super Admin": ShieldAlert,
  "Super Administrator": ShieldAlert,
  "Platform Operator": UserCog,
  "Organization Owner": Building2,
  "Organization Admin": ShieldCheck,
  "Project Manager": Briefcase,
  "Team Lead": Users,
  Developer: Code,
  "QA / Reviewer": CheckSquare,
  Viewer: Eye,
  "Viewer / Stakeholder": Eye,
  "Communications Manager": Shield,
  "Compliance Auditor": FileCheck,
  "Security Specialist": ShieldAlert,
  "External Contractor": Terminal,
};

const COLOR_MAP: Record<
  AdminRole["color"],
  {
    stripe: string;
    border: string;
    badge: string;
    iconBg: string;
    progress: string;
  }
> = {
  blue: {
    stripe: "bg-blue-500",
    border: "hover:border-blue-500/50",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    iconBg: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    progress: "bg-blue-500",
  },
  emerald: {
    stripe: "bg-emerald-500",
    border: "hover:border-emerald-500/50",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    iconBg: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    progress: "bg-emerald-500",
  },
  violet: {
    stripe: "bg-violet-500",
    border: "hover:border-violet-500/50",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    iconBg: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    progress: "bg-violet-500",
  },
  amber: {
    stripe: "bg-amber-500",
    border: "hover:border-amber-500/50",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    iconBg: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    progress: "bg-amber-500",
  },
  slate: {
    stripe: "bg-cyan-500",
    border: "hover:border-cyan-500/50",
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    iconBg: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
    progress: "bg-cyan-500",
  },
};

export function RoleCard({
  role,
  isSelected,
  isPreviewing,
  onOpenDrawer,
  onPreviewRole,
  onCloneRole,
  onEditRoleMeta,
  onAssignUsers,
  onToggleActive,
  onDeleteRole,
  canManage,
}: RoleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const IconComponent = ROLE_ICONS[role.name] || Shield;
  const colors = COLOR_MAP[role.color] || COLOR_MAP.blue;

  const totalCapCount = TOTAL_CAPABILITIES_COUNT || 64;
  const permissionCount = role.permissions.length;
  const percentage = Math.min(100, Math.round((permissionCount / totalCapCount) * 100));

  const isPlatformScope = role.scope === "PLATFORM";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDrawer(role)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDrawer(role);
        }
      }}
      className={`group relative overflow-hidden rounded-xl border p-4 text-left cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/30 bg-[var(--color-surface)] shadow-md"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)]/35 hover:-translate-y-0.5 hover:shadow-subtle"
      } ${role.isActive === false ? "opacity-60 bg-[var(--color-app-bg)]" : ""}`}
    >
      {/* Accent top stripe */}
      <span
        className={`absolute inset-x-0 top-0 h-1.5 ${
          role.isActive === false ? "bg-slate-400" : colors.stripe
        }`}
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                role.isActive === false ? "bg-slate-500/10 text-slate-500" : colors.iconBg
              }`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {role.hierarchyRank && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                    #{role.hierarchyRank}
                  </span>
                )}
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {role.name}
                </h4>
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono block truncate">
                {role.hierarchyTitle || `slug: ${role.slug}`}
              </span>
            </div>
          </div>

          {/* Quick Menu */}
          <div
            className="relative shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl z-40 text-xs animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDrawer(role);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors font-medium"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                  <span>Edit Permissions</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onAssignUsers(role);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Assign Users</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage}
                  onClick={() => {
                    setMenuOpen(false);
                    onCloneRole(role);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-40 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-violet-500" />
                  <span>Clone Role</span>
                </button>

                {!role.isSystem && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canManage}
                      onClick={() => {
                        setMenuOpen(false);
                        onEditRoleMeta(role);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-40 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Rename / Edit</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canManage}
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleActive(role);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-40 transition-colors"
                    >
                      <Power className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{role.isActive === false ? "Activate Role" : "Deactivate Role"}</span>
                    </button>

                    <div className="my-1 border-t border-[var(--color-border)]" />

                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canManage}
                      onClick={() => {
                        setMenuOpen(false);
                        onDeleteRole(role);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Role</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Badges Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
              isPlatformScope
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
            }`}
          >
            <Globe className="w-2.5 h-2.5" />
            {isPlatformScope ? "Platform Scope" : "Organization Scope"}
          </span>

          {role.hierarchyTier && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
              {role.hierarchyTier}
            </span>
          )}

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
              role.isSystem
                ? "bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            }`}
          >
            {role.isSystem ? "System Role" : "Custom Role"}
          </span>

          {role.isActive === false && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              Inactive
            </span>
          )}

          {isPreviewing && (
            <StatusBadge label="Previewing" tone="warning" dot />
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed min-h-[34px]">
          {role.description}
        </p>
      </div>

      {/* Permissions Progress Bar & Stats */}
      <div className="space-y-2 pt-2.5 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text-primary)] tabular-nums">
            {permissionCount} capabilities
          </span>
          <span className="tabular-nums font-semibold text-[var(--color-text-secondary)]">
            {percentage}%
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-[var(--color-app-bg)] overflow-hidden border border-[var(--color-border)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              role.isActive === false ? "bg-slate-400" : colors.progress
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* User count & Action row */}
        <div
          className="flex items-center justify-between gap-1 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onAssignUsers(role)}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="tabular-nums">{role.userCount || 0} users</span>
          </button>

          <div className="flex items-center gap-1">
            <AdminButton
              variant={isPreviewing ? "subtle" : "ghost"}
              size="xs"
              onClick={() => onPreviewRole(role)}
              title="Preview platform console as this role"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </AdminButton>

            <AdminButton
              variant="outline"
              size="xs"
              onClick={() => onOpenDrawer(role)}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:border-blue-500/50"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Edit Permissions</span>
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
