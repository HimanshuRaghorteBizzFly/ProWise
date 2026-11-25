import {
  SEEDED_AUDIT_LOGS,
  SEEDED_INVITATIONS,
  SEEDED_MEMBERSHIPS,
  SEEDED_NOTIFICATIONS,
  SEEDED_PROJECTS,
  SEEDED_REPOSITORIES,
  SEEDED_TEAMS,
  SEEDED_USERS,
} from "./mock-data";
import { FIXTURE_GRANTS } from "./permissions";
import type { AuditRecord, InvitationRow, OrgMember, PortfolioData, RepositoryRow, TeamRow } from "@/types/org-admin";
import type { Notification, Project, SystemRole, User } from "@/types";
import type { OrgMemberResponse, OrgRoleResponse } from "@/types/api";

/** Test-only data shaped like the API responses. Never imported by the app. */

export const ROLE_TEMPLATE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: "Super Admin",
  PLATFORM_OPERATOR: "Platform Operator",
  ORGANIZATION_OWNER: "Organization Owner",
  ORGANIZATION_ADMIN: "Organization Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  QA_REVIEWER: "QA / Reviewer",
  VIEWER: "Viewer / Stakeholder",
};


export function FIXTURE_MEMBERS(orgId: string): OrgMember[] {
  return SEEDED_MEMBERSHIPS.filter((membership) => membership.orgId === orgId).map((membership) => {
    const user = SEEDED_USERS.find((candidate) => candidate.id === membership.userId);
    return {
      id: membership.id,
      displayName: user?.name ?? "Unknown member",
      email: user?.email ?? "",
      status: membership.status,
      roleLabel: ROLE_TEMPLATE_LABELS[membership.role],
    };
  });
}

const TENANT_TEMPLATES: SystemRole[] = [
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "PROJECT_MANAGER",
  "TEAM_LEAD",
  "DEVELOPER",
  "QA_REVIEWER",
  "VIEWER",
];

export const FIXTURE_ROLES: OrgRoleResponse[] = [
  ...TENANT_TEMPLATES.map((role) => ({
    id: `role-${role.toLowerCase().replace(/_/g, "-")}`,
    name: ROLE_TEMPLATE_LABELS[role],
    template: true,
    version: 1,
    permissionKeys: Array.from(new Set(FIXTURE_GRANTS[role].map((grant) => grant.key))),
  })),
  {
    id: "role-custom-delivery-auditor",
    name: "Delivery Auditor",
    template: false,
    version: 3,
    permissionKeys: ["project.read", "report.export", "audit.read"],
  },
];

/** Invitation row for display. The protected token is deliberately not part of this type. */

export function FIXTURE_INVITATIONS(orgId: string): InvitationRow[] {
  return SEEDED_INVITATIONS.filter((invitation) => invitation.orgId === orgId).map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    roleLabel: ROLE_TEMPLATE_LABELS[invitation.role],
    teamName: SEEDED_TEAMS.find((team) => team.id === invitation.teamId)?.name,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    invitedByName: SEEDED_USERS.find((user) => user.id === invitation.invitedBy)?.name ?? "Unknown member",
  }));
}


export function FIXTURE_TEAMS(orgId: string): TeamRow[] {
  return SEEDED_TEAMS.filter((team) => team.orgId === orgId).map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    leadName: SEEDED_USERS.find((user) => user.id === team.leadId)?.name ?? "No lead",
    memberNames: team.memberIds.map((id) => SEEDED_USERS.find((user) => user.id === id)?.name ?? "Unknown member"),
    archived: Boolean(team.archived),
  }));
}


export function FIXTURE_PORTFOLIO(orgId: string): PortfolioData {
  return {
    projects: SEEDED_PROJECTS.filter((project) => project.orgId === orgId),
    users: SEEDED_USERS,
    teams: SEEDED_TEAMS.filter((team) => team.orgId === orgId).map((team) => ({ id: team.id, name: team.name })),
  };
}


export function FIXTURE_REPOSITORIES(orgId: string): RepositoryRow[] {
  return SEEDED_REPOSITORIES.filter((repository) => repository.orgId === orgId).map((repository) => ({
    id: repository.id,
    fullName: `${repository.owner}/${repository.name}`,
    defaultBranch: repository.defaultBranch,
    syncStatus: repository.syncStatus,
    lastSuccessfulSync: repository.lastSuccessfulSync,
    lastFailureReason: repository.lastFailureReason,
    linkedProjectKeys: repository.linkedProjectIds.map(
      (id) => SEEDED_PROJECTS.find((project) => project.id === id)?.key ?? id,
    ),
  }));
}

/**
 * Notifications for one member only. Seeded entries for that member are kept; a few typed samples
 * addressed to the same member are added so the screen is reviewable. Links stay inside `basePath`.
 */
export function FIXTURE_NOTIFICATIONS(orgId: string, userId: string, basePath: string): Notification[] {
  const seeded = SEEDED_NOTIFICATIONS.filter((item) => item.orgId === orgId && item.userId === userId);
  const samples: Notification[] = [
    {
      id: `sample-health-${userId}`,
      orgId,
      userId,
      category: "HEALTH_CHANGE",
      title: "EMR-200 is Delayed",
      message: "The approved target date has passed. Open Health & risks to see the recorded reasons.",
      targetUrl: `${basePath}/health`,
      read: false,
      createdAt: "2026-11-17T08:15:00Z",
    },
    {
      id: `sample-invite-${userId}`,
      orgId,
      userId,
      category: "ASSIGNMENT",
      title: "Invitation pending for clara.oswald@acmehealth.com",
      message: "The invitation expires on Nov 20. Resend is available once invitations ship.",
      targetUrl: `${basePath}/invitations`,
      read: true,
      createdAt: "2026-11-16T14:40:00Z",
    },
  ];
  return [...seeded.map((item) => ({ ...item, targetUrl: `${basePath}/dashboard` })), ...samples];
}


export function FIXTURE_AUDIT(orgId: string): AuditRecord[] {
  return SEEDED_AUDIT_LOGS.filter((entry) => entry.orgId === orgId).map((entry) => ({
    id: entry.id,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details,
    timestamp: entry.timestamp,
  }));
}
