"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Ban, CheckCircle2, Mail, ShieldCheck, UserCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { PERMISSIONS, PERMISSION_GROUPS, type AuditEvent, type Member, type PermissionCategory, type RoleDef } from "@/mocks/org-console";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  Avatar,
  DataTable,
  Panel,
  StatusBadge,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { canAssignRole, canManageMember, permissionLockReason, type OrgFamily } from "./role-rules";
import { AuditSeverityBadge, LockNote, MemberStatusBadge, RoleChip, timeAgo, useOrgHref, useOrgLookups } from "./OrgUI";
import { ORG_VIEWERS } from "@/mocks/org-console";

/* ----------------------------------------------------------------------------
 * Member table
 * ------------------------------------------------------------------------- */

export function MemberTable({ family, rows }: { family: OrgFamily; rows: Member[] }) {
  const href = useOrgHref(family);
  const lk = useOrgLookups();
  return (
    <DataTable
      rows={rows}
      rowHref={(m) => href(`members/${m.id}`)}
      empty={{ icon: Users, title: "No members match", description: "Try a different search or filter." }}
      columns={[
        {
          key: "m",
          header: "Member",
          className: "w-[55%] sm:w-[40%] lg:w-[30%]",
          render: (m) => (
            <span className="flex items-center gap-2.5 min-w-0">
              <Avatar person={m} size="sm" />
              <span className="min-w-0">
                <span className="block font-semibold truncate">{m.name}</span>
                <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{m.email}</span>
              </span>
            </span>
          ),
        },
        { key: "r", header: "Role", hideBelow: "sm", render: (m) => <RoleChip role={lk.role(m.roleId)} /> },
        { key: "s", header: "Status", render: (m) => <MemberStatusBadge status={m.status} /> },
        { key: "t", header: "Teams", hideBelow: "xl", render: (m) => <span className="truncate block">{m.teamIds.map((id) => lk.team(id)?.name).filter(Boolean).join(", ") || "—"}</span> },
        { key: "mfa", header: "MFA", hideBelow: "lg", render: (m) => (m.mfa ? <StatusBadge label="On" tone="success" /> : <StatusBadge label="Off" tone="danger" />) },
        { key: "a", header: "Last active", hideBelow: "md", render: (m) => timeAgo(m.lastActiveAt) },
      ]}
    />
  );
}

/* ----------------------------------------------------------------------------
 * Member access panel (role + status), rules enforced again in the store
 * ------------------------------------------------------------------------- */

