"use client";

import { create } from "zustand";
import {
  AUDIT_EVENTS,
  AVAILABLE_REPOSITORIES,
  GITHUB_CONNECTION,
  INVITATIONS,
  MEMBERS,
  ORG_NOTIFICATIONS,
  ORG_NOW,
  ORG_PROJECTS,
  ORG_REPORTS,
  ORG_RISKS,
  ORG_SETTINGS,
  ORG_VIEWERS,
  PRIVACY_SETTINGS,
  REPOSITORIES,
  ROLES,
  TEAMS,
  type AuditCategory,
  type AuditEvent,
  type AvailableRepository,
  type GithubConnection,
  type Invitation,
  type Member,
  type MemberStatus,
  type OrgNotification,
  type OrgProject,
  type OrgReport,
  type OrgRisk,
  type OrgSettings,
  type PrivacySettings,
  type Repository,
  type RoleDef,
  type Team,
} from "@/mocks/org-console";
import { canAssignRole, canManageMember, validatePermissionChange, type OrgFamily, type Verdict } from "@/components/org-console/role-rules";
import { ROLE_HISTORY, type PermissionId, type RoleChange } from "@/mocks/org-console";

/**
 * In-memory store for the Org Owner and Org Admin workspaces.
 * Seeded from `src/mocks/org-console.ts`; resets on full page reload.
 * Every change writes an audit entry, and access rules are re-checked here.
 */

interface OrgConsoleState {
  settings: OrgSettings;
  privacy: PrivacySettings;
  members: Member[];
  invitations: Invitation[];
  teams: Team[];
  roles: RoleDef[];
  projects: OrgProject[];
  risks: OrgRisk[];
  github: GithubConnection;
  repositories: Repository[];
  availableRepos: AvailableRepository[];
  audit: AuditEvent[];
  notifications: OrgNotification[];
  reports: OrgReport[];
  pendingTransfer: { toMemberId: string; requestedAt: string } | null;
  roleHistory: RoleChange[];

