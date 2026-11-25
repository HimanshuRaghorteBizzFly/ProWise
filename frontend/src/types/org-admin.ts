import type { Project, User } from "@/types";
import type { OrgMemberResponse } from "@/types/api";

/** View-model rows for the organization owner/admin views. Data comes from the API (or from tests). */

export interface OrgMember extends OrgMemberResponse {
  /** The API member list does not return the role template yet. */
  roleLabel?: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  roleLabel: string;
  teamName?: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  invitedByName: string;
}

export interface TeamRow {
  id: string;
  name: string;
  description?: string;
  leadName: string;
  memberNames: string[];
  archived: boolean;
}

export interface PortfolioData {
  projects: Project[];
  users: User[];
  teams: { id: string; name: string }[];
}

export interface RepositoryRow {
  id: string;
  fullName: string;
  defaultBranch: string;
  syncStatus: "SYNCED" | "SYNCING" | "FAILED" | "DISCONNECTED";
  lastSuccessfulSync?: string;
  lastFailureReason?: string;
  linkedProjectKeys: string[];
}

export interface AuditRecord {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}