export function MemberAccessPanel({ family, member }: { family: OrgFamily; member: Member }) {
  const roles = useOrgConsoleStore((s) => s.roles);
  const changeRole = useOrgConsoleStore((s) => s.changeMemberRole);
  const setStatus = useOrgConsoleStore((s) => s.setMemberStatus);
  const [roleId, setRoleId] = useState(member.roleId);
  const [saving, setSaving] = useState(false);
  useEffect(() => setRoleId(member.roleId), [member.roleId]);

  const manage = canManageMember(family, member, ORG_VIEWERS[family].id, roles);
  const options = roles.map((r) => {
    const v = r.id === "role-owner" ? { ok: false, reason: family === "owner" ? "Use Transfer ownership" : "Owner only" } : canAssignRole(family, r, roles);
    return { role: r, ...v };
  });
  const selected = options.find((o) => o.role.id === roleId);

  const saveRole = () => {
    setSaving(true);
    window.setTimeout(() => {
      const v = changeRole(family, member.id, roleId);
      setSaving(false);
      if (v.ok) toast.success(`${member.name} is now ${roles.find((r) => r.id === roleId)?.name}`);
      else toast.error(v.reason ?? "Not allowed");
    }, 400);
  };

  const toggleStatus = () => {
    const next = member.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const v = setStatus(family, member.id, next);
    if (v.ok) toast.success(next === "ACTIVE" ? `${member.name} re-enabled` : `${member.name} disabled — sessions revoked`);
    else toast.error(v.reason ?? "Not allowed");
  };

  return (
    <Panel title="Access" description={family === "owner" ? "You can assign any role." : "You can assign roles up to your own access."} icon={ShieldCheck} iconTone="blue" className="self-start">
      {!manage.ok ? (
        <div className="space-y-2">
          <LockNote reason={manage.reason ?? "Locked"} />
          <p className="text-xs text-[var(--color-text-secondary)]">Current role: <RoleChip role={roles.find((r) => r.id === member.roleId)} /></p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2" role="radiogroup" aria-label="Role">
            {options.map((o) => (
              <button
                key={o.role.id}
                type="button"
                role="radio"
                aria-checked={roleId === o.role.id}
                disabled={!o.ok}
                onClick={() => setRoleId(o.role.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all duration-200",
                  roleId === o.role.id ? "border-blue-500/60 bg-blue-500/10" : "border-[var(--color-border)] bg-[var(--color-app-bg)]",
                  o.ok ? "hover:-translate-y-0.5 hover:border-blue-500/40" : "opacity-70 cursor-not-allowed"
                )}
              >
                <RoleChip role={o.role} />
                {!o.ok && o.reason && <LockNote reason={o.reason.length > 46 ? "Above your access" : o.reason} />}
              </button>
            ))}
          </div>
          {selected && !selected.ok && <p className="text-[11px] text-amber-700 dark:text-amber-300">{selected.reason}</p>}
          <AdminButton className="w-full" onClick={saveRole} isLoading={saving} disabled={roleId === member.roleId || !selected?.ok}>Save role</AdminButton>
          <div className="pt-3 border-t border-[var(--color-border)]">
            <AdminButton className="w-full" variant={member.status === "ACTIVE" ? "danger" : "outline"} onClick={toggleStatus}>
              {member.status === "ACTIVE" ? <><Ban className="w-3.5 h-3.5" /> Disable member</> : <><UserCheck className="w-3.5 h-3.5" /> Re-enable member</>}
            </AdminButton>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------------------
 * Role permission lists
 * ------------------------------------------------------------------------- */

const CATEGORIES: PermissionCategory[] = PERMISSION_GROUPS.map((g) => g.id);

export function RoleCanCannot({ family, role }: { family: OrgFamily; role: RoleDef }) {
  const has = new Set(role.permissions);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title={`Can do · ${role.permissions.length}`} icon={CheckCircle2} iconTone="emerald">
        <ul className="space-y-2">
          {PERMISSIONS.filter((p) => has.has(p.id)).map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="flex items-start gap-2 min-w-0"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /><span><b className="font-semibold">{p.label}</b><span className="block text-[11px] text-[var(--color-text-muted)]">{p.description}</span></span></span>
              {permissionLockReason(family, p.id) && <LockNote reason={permissionLockReason(family, p.id)!} />}
            </li>
          ))}
          {role.permissions.length === 0 && <li className="text-xs text-[var(--color-text-muted)]">No permissions.</li>}
        </ul>
      </Panel>
      <Panel title={`Cannot do · ${PERMISSIONS.length - role.permissions.length}`} icon={XCircle} iconTone="rose">
        <ul className="space-y-2">
          {PERMISSIONS.filter((p) => !has.has(p.id)).map((p) => (
            <li key={p.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]"><XCircle className="w-4 h-4 text-rose-400 shrink-0" /><span>{p.label}</span></li>
          ))}
          {PERMISSIONS.length === role.permissions.length && <li className="text-xs text-[var(--color-text-muted)]">Nothing — this role has every permission.</li>}
        </ul>
      </Panel>
    </div>
  );
}

/** Every permission grouped by category, with the roles that hold it. Works at any width. */
export function PermissionCatalog({ family, roles }: { family: OrgFamily; roles: RoleDef[] }) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => (
        <div key={cat} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{cat}</p>
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {PERMISSIONS.filter((p) => p.category === cat).map((p) => {
              const lock = permissionLockReason(family, p.id);
              return (
                <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 md:w-[38%] shrink-0">
                    <p className="text-xs font-semibold flex flex-wrap items-center gap-1.5">{p.label}{lock && <LockNote reason={lock} />}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{p.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.filter((r) => r.permissions.includes(p.id)).map((r) => <RoleChip key={r.id} role={r} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Assign a role to a member from the role page
 * ------------------------------------------------------------------------- */

export function AssignRoleForm({ family, role }: { family: OrgFamily; role: RoleDef }) {
  const roles = useOrgConsoleStore((s) => s.roles);
  const members = useOrgConsoleStore((s) => s.members);
  const changeRole = useOrgConsoleStore((s) => s.changeMemberRole);
  const [memberId, setMemberId] = useState("");
  const verdict = role.id === "role-owner" ? { ok: false, reason: family === "owner" ? "Use Transfer ownership to change the owner." : "Only the owner can hand over ownership." } : canAssignRole(family, role, roles);
  const candidates = members.filter((m) => m.roleId !== role.id && m.status === "ACTIVE" && canManageMember(family, m, ORG_VIEWERS[family].id, roles).ok);

  if (!verdict.ok) {
    return (
      <div className="space-y-2">
        <LockNote reason="Locked" />
        <p className="text-xs text-[var(--color-text-secondary)]">{verdict.reason}</p>
      </div>
    );
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!memberId) return toast.error("Choose a member.");
        const v = changeRole(family, memberId, role.id);
        if (v.ok) {
          toast.success(`${members.find((m) => m.id === memberId)?.name} is now ${role.name}`);
          setMemberId("");
        } else toast.error(v.reason ?? "Not allowed");
      }}
    >
      <AdminSelect label="Member" value={memberId} onChange={(e) => setMemberId(e.target.value)} options={[{ label: "Choose a member…", value: "" }, ...candidates.map((m) => ({ label: `${m.name} · ${roles.find((r) => r.id === m.roleId)?.name}`, value: m.id }))]} />
      <AdminButton type="submit" className="w-full" disabled={!memberId}>Assign {role.name}</AdminButton>
    </form>
  );
}

/* ----------------------------------------------------------------------------
 * Audit table
 * ------------------------------------------------------------------------- */

export function AuditTable({ family, rows }: { family: OrgFamily; rows: AuditEvent[] }) {
  const href = useOrgHref(family);
  const lk = useOrgLookups();
  return (
    <DataTable
      rows={rows}
      rowHref={(e) => href(`audit-logs/${e.id}`)}
      empty={{ icon: Activity, title: "No events", description: "Nothing matches these filters." }}
      columns={[
        {
          key: "e",
          header: "Event",
          className: "w-[60%] md:w-[42%]",
          render: (e) => (
            <span className="flex items-center gap-2.5 min-w-0">
              <Avatar person={lk.member(e.actorId)} size="sm" />
              <span className="min-w-0">
                <span className="block font-semibold truncate">{lk.member(e.actorId)?.name} {e.action}</span>
                <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{e.target}</span>
              </span>
            </span>
          ),
        },
        { key: "s", header: "Severity", render: (e) => <AuditSeverityBadge severity={e.severity} /> },
        { key: "c", header: "Category", hideBelow: "lg", render: (e) => <StatusBadge label={e.category[0] + e.category.slice(1).toLowerCase()} tone="neutral" /> },
        { key: "ip", header: "IP / location", hideBelow: "xl", render: (e) => <span className="truncate block font-mono text-[11px]">{e.ip} · {e.location}</span> },
        { key: "t", header: "When (UTC)", hideBelow: "md", render: (e) => formatDateTime(e.at) },
      ]}
    />
  );
}

/* ----------------------------------------------------------------------------
 * Invite form
 * ------------------------------------------------------------------------- */

export function InviteForm({ family }: { family: OrgFamily }) {
  const router = useRouter();
  const href = useOrgHref(family);
  const roles = useOrgConsoleStore((s) => s.roles);
  const teams = useOrgConsoleStore((s) => s.teams);
  const settings = useOrgConsoleStore((s) => s.settings);
  const invite = useOrgConsoleStore((s) => s.invite);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(settings.defaultRoleId);
  const [teamId, setTeamId] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const roleOptions = useMemo(
    () =>
      roles
        .filter((r) => r.id !== "role-owner")
        .map((r) => {
          const v = canAssignRole(family, r, roles);
          return { label: v.ok ? r.name : `${r.name} — locked (above your access)`, value: r.id, ok: v.ok };
        }),
    [roles, family]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const domain = email.split("@")[1]?.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    else if (!settings.allowedDomains.includes(domain)) next.email = `Only ${settings.allowedDomains.join(" or ")} addresses can be invited.`;
    if (!roleOptions.find((o) => o.value === roleId)?.ok) next.role = "You can't grant this role — it is above your own access.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    window.setTimeout(() => {
      const v = invite(family, { email, roleId, teamId: teamId || null, message: message.trim() });
      setSaving(false);
      if (!v.ok || !v.id) {
        setErrors({ email: v.reason ?? "Could not send" });
        return;
      }
      toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
      router.push(href(`invitations/${v.id}`));
    }, 500);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <AdminInput label="Work email" type="email" placeholder={`name@${settings.allowedDomains[0]}`} value={email} onChange={(e) => { setEmail(e.target.value); setErrors({}); }} error={errors.email} />
      </div>
      <AdminSelect label="Role" value={roleId} onChange={(e) => { setRoleId(e.target.value); setErrors({}); }} error={errors.role} options={roleOptions} />
      <AdminSelect label="Team (optional)" value={teamId} onChange={(e) => setTeamId(e.target.value)} options={[{ label: "No team yet", value: "" }, ...teams.map((t) => ({ label: t.name, value: t.id }))]} />
      <div className="md:col-span-2">
        <AdminTextarea label="Personal message" rows={3} placeholder="Optional note shown in the invitation email" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <AdminButton type="button" variant="outline" onClick={() => router.push(href("invitations"))}>Cancel</AdminButton>
        <AdminButton type="submit" isLoading={saving}><Mail className="w-3.5 h-3.5" /> Send invitation</AdminButton>
      </div>
    </form>
  );
}
