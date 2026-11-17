export type SystemRole =
  | "SUPER_ADMIN"
  | "PLATFORM_OPERATOR"
  | "ORGANIZATION_OWNER"
  | "ORGANIZATION_ADMIN"
  | "PROJECT_MANAGER"
  | "TEAM_LEAD"
  | "DEVELOPER"
  | "QA_REVIEWER"
  | "VIEWER";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  timezone: string;
  createdAt: string;
  role?: SystemRole;
}


export interface AuthSession {
  user: User;
  activeRole: SystemRole;
  activeOrgId?: string;
  token?: string;
}
