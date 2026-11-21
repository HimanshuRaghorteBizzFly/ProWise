import { useState, useCallback, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api";
import type {
  ProjectDto,
  CreateProjectRequestDto,
  UpdateProjectRequestDto,
  ProjectMemberDto,
  ProjectMemberRequestDto,
} from "@/types/api";
import { toast } from "sonner";

export interface ProjectFilters {
  search?: string;
  owner?: string;
  team?: string;
  health?: string;
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
      const res = await apiClient.projects(orgId, {
        search: filters.search,
        owner: filters.owner !== "ALL" ? filters.owner : undefined,
        team: filters.team !== "ALL" ? filters.team : undefined,
        health: filters.health !== "ALL" ? filters.health : undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        mode: filters.mode !== "ALL" ? filters.mode : undefined,
        archived: filters.archived,
      });
      setProjects(res.projects);
      setTotal(res.totalCount);
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

  const createProject = async (body: CreateProjectRequestDto): Promise<ProjectDto | null> => {
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
    body: UpdateProjectRequestDto
  ): Promise<ProjectDto | null> => {
    try {
      const updated = await apiClient.updateProject(projectId, body, orgId);
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

  const archiveProject = async (projectId: string, expectedVersion: number): Promise<boolean> => {
    try {
      await apiClient.archiveProject(projectId, expectedVersion, orgId);
      toast.success("Project archived", {
        description: "The project has been archived and changes are frozen.",
      });
      await fetchProjects();
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to archive project.";
      toast.error("Archive failed", { description: msg });
      return false;
    }
  };

  const restoreProject = async (projectId: string, expectedVersion: number): Promise<boolean> => {
    try {
      await apiClient.restoreProject(projectId, expectedVersion, orgId);
      toast.success("Project restored", {
        description: "The project has been restored to its previous lifecycle state.",
      });
      await fetchProjects();
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to restore project.";
      toast.error("Restore failed", { description: msg });
      return false;
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
    archiveProject,
    restoreProject,
  };
}

export function useProjectMembers(projectId: string | null, orgId: string) {
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchMembers = useCallback(async () => {
    if (!projectId || !orgId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.projectMembers(projectId, orgId);
      setMembers(res);
    } catch (err) {
      console.error("Failed to load project members", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (body: ProjectMemberRequestDto) => {
    if (!projectId) return;
    try {
      const added = await apiClient.addProjectMember(projectId, body, orgId);
      toast.success("Member added to project");
      await fetchMembers();
      return added;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add member.";
      toast.error("Could not add member", { description: msg });
      throw err;
    }
  };

  const removeMember = async (membershipId: string) => {
    if (!projectId) return;
    try {
      await apiClient.removeProjectMember(projectId, membershipId, orgId);
      toast.success("Member removed from project");
      await fetchMembers();
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
    refetch: fetchMembers,
    addMember,
    removeMember,
  };
}