  createRole: (family: OrgFamily, input: { name: string; description: string; basedOnId: string | null; permissions: PermissionId[] }) => Verdict & { id?: string };
  updateRolePermissions: (family: OrgFamily, roleId: string, permissions: PermissionId[], summary: string) => Verdict;
  changeMemberRole: (family: OrgFamily, memberId: string, roleId: string) => Verdict;
  setMemberStatus: (family: OrgFamily, memberId: string, status: MemberStatus) => Verdict;
  invite: (family: OrgFamily, input: { email: string; roleId: string; teamId: string | null; message: string }) => Verdict & { id?: string };
  resendInvite: (family: OrgFamily, id: string) => void;
  revokeInvite: (family: OrgFamily, id: string) => void;
  createTeam: (family: OrgFamily, input: { name: string; description: string; leadId: string; memberIds: string[] }) => Team;
  updateTeam: (family: OrgFamily, id: string, patch: { leadId?: string; memberIds?: string[]; description?: string }) => void;
  connectRepo: (family: OrgFamily, availableId: string, projectId: string | null) => Repository | null;
  syncRepo: (family: OrgFamily, id: string) => void;
  setRepoPaused: (family: OrgFamily, id: string, paused: boolean) => void;
  updateSettings: (patch: Partial<OrgSettings>) => void;
  updateRetention: (patch: Partial<Pick<PrivacySettings, "auditRetentionDays" | "activityRetentionDays" | "deletedMemberRetentionDays">>) => void;
  requestExport: (scope: string) => void;
  requestTransfer: (toMemberId: string) => void;
  cancelTransfer: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const actorOf = (family: OrgFamily) => ORG_VIEWERS[family].id;

function auditEntry(family: OrgFamily, action: string, target: string, category: AuditCategory, severity: AuditEvent["severity"] = "INFO", before?: string, after?: string): AuditEvent {
  return {
    id: `ae-new-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    actorId: actorOf(family),
    action,
    target,
    category,
    severity,
    at: ORG_NOW,
    ip: family === "owner" ? "81.2.69.160" : "103.21.58.14",
    location: family === "owner" ? "London, GB" : "Bengaluru, IN",
    device: "Chrome 131 · macOS",
    before,
    after,
  };
}

export const useOrgConsoleStore = create<OrgConsoleState>((set, get) => ({
  settings: ORG_SETTINGS,
  privacy: PRIVACY_SETTINGS,
  members: MEMBERS,
  invitations: INVITATIONS,
  teams: TEAMS,
  roles: ROLES,
  projects: ORG_PROJECTS,
  risks: ORG_RISKS,
  github: GITHUB_CONNECTION,
  repositories: REPOSITORIES,
  availableRepos: AVAILABLE_REPOSITORIES,
  audit: AUDIT_EVENTS,
  notifications: ORG_NOTIFICATIONS,
  reports: ORG_REPORTS,
  pendingTransfer: null,
  roleHistory: ROLE_HISTORY,

  createRole: (family, input) => {
    const { roles } = get();
    const name = input.name.trim();
    if (name.length < 3) return { ok: false, reason: "Role name needs at least 3 characters." };
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) return { ok: false, reason: "A role with this name already exists." };
    const permissions = Array.from(new Set(input.permissions));
    // New roles always start from nothing in the rules check: every switched-on permission must be grantable.
    const verdict = validatePermissionChange(family, null, [], permissions, roles);
    if (!verdict.ok) return verdict;
    const colors = ["#14B8A6", "#F97316", "#A855F7", "#0EA5E9", "#84CC16", "#E11D48"];
    const id = `role-custom-${Date.now()}`;
    const role: RoleDef = {
      id,
      name,
      description: input.description.trim() || "Custom role",
      color: colors[roles.length % colors.length],
      system: false,
      tier: 2,
      permissions,
      createdAt: ORG_NOW.slice(0, 10),
      createdById: actorOf(family),
    };
    const based = roles.find((r) => r.id === input.basedOnId);
    set((s) => ({
      roles: [...s.roles, role],
      roleHistory: [
        { id: `rh-new-${Date.now()}`, roleId: id, actorId: actorOf(family), at: ORG_NOW, summary: based ? `Created role based on ${based.name}` : "Created role", added: permissions, removed: [] },
        ...s.roleHistory,
      ],
      audit: [auditEntry(family, "created custom role", name, "ROLE", "WARNING"), ...s.audit],
    }));
    return { ok: true, id };
  },

  updateRolePermissions: (family, roleId, permissions, summary) => {
    const { roles } = get();
    const role = roles.find((r) => r.id === roleId);
    if (!role) return { ok: false, reason: "Role not found." };
    const next = Array.from(new Set(permissions));
    const verdict = validatePermissionChange(family, role, role.permissions, next, roles);
    if (!verdict.ok) return verdict;
    const added = next.filter((p) => !role.permissions.includes(p));
    const removed = role.permissions.filter((p) => !next.includes(p));
    if (added.length + removed.length === 0) return { ok: false, reason: "Nothing changed." };
    set((s) => ({
      roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions: next } : r)),
      roleHistory: [{ id: `rh-new-${Date.now()}`, roleId, actorId: actorOf(family), at: ORG_NOW, summary, added, removed }, ...s.roleHistory],
      audit: [auditEntry(family, "changed role permissions", `${role.name}: +${added.length} / −${removed.length}`, "ROLE", "WARNING"), ...s.audit],
    }));
    return { ok: true };
  },

  changeMemberRole: (family, memberId, roleId) => {
    const { members, roles } = get();
    const member = members.find((m) => m.id === memberId);
    const role = roles.find((r) => r.id === roleId);
    if (!member || !role) return { ok: false, reason: "Member or role not found." };
    const manage = canManageMember(family, member, actorOf(family), roles);
    if (!manage.ok) return manage;
    const assign = canAssignRole(family, role, roles);
    if (!assign.ok) return assign;
    if (role.id === "role-owner") return { ok: false, reason: "Use Transfer ownership to make someone the owner." };
    const before = roles.find((r) => r.id === member.roleId)?.name;
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? { ...m, roleId } : m)),
      audit: [auditEntry(family, "changed role", `${member.name} → ${role.name}`, "ROLE", "WARNING", before, role.name), ...s.audit],
    }));
    return { ok: true };
  },

  setMemberStatus: (family, memberId, status) => {
    const { members, roles } = get();
    const member = members.find((m) => m.id === memberId);
    if (!member) return { ok: false, reason: "Member not found." };
    const manage = canManageMember(family, member, actorOf(family), roles);
    if (!manage.ok) return manage;
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? { ...m, status } : m)),
      audit: [auditEntry(family, status === "ACTIVE" ? "re-enabled member" : "disabled member", member.name, "SECURITY", status === "ACTIVE" ? "INFO" : "CRITICAL", member.status, status), ...s.audit],
    }));
    return { ok: true };
  },

  invite: (family, input) => {
    const { roles, members, invitations } = get();
    const role = roles.find((r) => r.id === input.roleId);
    if (!role) return { ok: false, reason: "Choose a role." };
    const verdict = canAssignRole(family, role, roles);
    if (!verdict.ok) return verdict;
    if (role.id === "role-owner") return { ok: false, reason: "Invitees cannot start as owner." };
    const email = input.email.trim().toLowerCase();
    if (members.some((m) => m.email === email)) return { ok: false, reason: "This person is already a member." };
    if (invitations.some((i) => i.email === email && i.status === "PENDING")) return { ok: false, reason: "An invitation is already pending for this email." };
    const id = `inv-new-${Date.now()}`;
    const inv: Invitation = {
      id,
      email,
      roleId: role.id,
      teamId: input.teamId,
      invitedById: actorOf(family),
      sentAt: ORG_NOW,
      expiresAt: "2026-11-27T10:30:00Z",
      status: "PENDING",
      resentCount: 0,
      message: input.message,
    };
    set((s) => ({ invitations: [inv, ...s.invitations], audit: [auditEntry(family, "invited a member", `${email} as ${role.name}`, "MEMBER"), ...s.audit] }));
    return { ok: true, id };
  },

  resendInvite: (family, id) =>
    set((s) => {
      const inv = s.invitations.find((i) => i.id === id);
      const role = s.roles.find((r) => r.id === inv?.roleId);
      if (!inv || !role || !canAssignRole(family, role, s.roles).ok) return s;
      return {
        invitations: s.invitations.map((i) => (i.id === id ? { ...i, status: "PENDING", resentCount: i.resentCount + 1, sentAt: ORG_NOW, expiresAt: "2026-11-27T10:30:00Z" } : i)),
        audit: inv ? [auditEntry(family, "resent invitation", inv.email, "MEMBER"), ...s.audit] : s.audit,
      };
    }),

  revokeInvite: (family, id) =>
    set((s) => {
      const inv = s.invitations.find((i) => i.id === id);
      const role = s.roles.find((r) => r.id === inv?.roleId);
      if (!inv || !role || !canAssignRole(family, role, s.roles).ok) return s;
      return {
        invitations: s.invitations.map((i) => (i.id === id ? { ...i, status: "REVOKED" } : i)),
        audit: inv ? [auditEntry(family, "revoked invitation", inv.email, "MEMBER"), ...s.audit] : s.audit,
      };
    }),

  createTeam: (family, input) => {
    const colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];
    const team: Team = {
      id: `tm-new-${Date.now()}`,
      name: input.name,
      description: input.description,
      leadId: input.leadId,
      memberIds: Array.from(new Set([input.leadId, ...input.memberIds])),
      color: colors[get().teams.length % colors.length],
      createdAt: ORG_NOW.slice(0, 10),
    };
    set((s) => ({
      teams: [...s.teams, team],
      members: s.members.map((m) => (team.memberIds.includes(m.id) ? { ...m, teamIds: Array.from(new Set([...m.teamIds, team.id])) } : m)),
      audit: [auditEntry(family, "created team", team.name, "MEMBER"), ...s.audit],
    }));
    return team;
  },

  updateTeam: (family, id, patch) =>
    set((s) => {
      const team = s.teams.find((t) => t.id === id);
      if (!team) return s;
      const memberIds = patch.memberIds ? Array.from(new Set([patch.leadId ?? team.leadId, ...patch.memberIds])) : team.memberIds;
      return {
        teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch, memberIds } : t)),
        members: s.members.map((m) => {
          const inTeam = memberIds.includes(m.id);
          const had = m.teamIds.includes(id);
          if (inTeam && !had) return { ...m, teamIds: [...m.teamIds, id] };
          if (!inTeam && had) return { ...m, teamIds: m.teamIds.filter((x) => x !== id) };
          return m;
        }),
        audit: [auditEntry(family, "updated team", team.name, "MEMBER"), ...s.audit],
      };
    }),

  connectRepo: (family, availableId, projectId) => {
    const avail = get().availableRepos.find((a) => a.id === availableId);
    if (!avail) return null;
    const repo: Repository = {
      id: `rp-new-${Date.now()}`,
      fullName: avail.fullName,
      projectId,
      defaultBranch: "main",
      visibility: "private",
      status: "SYNCING",
      lastSyncAt: ORG_NOW,
      connectedAt: ORG_NOW,
      connectedById: actorOf(family),
      openPullRequests: 0,
      commits7d: 0,
    };
    set((s) => ({
      repositories: [repo, ...s.repositories],
      availableRepos: s.availableRepos.filter((a) => a.id !== availableId),
      projects: projectId ? s.projects.map((p) => (p.id === projectId ? { ...p, repoIds: [...p.repoIds, repo.id] } : p)) : s.projects,
      audit: [auditEntry(family, "connected repository", avail.fullName, "INTEGRATION"), ...s.audit],
    }));
    return repo;
  },

  syncRepo: (family, id) =>
    set((s) => {
      const repo = s.repositories.find((r) => r.id === id);
      return {
        repositories: s.repositories.map((r) => (r.id === id ? { ...r, status: "HEALTHY", lastSyncAt: ORG_NOW, error: undefined } : r)),
        audit: repo ? [auditEntry(family, "re-synced repository", repo.fullName, "INTEGRATION"), ...s.audit] : s.audit,
      };
    }),

  setRepoPaused: (family, id, paused) =>
    set((s) => {
      const repo = s.repositories.find((r) => r.id === id);
      return {
        repositories: s.repositories.map((r) => (r.id === id ? { ...r, status: paused ? "PAUSED" : "SYNCING", error: paused ? "Paused manually." : undefined } : r)),
        audit: repo ? [auditEntry(family, paused ? "paused repository sync" : "resumed repository sync", repo.fullName, "INTEGRATION", "WARNING"), ...s.audit] : s.audit,
      };
    }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, audit: [auditEntry("owner", "updated organization settings", Object.keys(patch).join(", "), "SETTINGS", "WARNING"), ...s.audit] })),

  updateRetention: (patch) =>
    set((s) => ({ privacy: { ...s.privacy, ...patch }, audit: [auditEntry("owner", "changed data retention", Object.keys(patch).join(", "), "SETTINGS", "WARNING"), ...s.audit] })),

  requestExport: (scope) =>
    set((s) => ({
      privacy: {
        ...s.privacy,
        exportRequests: [{ id: `ex-new-${Date.now()}`, requestedById: actorOf("owner"), scope, requestedAt: ORG_NOW, status: "PROCESSING" }, ...s.privacy.exportRequests],
      },
      audit: [auditEntry("owner", "requested data export", scope, "SECURITY", "WARNING"), ...s.audit],
    })),

  requestTransfer: (toMemberId) =>
    set((s) => ({
      pendingTransfer: { toMemberId, requestedAt: ORG_NOW },
      audit: [auditEntry("owner", "started ownership transfer", s.members.find((m) => m.id === toMemberId)?.name ?? toMemberId, "SECURITY", "CRITICAL"), ...s.audit],
    })),

  cancelTransfer: () => set((s) => ({ pendingTransfer: null, audit: [auditEntry("owner", "cancelled ownership transfer", "Organization", "SECURITY", "WARNING"), ...s.audit] })),

  markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
}));
