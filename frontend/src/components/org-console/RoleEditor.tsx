"use client";

import React, { useId } from "react";
import Link from "next/link";
import { ArrowDown, ChevronRight, Crown, History, Lock, Minus, Plus, RotateCcw, Save, ShieldCheck, ShieldHalf, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_TIER_LABEL,
  type Member,
  type PermissionId,
  type RoleChange,
  type RoleDef,
  type RoleTier,
} from "@/mocks/org-console";
import { AdminButton, Avatar, AvatarStack, StatusBadge, SurfaceCard, formatDateTime } from "@/components/delivery/DeliveryUI";
import { permissionLabel, roleLock, toggleLockReason, type OrgFamily } from "./role-rules";
import { useOrgLookups } from "./OrgUI";

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

export function diffPermissions(baseline: PermissionId[], value: PermissionId[]) {
  const b = new Set(baseline);
  const v = new Set(value);
  return {
    added: value.filter((p) => !b.has(p)),
    removed: baseline.filter((p) => !v.has(p)),
  };
}

export function changeSummary(added: PermissionId[], removed: PermissionId[]) {
  const parts: string[] = [];
  if (added.length) parts.push(`Grant ${added.map(permissionLabel).join(", ")}`);
  if (removed.length) parts.push(`Remove ${removed.map(permissionLabel).join(", ")}`);
  return parts.join(" · ") || "No changes";
}

/* ----------------------------------------------------------------------------
 * Single toggle
 * ------------------------------------------------------------------------- */

