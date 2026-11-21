export * from "./useProjectsApi";
export * from "./ProjectFormModal";
export * from "./ProjectMembersModal";
export * from "./ProjectCard";
export * from "./useProgressApi";
export * from "./CheckInSubmissionModal";
export * from "./VerificationReviewModal";
export * from "./CheckInAuditTrail";
export * from "./useDeliveryApi";
export * from "./DeliveryAcceptanceModal";
export * from "./DeliveryReviewModal";
export * from "./ProjectClosureModal";
export * from "./BlockerManagementModal";

export interface ProjectsConfig {
  enabled: boolean;
  name: string;
}

export const projectsFeatureConfig: ProjectsConfig = {
  enabled: true,
  name: "projects",
};
