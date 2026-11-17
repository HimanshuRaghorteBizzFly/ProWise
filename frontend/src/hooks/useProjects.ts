import { useProjectStore } from "@/store/project-store";

export function useProjects(orgId?: string) {
  const {
    projects,
    workItems,
    checkIns,
    baselines,
    snapshots,
    reviews,
    acceptanceRequests,
    repositories,
    gitEvents,
    activeProjectId,
    setActiveProject,
    createProject,
    updateProject,
    createWorkItem,
    updateWorkItem,
    submitCheckIn,
    verifyCheckIn,
    submitWorkItemReview,
    createScopeBaseline,
    requestDeliveryReview,
    acceptDelivery,
    transitionProjectMode,
  } = useProjectStore();

  const filteredProjects = orgId
    ? projects.filter((p) => p.orgId === orgId)
    : projects;

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return {
    projects: filteredProjects,
    activeProject,
    workItems,
    checkIns,
    baselines,
    snapshots,
    reviews,
    acceptanceRequests,
    repositories,
    gitEvents,
    setActiveProject,
    createProject,
    updateProject,
    createWorkItem,
    updateWorkItem,
    submitCheckIn,
    verifyCheckIn,
    submitWorkItemReview,
    createScopeBaseline,
    requestDeliveryReview,
    acceptDelivery,
    transitionProjectMode,
  };
}

