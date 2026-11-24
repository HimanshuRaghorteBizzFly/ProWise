import { useState, useCallback, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api";
import type {
  ProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
  PersonRefDto,
} from "@/types/api";
import { toast } from "sonner";

export interface ProjectFilters {
  search?: string;
  owner?: string;
  team?: string;
  status?: string;
  mode?: string;
  archived?: boolean;
}

export function useProjectsApi(orgId: string, initialFilters?: ProjectFilters) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters ?? {});

  const fetchProjects = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = {
        q: filters.search,
        owner: filters.owner !== "ALL" ? filters.owner : undefined,
        team: filters.team !== "ALL" ? filters.team : undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        mode: filters.mode !== "ALL" ? filters.mode : undefined,
        include_archived: filters.archived,
        limit: 100,
      };
      const items: ProjectDto[] = [];
      let cursor: string | undefined;
      do {
        const page = await apiClient.projects(orgId, { ...query, cursor });
        items.push(...page.items);
        if (!page.has_more) break;
        if (!page.next_cursor) {
          throw new Error("The project API reported more results without a next cursor.");
        }
        cursor = page.next_cursor;
      } while (true);
      setProjects(items);
      setTotal(items.length);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load projects.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, filters]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (body: CreateProjectDto): Promise<ProjectDto | null> => {
    try {
      const created = await apiClient.createProject(orgId, body);
      toast.success("Project created successfully", {
        description: `Project [${created.key}] "${created.name}" is now active.`,
      });
      await fetchProjects();
      return created;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create project.";
      toast.error("Project creation failed", { description: msg });
      throw err;
    }
  };

  const updateProject = async (
    projectId: string,
    body: UpdateProjectDto
  ): Promise<ProjectDto | null> => {
    try {
      const updated = await apiClient.updateProject(orgId, projectId, body);
      toast.success("Project updated", {
        description: `Project "${updated.name}" details updated.`,
      });
      await fetchProjects();
      return updated;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update project.";
      toast.error("Update failed", { description: msg });
      throw err;
    }
  };

  return {
    projects,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: fetchProjects,
    createProject,
    updateProject,
  };
}

export function useProjectMembers(projectId: string | null, orgId: string) {
  const [members, setMembers] = useState<PersonRefDto[]>([]);
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!projectId || !orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.project(orgId, projectId);
      setProject(result);
      setMembers(result.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load project members.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (membershipId: string) => {
    if (!projectId || !project) return;
    try {
      const updated = await apiClient.updateProject(orgId, projectId, {
        member_membership_ids: [...new Set([...members.map((member) => member.membership_id), membershipId])],
        expected_version: project.version,
      });
      toast.success("Member added to project");
      setProject(updated);
      setMembers(updated.members);
      return updated;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add member.";
      toast.error("Could not add member", { description: msg });
      throw err;
    }
  };

  const removeMember = async (membershipId: string) => {
    if (!projectId || !project) return;
    try {
      const updated = await apiClient.updateProject(orgId, projectId, {
        member_membership_ids: members
          .filter((member) => member.membership_id !== membershipId)
          .map((member) => member.membership_id),
        expected_version: project.version,
      });
      toast.success("Member removed from project");
      setProject(updated);
      setMembers(updated.members);
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to remove member.";
      toast.error("Could not remove member", { description: msg });
      return false;
    }
  };

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    addMember,
    removeMember,
  };
}
