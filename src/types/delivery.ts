import { ProjectMode } from "./project";

export interface IndividualCheckIn {
  id: string;
  projectId: string;
  authorId: string;
  revisionOfId?: string;
  percent: number;
  accomplished: string;
  nextSteps: string;
  blockers: string[];
  projectedFinish: string;
  optionalEvidence?: string;
  downwardRevisionReason?: string;
  verificationStatus: "ACCEPTED" | "PENDING_VERIFICATION" | "REJECTED";
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  version: number;
}

export interface WorkItemReview {
  id: string;
  workItemId: string;
  projectId: string;
  reviewerId: string;
  submittedRevision: number;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  feedbackReason?: string;
  evidenceUrls?: string[];
  checklistPassed: boolean;
  createdAt: string;
}

export interface DeliveryChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface DeliveryAcceptanceRequest {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  mode: ProjectMode;
  requestedBy: string;
  requestedAt: string;
  scopeBaselineVersion?: number;
  lastCheckInPercent?: number;
  checklist: DeliveryChecklistItem[];
  waivers: {
    id: string;
    item: string;
    reason: string;
    waivedBy: string;
    waivedAt: string;
  }[];
  status: "PENDING" | "ACCEPTED" | "CHANGES_REQUESTED";
  decisionBy?: string;
  decisionAt?: string;
  decisionReason?: string;
}

