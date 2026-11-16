import { INITIAL_PROJECTS, INITIAL_ORGANIZATIONS, INITIAL_USERS, INITIAL_WORK_ITEMS } from "./mock-data";
import { Project, Organization, User, WorkItem } from "@/types";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  projects: {
    async list(orgId?: string): Promise<Project[]> {
      await delay();
      if (!orgId) return INITIAL_PROJECTS;
      return INITIAL_PROJECTS.filter((p: Project) => p.orgId === orgId);
    },
    async getById(id: string): Promise<Project | undefined> {
      await delay();
      return INITIAL_PROJECTS.find((p: Project) => p.id === id);
    },
  },
  organizations: {
    async list(): Promise<Organization[]> {
      await delay();
      return INITIAL_ORGANIZATIONS;
    },
    async getById(id: string): Promise<Organization | undefined> {
      await delay();
      return INITIAL_ORGANIZATIONS.find((o: Organization) => o.id === id);
    },
  },
  users: {
    async list(): Promise<User[]> {
      await delay();
      return INITIAL_USERS;
    },
  },
  workItems: {
    async listByProject(projectId: string): Promise<WorkItem[]> {
      await delay();
      return INITIAL_WORK_ITEMS.filter((w: WorkItem) => w.projectId === projectId);
    },
  },

};
