import { PERMISSIONS, ROLES, type Member, type PermissionId, type RoleDef } from "@/mocks/org-console";

/**
 * Pure access rules for the Owner and Admin workspaces.
 * The UI and the store both call these, so a locked action cannot be performed
 * even if a button is bypassed.
 */

export type OrgFamily = "owner" | "admin";

const LABEL = new Map(PERMISSIONS.map((p) => [p.id, p.label]));

export function permissionLabel(id: PermissionId) {
  return LABEL.get(id) ?? id;
}

export function actorPermissions(family: OrgFamily, roles: RoleDef[] = ROLES): PermissionId[] {
  const id = family === "owner" ? "role-owner" : "role-admin";
  return roles.find((r) => r.id === id)?.permissions ?? [];
}

export interface Verdict {
  ok: boolean;
  reason?: string;
}

/** Can this actor give `role` to someone? Admins never grant more than they hold. */
export function canAssignRole(family: OrgFamily, role: RoleDef, roles: RoleDef[] = ROLES): Verdict {
  if (family === "owner") return role.tier === 0 ? { ok: false, reason: "Use Transfer ownership to change the owner." } : { ok: true };
  if (role.tier === 0) return { ok: false, reason: "Only the owner can hand over ownership (Transfer ownership)." };
  const mine = new Set(actorPermissions(family, roles));
  const missing = role.permissions.filter((p) => !mine.has(p));
  if (missing.length === 0) return { ok: true };
  const names = missing.slice(0, 2).map(permissionLabel).join(", ");
  return {
    ok: false,
    reason: `Grants ${missing.length} permission${missing.length > 1 ? "s" : ""} you don't hold (${names}${missing.length > 2 ? ", …" : ""}).`,
  };
}

/** Can this actor change role or status of `member`? */
export function canManageMember(family: OrgFamily, member: Member, actorId: string, roles: RoleDef[] = ROLES): Verdict {
  if (member.id === actorId) return { ok: false, reason: "You can't change your own access." };
  if (family === "owner") return { ok: true };
  if (member.roleId === "role-owner") return { ok: false, reason: "The owner's access can only be changed by the owner." };
  const role = roles.find((r) => r.id === member.roleId);
  if (role && !canAssignRole(family, role, roles).ok) {
    return { ok: false, reason: `${role.name} holds permissions above yours.` };
  }
  return { ok: true };
}

/* ----------------------------------------------------------------------------
 * Role editing (Roles & Permissions pages)
 * ------------------------------------------------------------------------- */

/** Short lock label shown on a role ("Owner only" / "Above your authority"). */
export function roleLock(family: OrgFamily, role: RoleDef, roles: RoleDef[] = ROLES): { label: string; reason: string } | undefined {
  if (role.tier === 0) {
    return family === "owner"
      ? { label: "Read-only", reason: "The Organization Owner role always holds every permission and can't be edited." }
      : { label: "Above your authority", reason: "The Owner role sits above Organization Admin." };
  }
  if (family === "admin") {
    if (role.tier === 1) return { label: "Owner only", reason: "Only the Organization Owner can edit the Admin role." };
    if (!actorPermissions(family, roles).includes("role.create")) return { label: "No permission", reason: "Your role can't create or edit roles." };
  }
  return undefined;
}

export function canEditRole(family: OrgFamily, role: RoleDef, roles: RoleDef[] = ROLES): Verdict {
  const lock = roleLock(family, role, roles);
  return lock ? { ok: false, reason: lock.reason } : { ok: true };
}

export function canCreateRole(family: OrgFamily, roles: RoleDef[] = ROLES): Verdict {
  if (family === "owner") return { ok: true };
  return actorPermissions(family, roles).includes("role.create") ? { ok: true } : { ok: false, reason: "Your role can't create roles." };
}

/** Why one toggle can't be switched for this role (undefined = editable). `role` is null when creating. */
export function toggleLockReason(family: OrgFamily, role: RoleDef | null, id: PermissionId, roles: RoleDef[] = ROLES): string | undefined {
  if (role) {
    const lock = roleLock(family, role, roles);
    if (lock) return lock.label === "Read-only" ? "Owner role is read-only" : lock.label;
  }
  const def = PERMISSIONS.find((p) => p.id === id);
  if (def?.ownerOnly) return "Owner only — can't be delegated";
  if (family === "admin" && !actorPermissions(family, roles).includes(id)) return "You don't hold this permission";
  return undefined;
}

/**
 * Validates a permission change. Every permission that differs between `before` and `after`
 * must be switchable by this actor; anything else is rejected, whatever the form sent.
 */
export function validatePermissionChange(
  family: OrgFamily,
  role: RoleDef | null,
  before: PermissionId[],
  after: PermissionId[],
  roles: RoleDef[] = ROLES
): Verdict {
  if (role) {
    const edit = canEditRole(family, role, roles);
    if (!edit.ok) return edit;
  } else {
    const create = canCreateRole(family, roles);
    if (!create.ok) return create;
  }
  const known = new Set(PERMISSIONS.map((p) => p.id));
  if (after.some((p) => !known.has(p))) return { ok: false, reason: "Unknown permission." };
  const b = new Set(before);
  const a = new Set(after);
  const changed = [...after.filter((p) => !b.has(p)), ...before.filter((p) => !a.has(p))];
  const blocked = changed.filter((p) => toggleLockReason(family, null, p, roles));
  if (blocked.length) {
    return { ok: false, reason: `You can't change: ${blocked.map(permissionLabel).join(", ")}.` };
  }
  return { ok: true };
}

/** Why a single permission is locked for this actor (undefined = not locked). */
export function permissionLockReason(family: OrgFamily, id: PermissionId, roles: RoleDef[] = ROLES): string | undefined {
  if (family === "owner") return undefined;
  const def = PERMISSIONS.find((p) => p.id === id);
  if (def?.ownerOnly) return "Owner only";
  return actorPermissions(family, roles).includes(id) ? undefined : "Above your own access";
}