function PermissionToggle({
  label,
  description,
  checked,
  changed,
  lockReason,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  changed: boolean;
  lockReason?: string;
  onToggle: () => void;
}) {
  const tipId = useId();
  const locked = Boolean(lockReason);
  return (
    <div
      className={cn(
        "group/toggle relative flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200",
        locked
          ? "border-dashed border-[var(--color-border)] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-elevated)_6px,var(--color-elevated)_12px)]"
          : changed
            ? "border-blue-500/60 bg-blue-500/10 shadow-sm"
            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500/30"
      )}
    >
      <div className="min-w-0">
        <p className={cn("flex flex-wrap items-center gap-1.5 text-xs font-semibold", locked && "text-[var(--color-text-secondary)]")}>
          {locked && <Lock className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
          {label}
          {changed && !locked && (
            <span className="rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">{checked ? "On" : "Off"} · changed</span>
          )}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
        {locked && <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">{lockReason}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? tipId : undefined}
        onClick={() => {
          if (!locked) onToggle();
        }}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
          checked ? (locked ? "bg-slate-400 dark:bg-slate-600" : "bg-[#1A73E8]") : "bg-slate-300 dark:bg-slate-700",
          locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        )}
      >
        <span className={cn("absolute top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-all duration-200", checked ? "left-[18px]" : "left-0.5")}>
          {locked && <Lock className="w-2.5 h-2.5 text-slate-500" aria-hidden />}
        </span>
      </button>
      {locked && (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute right-2 -top-2 z-20 -translate-y-full max-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-1.5 text-[11px] text-[var(--color-text-primary)] shadow-xl opacity-0 transition-opacity duration-150 group-hover/toggle:opacity-100 group-focus-within/toggle:opacity-100"
        >
          {lockReason}
        </span>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Grouped toggles (same component for create and edit)
 * ------------------------------------------------------------------------- */

export function PermissionToggles({
  family,
  role,
  value,
  baseline,
  onChange,
  roles,
}: {
  family: OrgFamily;
  /** null while creating a role */
  role: RoleDef | null;
  value: PermissionId[];
  baseline: PermissionId[];
  onChange: (next: PermissionId[]) => void;
  roles: RoleDef[];
}) {
  const on = new Set(value);
  const base = new Set(baseline);
  const toggle = (id: PermissionId) => onChange(on.has(id) ? value.filter((p) => p !== id) : [...value, id]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {PERMISSION_GROUPS.map((group) => {
        const perms = PERMISSIONS.filter((p) => p.category === group.id);
        const editable = perms.filter((p) => !toggleLockReason(family, role, p.id, roles));
        const countOn = perms.filter((p) => on.has(p.id)).length;
        const allOn = editable.length > 0 && editable.every((p) => on.has(p.id));
        return (
          <SurfaceCard key={group.id} className={cn("p-3.5 space-y-2.5", group.id === "Organization" && "xl:col-span-2")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{group.id}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{group.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={`${countOn} of ${perms.length} on`} tone={countOn ? "info" : "neutral"} />
                {editable.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = new Set(editable.map((p) => p.id));
                      onChange(allOn ? value.filter((p) => !ids.has(p)) : Array.from(new Set([...value, ...ids])));
                    }}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {allOn ? "Switch off" : "Switch on"} all
                  </button>
                )}
              </div>
            </div>
            <div className={cn("grid grid-cols-1 gap-2", group.id === "Organization" && "md:grid-cols-2")}>
              {perms.map((p) => (
                <PermissionToggle
                  key={p.id}
                  label={p.label}
                  description={p.description}
                  checked={on.has(p.id)}
                  changed={on.has(p.id) !== base.has(p.id)}
                  lockReason={toggleLockReason(family, role, p.id, roles)}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Save bar
 * ------------------------------------------------------------------------- */

export function SaveChangesBar({
  added,
  removed,
  onDiscard,
  onSave,
  saving,
  error,
  saveLabel = "Save changes",
  disabled,
}: {
  added: PermissionId[];
  removed: PermissionId[];
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
  error?: string;
  saveLabel?: string;
  disabled?: boolean;
}) {
  const count = added.length + removed.length;
  if (count === 0 && !error) return null;
  return (
    <div className="sticky bottom-3 z-20 pw-rise-none">
      <div className="rounded-2xl border border-blue-500/40 bg-[var(--color-surface)]/95 backdrop-blur-md shadow-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1A73E8] px-1.5 text-[11px] font-bold text-white">{count}</span>
            {count === 1 ? "1 unsaved change" : `${count} unsaved changes`}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {added.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300"><Plus className="w-3 h-3" />{permissionLabel(p)}</span>
            ))}
            {removed.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-300"><Minus className="w-3 h-3" />{permissionLabel(p)}</span>
            ))}
          </div>
          {error && <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <AdminButton variant="outline" onClick={onDiscard} disabled={saving}><RotateCcw className="w-3.5 h-3.5" /> Discard</AdminButton>
          <AdminButton onClick={onSave} isLoading={saving} disabled={disabled || count === 0}><Save className="w-3.5 h-3.5" /> {saveLabel}</AdminButton>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Role ladder
 * ------------------------------------------------------------------------- */

const TIER_ICON: Record<RoleTier, React.ElementType> = { 0: Crown, 1: ShieldHalf, 2: Users };

export function RoleLadder({
  family,
  roles,
  members,
  roleHref,
}: {
  family: OrgFamily;
  roles: RoleDef[];
  members: Member[];
  roleHref: (id: string) => string;
}) {
  const tiers: RoleTier[] = [0, 1, 2];
  return (
    <div className="space-y-2">
      {tiers.map((tier, i) => {
        const tierRoles = roles.filter((r) => r.tier === tier);
        const Icon = TIER_ICON[tier];
        return (
          <React.Fragment key={tier}>
            {i > 0 && (
              <div className="flex justify-center" aria-hidden>
                <ArrowDown className="w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
            )}
            <section aria-label={ROLE_TIER_LABEL[tier]} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 sm:p-4 space-y-3">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tier === 0 ? "bg-amber-500/15 text-amber-600" : tier === 1 ? "bg-blue-500/15 text-blue-600" : "bg-violet-500/15 text-violet-600")}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  Tier {tier + 1} · {ROLE_TIER_LABEL[tier]}
                </p>
                <span className="text-[11px] text-[var(--color-text-muted)]">{tierRoles.length} role{tierRoles.length === 1 ? "" : "s"}</span>
              </header>
              {tierRoles.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">No roles in this tier.</p>
              ) : (
                <div className={cn("grid gap-3", tier === 2 ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4" : "grid-cols-1")}>
                  {tierRoles.map((r) => {
                    const holders = members.filter((m) => m.roleId === r.id);
                    const lock = roleLock(family, r, roles);
                    return (
                      <Link key={r.id} href={roleHref(r.id)} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <SurfaceCard className="h-full p-4 space-y-2.5 border-l-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeftColor: r.color }}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{r.name}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)]">{r.system ? "Built-in" : "Custom"} role</p>
                            </div>
                            {lock ? (
                              <span title={lock.reason} className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                <Lock className="w-3 h-3" /> {lock.label}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <ShieldCheck className="w-3 h-3" /> Editable
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{r.description}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                            <span className="flex items-center gap-2">
                              <AvatarStack people={holders} max={4} />
                              <span className="text-[11px] text-[var(--color-text-muted)]">{holders.length} member{holders.length === 1 ? "" : "s"}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                              {r.permissions.length} / {PERMISSIONS.length} permissions <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </SurfaceCard>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Change history
 * ------------------------------------------------------------------------- */

export function RoleHistory({ entries }: { entries: RoleChange[] }) {
  const lk = useOrgLookups();
  if (entries.length === 0) {
    return <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No changes recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 before:absolute before:left-3 before:top-1 before:bottom-1 before:w-px before:bg-[var(--color-border)]">
      {entries.map((e) => (
        <li key={e.id} className="relative flex items-start gap-3">
          <span className="relative z-10"><Avatar person={lk.member(e.actorId)} size="sm" /></span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs"><b>{lk.member(e.actorId)?.name ?? "Unknown"}</b> <span className="text-[var(--color-text-secondary)]">{e.summary}</span></p>
            {(e.added.length > 0 || e.removed.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {e.added.map((p) => <span key={p} className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-px text-[10px] text-emerald-700 dark:text-emerald-300"><Plus className="w-2.5 h-2.5" />{permissionLabel(p)}</span>)}
                {e.removed.map((p) => <span key={p} className="inline-flex items-center gap-0.5 rounded bg-rose-500/12 px-1.5 py-px text-[10px] text-rose-700 dark:text-rose-300"><Minus className="w-2.5 h-2.5" />{permissionLabel(p)}</span>)}
              </div>
            )}
            <p className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]"><History className="w-3 h-3" />{formatDateTime(e.at)} UTC</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
