import { SystemRole } from "./auth";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  timezone: string;
  workCalendar: {
    workDays: number[];
    dailyHours: number;
    holidays: string[];
  };
  createdAt: string;
  plan: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
}

export interface OrgMembership {
  id: string;
  orgId: string;
  userId: string;
  role: SystemRole;
  teamId?: string;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  invitedAt?: string;
  joinedAt?: string;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  leadId: string;
  memberIds: string[];
  description?: string;
  archived?: boolean;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: SystemRole;
  teamId?: string;
  token: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  invitedBy: string;
}

