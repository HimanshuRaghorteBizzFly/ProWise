"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Eye, ChevronDown, Check, Shield, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import { useAuthStore } from "@/store/auth-store";
import {
  buildRolePreviewDefinitions,
  resolvePreviewRole,
  RolePreviewDefinition,
} from "../_services/role-preview-config";
import { cn } from "@/lib/utils";

export function RolePreviewGlobalBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);
  const setActiveRolePreview = useSuperAdminStore((s) => s.setActiveRolePreview);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const setCurrentRole = useAuthStore((s) => s.setCurrentRole);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return null;
  if (!activeRoleId || activeRoleId === "role-super-admin") return null;

  const orgId = currentOrg?.id || "org-acme";
  const allRoles = buildRolePreviewDefinitions(orgId);
  const activePreview = resolvePreviewRole(activeRoleId, orgId);

  const handleSelectRole = (roleDef: RolePreviewDefinition) => {
    setMenuOpen(false);
    setActiveRolePreview(roleDef.id);
    setCurrentRole(roleDef.systemRole);
    toast.info(`Switched preview to ${roleDef.name}`);
    router.push(roleDef.dashboardUrl);
  };

  const handleRestoreSuperAdmin = () => {
    setActiveRolePreview("role-super-admin");
    setCurrentRole("SUPER_ADMIN");
    toast.success("Restored full Super Administrator access");
    router.push("/super-admin/dashboard");
  };

  const isOnRoleDashboard = pathname === activePreview.dashboardUrl || pathname.startsWith(activePreview.dashboardUrl);

  return (
    <aside
      aria-label="Active role preview mode"
      className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 px-4 py-2 text-xs text-amber-900 shadow-sm backdrop-blur-sm dark:text-amber-200 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
          <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 animate-pulse" />
          Preview Mode
        </span>
        <span className="text-[12px] leading-tight">
          Viewing ProWise as <strong>{activePreview.name}</strong> ({activePreview.permissionsCount} permissions enabled)
        </span>
        <span className="hidden text-[11px] text-amber-800/80 dark:text-amber-300/80 md:inline">
          — Dashboard and sections adapted to {activePreview.tier}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {!isOnRoleDashboard && (
          <button
            type="button"
            onClick={() => router.push(activePreview.dashboardUrl)}
            className="hidden items-center gap-1 rounded-lg border border-amber-500/40 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-white dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-950 sm:flex"
          >
            <span>Open {activePreview.name} Dashboard</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-white dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-900"
          >
            <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>Switch Role</span>
            <ChevronDown className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="border-b border-[var(--color-border)] px-2.5 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Switch Active Preview Role
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Live dashboard & sections update immediately
                </p>
              </div>
              <div className="mt-1 max-h-72 overflow-y-auto space-y-0.5">
                {Object.values(allRoles).map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                      activeRoleId === role.id
                        ? "bg-amber-500/15 font-semibold text-amber-800 dark:text-amber-200"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{role.name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                        {role.permissionsCount} permissions • {role.badgeLabel}
                      </div>
                    </div>
                    {activeRoleId === role.id && <Check className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRestoreSuperAdmin}
          className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-amber-700 active:scale-95"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Exit Preview</span>
        </button>
      </div>
    </aside>
  );
}
