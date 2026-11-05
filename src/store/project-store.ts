import { create } from "zustand";
import {
  Project,
  WorkItem,
  ScopeBaseline,
  ProgressSnapshot,
  IndividualCheckIn,
  Repository,
  GitEvent,
  Notification,
  SupportTicket,
  PlatformIncident,
  WebhookLog,
  AuditLogEntry,
  DeliveryAcceptanceRequest,
  WorkItemReview,
  ProjectMode,

  ProjectLifecycle,
  WorkItemState,
  Priority,
} from "@/types";
import {
  SEEDED_PROJECTS,
  SEEDED_WORK_ITEMS,
  SEEDED_BASELINES,
  SEEDED_SNAPSHOTS,
  SEEDED_CHECKINS,
  SEEDED_REPOSITORIES,
  SEEDED_GIT_EVENTS,
  SEEDED_NOTIFICATIONS,
  SEEDED_SUPPORT_TICKETS,
  SEEDED_INCIDENTS,
  SEEDED_WEBHOOK_LOGS,
  SEEDED_AUDIT_LOGS,
  SEEDED_ACCEPTANCE_REQUESTS,
} from "@/lib/mock-data";
import { calculateStructuredProgress } from "@/lib/progress";
import { evaluateProjectHealth } from "@/lib/health";

interface ProjectStoreState {
  projects: Project[];
  workItems: WorkItem[];
  baselines: ScopeBaseline[];
  snapshots: ProgressSnapshot[];
  checkIns: IndividualCheckIn[];
  repositories: Repository[];
  gitEvents: GitEvent[];
  notifications: Notification[];
  supportTickets: SupportTicket[];
  incidents: PlatformIncident[];
  webhookLogs: WebhookLog[];
  auditLogs: AuditLogEntry[];
  acceptanceRequests: DeliveryAcceptanceRequest[];
  reviews: WorkItemReview[];
  activeProjectId?: string;

  // Actions
  setActiveProject: (id: string) => void;
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => void;
  verifyCheckIn: (checkInId: string, status: "ACCEPTED" | "REJECTED", actorId: string) => void;
  submitWorkItemReview: (review: Omit<WorkItemReview, "id" | "createdAt">) => void;
  createScopeBaseline: (baseline: any) => void;
  requestDeliveryReview: (projectId: string, actorId: string) => void;
  acceptDelivery: (requestId: string, actorId: string) => void;
  transitionProjectMode: (projectId: string, toMode: ProjectMode, actorId: string, reason: string) => void;
  createProject: (newProject: Omit<Project, "id" | "createdAt" | "version" | "lastProgressPercent" | "lastProgressMethod" | "health" | "healthReasons">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateProjectLifecycle: (id: string, lifecycle: ProjectLifecycle, reason?: string) => void;
  archiveProject: (id: string) => void;
  restoreProject: (id: string) => void;

  // Individual Mode
  submitCheckIn: (
    projectId: string,
    authorId: string,
    percent: number,
    accomplished: string,
    nextSteps: string,
    blockers: string[],
    projectedFinish: string,
    evidence?: string,
    downwardReason?: string
  ) => { success: boolean; error?: string };

  // Structured Mode & Work Items
  createWorkItem: (item: Omit<WorkItem, "id" | "createdAt" | "updatedAt" | "version" | "currentRevision">) => WorkItem;
  updateWorkItemState: (id: string, newState: WorkItemState, actorId: string) => void;
  reopenWorkItem: (id: string, reason: string, actorId: string) => void;
  submitWorkItemForReview: (id: string, actorId: string) => void;
  reviewWorkItem: (
    workItemId: string,
    reviewerId: string,
    decision: "APPROVED" | "CHANGES_REQUESTED",
    feedbackReason?: string,
    inspectedRevision?: number
  ) => { success: boolean; conflict?: boolean; error?: string };
  addBlocker: (workItemId: string, reason: string, severity: Priority, ownerId: string) => void;
  resolveBlocker: (workItemId: string, blockerId: string) => void;

  // Scope baseline changes (e.g. Test Scenario: add 25 points to CRM-100)
  approveScopeAddition: (
    projectId: string,
    newLeafTitle: string,
    additionalWeight: number,
    reason: string,
    approvedBy: string
  ) => void;

  // Delivery Acceptance
  requestDeliveryAcceptance: (projectId: string, actorId: string) => DeliveryAcceptanceRequest;
  decideDeliveryAcceptance: (requestId: string, decision: "ACCEPTED" | "CHANGES_REQUESTED", actorId: string, reason?: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Support & Platform
  createSupportTicket: (ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt">) => void;
  updateTicketStatus: (ticketId: string, status: SupportTicket["status"]) => void;
  retryWebhookDelivery: (deliveryId: string) => void;

  // Reset to initial deterministic state
  resetToInitialFixtures: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: SEEDED_PROJECTS,
  workItems: SEEDED_WORK_ITEMS,
  baselines: SEEDED_BASELINES,
  snapshots: SEEDED_SNAPSHOTS,
  checkIns: SEEDED_CHECKINS,
  repositories: SEEDED_REPOSITORIES,
  gitEvents: SEEDED_GIT_EVENTS,
  notifications: SEEDED_NOTIFICATIONS,
  supportTickets: SEEDED_SUPPORT_TICKETS,
  incidents: SEEDED_INCIDENTS,
  webhookLogs: SEEDED_WEBHOOK_LOGS,
  auditLogs: SEEDED_AUDIT_LOGS,
  acceptanceRequests: SEEDED_ACCEPTANCE_REQUESTS,
  reviews: [],
  activeProjectId: undefined,

  setActiveProject: (id) => set({ activeProjectId: id }),
  updateWorkItem: (id, updates) =>
    set((state) => ({
      workItems: state.workItems.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w)),
    })),
  verifyCheckIn: (checkInId, status, actorId) =>
    set((state) => ({
      checkIns: state.checkIns.map((c) =>
        c.id === checkInId
          ? {
              ...c,
              verificationStatus: status,
              verifiedBy: actorId,
              verifiedAt: new Date().toISOString(),
            }
          : c
      ),
    })),
  submitWorkItemReview: (reviewData) =>
    set((state) => {
      const review: WorkItemReview = {
        ...reviewData,
        id: `rev-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      return { reviews: [review, ...state.reviews] };
    }),
  createScopeBaseline: (b) =>
    set((state) => ({
      baselines: [b, ...state.baselines],
    })),
  requestDeliveryReview: (projectId, actorId) => {
    get().requestDeliveryAcceptance(projectId, actorId);
  },
  acceptDelivery: (requestId, actorId) => {
    get().decideDeliveryAcceptance(requestId, "ACCEPTED", actorId);
  },
  transitionProjectMode: (projectId, toMode, actorId, reason) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, mode: toMode, version: p.version + 1 } : p
      ),
    }));
  },


  createProject: (newProjectData) => {
    const id = `proj-${Date.now()}`;
    const project: Project = {
      ...newProjectData,
      id,
      version: 1,
      lastProgressPercent: newProjectData.mode === "INDIVIDUAL" ? -1 : 0,
      lastProgressMethod: newProjectData.mode === "INDIVIDUAL" ? "NOT_REPORTED" : "CALCULATED_BASELINE",
      health: "ON_TRACK",
      healthReasons: ["Project newly created with baseline schedule."],
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      projects: [project, ...state.projects],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          orgId: project.orgId,
          actorEmail: "manager@prowise.io",
          actorRole: "PROJECT_MANAGER",
          action: "PROJECT_CREATED",
          targetType: "PROJECT",
          targetId: project.id,
          details: `Created project ${project.name} (${project.key}) in ${project.mode} mode.`,
          timestamp: new Date().toISOString(),
        },
        ...state.auditLogs,
      ],
    }));

    return project;
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  updateProjectLifecycle: (id, lifecycle, reason) => {
    set((state) => {
      const project = state.projects.find((p) => p.id === id);
      if (!project) return state;

      const updatedProjects = state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              lifecycle,
              closedAt: lifecycle === "CLOSED" ? new Date().toISOString() : p.closedAt,
              closureReason: reason || p.closureReason,
            }
          : p
      );

      return {
        projects: updatedProjects,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            orgId: project.orgId,
            actorEmail: "manager@prowise.io",
            actorRole: "PROJECT_MANAGER",
            action: `PROJECT_LIFECYCLE_${lifecycle}`,
            targetType: "PROJECT",
            targetId: project.id,
            details: `Lifecycle changed to ${lifecycle}. Reason: ${reason || "User action"}`,
            timestamp: new Date().toISOString(),
          },
          ...state.auditLogs,
        ],
      };
    });
  },

  archiveProject: (id) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, archived: true } : p)),
    }));
  },

  restoreProject: (id) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, archived: false } : p)),
    }));
  },

  submitCheckIn: (
    projectId,
    authorId,
    percent,
    accomplished,
    nextSteps,
    blockers,
    projectedFinish,
    evidence,
    downwardReason
  ) => {
    const { projects, checkIns } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return { success: false, error: "Project not found" };

    const lastCheckin = checkIns
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.version - a.version)[0];

    if (lastCheckin && percent < lastCheckin.percent && (!downwardReason || downwardReason.trim().length < 5)) {
      return {
        success: false,
        error: "A downward revision in progress requires a clear explanatory reason.",
      };
    }

    const newVersion = (lastCheckin?.version || 0) + 1;
    const newCheckIn: IndividualCheckIn = {
      id: `chk-${Date.now()}`,
      projectId,
      authorId,
      revisionOfId: lastCheckin?.id,
      percent,
      accomplished,
      nextSteps,
      blockers,
      projectedFinish,
      optionalEvidence: evidence,
      downwardRevisionReason: downwardReason,
      verificationStatus: "ACCEPTED",
      createdAt: new Date().toISOString(),
      version: newVersion,
    };

    const newSnapshot: ProgressSnapshot = {
      id: `snap-${Date.now()}`,
      projectId,
      instant: new Date().toISOString(),
      method: "DEVELOPER_REPORTED",
      value: percent,
      cause: `Check-in v${newVersion} submitted by developer (${percent}%).`,
    };

    set((state) => ({
      checkIns: [newCheckIn, ...state.checkIns],
      snapshots: [...state.snapshots, newSnapshot],
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              lastProgressPercent: percent,
              lastProgressMethod: "DEVELOPER_REPORTED",
              lastReportedAt: newCheckIn.createdAt,
              deliveryReviewRequested: percent === 100,
            }
          : p
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          orgId: project.orgId,
          userId: project.projectManagerId,
          category: "CHECK_IN_DUE",
          title: `Check-in submitted: ${project.key}`,
          message: `Developer reported ${percent}% progress. Accomplished: ${accomplished.slice(0, 80)}...`,
          targetUrl: `/org/${project.orgId}/manager`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...state.notifications,
      ],
    }));

    return { success: true };
  },

  createWorkItem: (newItemData) => {
    const id = `wi-${Date.now()}`;
    const workItem: WorkItem = {
      ...newItemData,
      id,
      version: 1,
      currentRevision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      workItems: [...state.workItems, workItem],
    }));

    return workItem;
  },

  updateWorkItemState: (id, newState, actorId) => {
    set((state) => {
      const item = state.workItems.find((w) => w.id === id);
      if (!item) return state;

      const updatedItems = state.workItems.map((w) =>
        w.id === id
          ? {
              ...w,
              state: newState,
              currentRevision: w.currentRevision + 1,
              updatedAt: new Date().toISOString(),
            }
          : w
      );

      // Re-evaluate progress for structured project
      const project = state.projects.find((p) => p.id === item.projectId);
      let updatedProjects = state.projects;
      let newSnapshots = state.snapshots;

      if (project && project.mode === "STRUCTURED" && project.activeBaselineId) {
        const baseline = state.baselines.find((b) => b.id === project.activeBaselineId);
        if (baseline) {
          const calc = calculateStructuredProgress(baseline, updatedItems);
          updatedProjects = state.projects.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  lastProgressPercent: calc.percentage,
                  lastProgressMethod: "CALCULATED_BASELINE",
                  lastReportedAt: new Date().toISOString(),
                }
              : p
          );

          newSnapshots = [
            ...state.snapshots,
            {
              id: `snap-${Date.now()}`,
              projectId: project.id,
              instant: new Date().toISOString(),
              method: "CALCULATED_BASELINE",
              value: calc.percentage,
              numerator: calc.numerator,
              denominator: calc.denominator,
              baselineId: baseline.id,
              baselineVersion: baseline.version,
              cause: `Work item ${item.key} transitioned to ${newState}.`,
            },
          ];
        }
      }

      return {
        workItems: updatedItems,
        projects: updatedProjects,
        snapshots: newSnapshots,
      };
    });
  },

  reopenWorkItem: (id, reason, actorId) => {
    set((state) => {
      const item = state.workItems.find((w) => w.id === id);
      if (!item) return state;

      // When reopened, move to IN_PROGRESS. It immediately loses completion credit!
      const updatedItems = state.workItems.map((w) =>
        w.id === id
          ? {
              ...w,
              state: "IN_PROGRESS" as WorkItemState,
              currentRevision: w.currentRevision + 1,
              updatedAt: new Date().toISOString(),
            }
          : w
      );

      const project = state.projects.find((p) => p.id === item.projectId);
      let updatedProjects = state.projects;
      let newSnapshots = state.snapshots;

      if (project && project.mode === "STRUCTURED" && project.activeBaselineId) {
        const baseline = state.baselines.find((b) => b.id === project.activeBaselineId);
        if (baseline) {
          const calc = calculateStructuredProgress(baseline, updatedItems);
          updatedProjects = state.projects.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  lastProgressPercent: calc.percentage,
                  lastProgressMethod: "CALCULATED_BASELINE",
                  lastReportedAt: new Date().toISOString(),
                }
              : p
          );

          newSnapshots = [
            ...state.snapshots,
            {
              id: `snap-${Date.now()}`,
              projectId: project.id,
              instant: new Date().toISOString(),
              method: "CALCULATED_BASELINE",
              value: calc.percentage,
              numerator: calc.numerator,
              denominator: calc.denominator,
              baselineId: baseline.id,
              baselineVersion: baseline.version,
              cause: `Reopened ${item.key} (${reason}). Completion credit revoked.`,
            },
          ];
        }
      }

      return {
        workItems: updatedItems,
        projects: updatedProjects,
        snapshots: newSnapshots,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            orgId: item.orgId,
            actorEmail: "lead@prowise.io",
            actorRole: "TEAM_LEAD",
            action: "WORK_ITEM_REOPENED",
            targetType: "WORK_ITEM",
            targetId: item.id,
            details: `Reopened ${item.key}. Reason: ${reason}`,
            timestamp: new Date().toISOString(),
          },
          ...state.auditLogs,
        ],
      };
    });
  },

  submitWorkItemForReview: (id, actorId) => {
    set((state) => {
      const item = state.workItems.find((w) => w.id === id);
      if (!item) return state;

      const submittedRevision = item.currentRevision;
      const updatedItems = state.workItems.map((w) =>
        w.id === id
          ? {
              ...w,
              state: "IN_REVIEW" as WorkItemState,
              submittedRevision,
              updatedAt: new Date().toISOString(),
            }
          : w
      );

      return {
        workItems: updatedItems,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            orgId: item.orgId,
            userId: item.reviewerId || "usr-reviewer",
            category: "REVIEW_REQUEST",
            title: `Review Requested: ${item.key}`,
            message: `Work revision ${submittedRevision} of ${item.title} has been submitted for your inspection.`,
            targetUrl: `/org/${item.orgId}/reviewer`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...state.notifications,
        ],
      };
    });
  },

  reviewWorkItem: (workItemId, reviewerId, decision, feedbackReason, inspectedRevision) => {
    const { workItems, baselines, projects, snapshots } = get();
    const item = workItems.find((w) => w.id === workItemId);
    if (!item) return { success: false, error: "Work item not found." };

    // Stale Review Check (Blueprint V1.1 / worked fixture):
    // If the inspected revision is older than the item's current revision, return 409 conflict!
    const targetRev = inspectedRevision !== undefined ? inspectedRevision : item.submittedRevision || item.currentRevision;
    if (targetRev < item.currentRevision) {
      return {
        success: false,
        conflict: true,
        error: `STALE_REVIEW: Reviewer submitted decision on revision ${targetRev}, but developer has already updated to revision ${item.currentRevision}. Refresh required.`,
      };
    }

    if (decision === "CHANGES_REQUESTED" && (!feedbackReason || feedbackReason.trim().length < 5)) {
      return {
        success: false,
        error: "A mandatory explanation is required when requesting changes.",
      };
    }

    const newState: WorkItemState = decision === "APPROVED" ? "DONE" : "IN_PROGRESS";

    const updatedItems = workItems.map((w) =>
      w.id === workItemId
        ? {
            ...w,
            state: newState,
            updatedAt: new Date().toISOString(),
          }
        : w
    );

    const project = projects.find((p) => p.id === item.projectId);
    let updatedProjects = projects;
    let newSnapshots = snapshots;

    if (project && project.mode === "STRUCTURED" && project.activeBaselineId) {
      const baseline = baselines.find((b) => b.id === project.activeBaselineId);
      if (baseline) {
        const calc = calculateStructuredProgress(baseline, updatedItems);
        updatedProjects = projects.map((p) =>
          p.id === project.id
            ? {
                ...p,
                lastProgressPercent: calc.percentage,
                lastProgressMethod: "CALCULATED_BASELINE",
                lastReportedAt: new Date().toISOString(),
              }
            : p
        );

        newSnapshots = [
          ...snapshots,
          {
            id: `snap-${Date.now()}`,
            projectId: project.id,
            instant: new Date().toISOString(),
            method: "CALCULATED_BASELINE",
            value: calc.percentage,
            numerator: calc.numerator,
            denominator: calc.denominator,
            baselineId: baseline.id,
            baselineVersion: baseline.version,
            cause: `Reviewer ${decision}: ${item.key} (rev ${targetRev}). New progress: ${calc.displayText}.`,
          },
        ];
      }
    }

    set({
      workItems: updatedItems,
      projects: updatedProjects,
      snapshots: newSnapshots,
    });

    return { success: true };
  },

  addBlocker: (workItemId, reason, severity, ownerId) => {
    set((state) => {
      const item = state.workItems.find((w) => w.id === workItemId);
      if (!item) return state;

      const newBlocker = {
        id: `blk-${Date.now()}`,
        reason,
        severity,
        ownerId,
        createdAt: new Date().toISOString(),
      };

      const updatedItems = state.workItems.map((w) =>
        w.id === workItemId
          ? {
              ...w,
              isBlocked: true,
              blockers: [...(w.blockers || []), newBlocker],
            }
          : w
      );

      return {
        workItems: updatedItems,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            orgId: item.orgId,
            userId: ownerId,
            category: "BLOCKER",
            title: `Blocker Raised: ${item.key}`,
            message: `[${severity}] ${reason}`,
            targetUrl: `/org/${item.orgId}/lead`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...state.notifications,
        ],
      };
    });
  },

  resolveBlocker: (workItemId, blockerId) => {
    set((state) => {
      const updatedItems = state.workItems.map((w) => {
        if (w.id !== workItemId) return w;
        const updatedBlockers = (w.blockers || []).map((b) =>
          b.id === blockerId ? { ...b, resolvedAt: new Date().toISOString() } : b
        );
        const hasUnresolved = updatedBlockers.some((b) => !b.resolvedAt);
        return {
          ...w,
          isBlocked: hasUnresolved,
          blockers: updatedBlockers,
        };
      });

      return { workItems: updatedItems };
    });
  },

  // Test Scenario AS-08: With 50 accepted points of 100, approve another 25 points.
  // New snapshot is 40% at 50/125.
  approveScopeAddition: (projectId, newLeafTitle, additionalWeight, reason, approvedBy) => {
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project || !project.activeBaselineId) return state;

      const currentBaseline = state.baselines.find((b) => b.id === project.activeBaselineId);
      if (!currentBaseline) return state;

      const newWorkItem: WorkItem = {
        id: `wi-scope-add-${Date.now()}`,
        projectId,
        orgId: project.orgId,
        type: "TASK",
        key: `${project.key}-${100 + currentBaseline.leaves.length + 1}`,
        title: newLeafTitle,
        description: `Approved scope addition: ${reason}`,
        collaboratorIds: [],
        state: "TODO",
        isBlocked: false,
        blockers: [],
        weight: additionalWeight,
        weightUnit: currentBaseline.unit,
        criteria: "Full test and criteria verification required.",
        criteriaVersion: 1,
        currentRevision: 1,
        criticality: "MEDIUM",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newVersion = currentBaseline.version + 1;
      const newTotalWeight = currentBaseline.totalWeight + additionalWeight;

      const newLeaves = [
        ...currentBaseline.leaves,
        {
          workItemId: newWorkItem.id,
          title: newWorkItem.title,
          weight: additionalWeight,
          isEligible: true,
          isDone: false,
        },
      ];

      const newBaseline: ScopeBaseline = {
        id: `baseline-${project.key.toLowerCase()}-v${newVersion}`,
        projectId,
        version: newVersion,
        reason,
        unit: currentBaseline.unit,
        approvedBy,
        approvedAt: new Date().toISOString(),
        totalWeight: newTotalWeight,
        leaves: newLeaves,
      };

      const updatedWorkItems = [...state.workItems, newWorkItem];
      const calc = calculateStructuredProgress(newBaseline, updatedWorkItems);

      const newSnapshot: ProgressSnapshot = {
        id: `snap-${Date.now()}`,
        projectId,
        instant: new Date().toISOString(),
        method: "CALCULATED_BASELINE",
        value: calc.percentage,
        numerator: calc.numerator,
        denominator: calc.denominator,
        baselineId: newBaseline.id,
        baselineVersion: newVersion,
        cause: `Approved scope addition of ${additionalWeight} points (${newLeafTitle}). Denominator expanded to ${newTotalWeight}. Progress recalculates to ${calc.percentage}%.`,
      };

      return {
        workItems: updatedWorkItems,
        baselines: [newBaseline, ...state.baselines],
        snapshots: [...state.snapshots, newSnapshot],
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                activeBaselineId: newBaseline.id,
                version: p.version + 1,
                lastProgressPercent: calc.percentage,
                lastProgressMethod: "CALCULATED_BASELINE",
              }
            : p
        ),
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            orgId: project.orgId,
            actorEmail: "manager@prowise.io",
            actorRole: "PROJECT_MANAGER",
            action: "SCOPE_BASELINE_EXPANDED",
            targetType: "PROJECT",
            targetId: project.id,
            details: `Approved scope baseline v${newVersion} (+${additionalWeight} ${currentBaseline.unit}). Reason: ${reason}`,
            timestamp: new Date().toISOString(),
          },
          ...state.auditLogs,
        ],
      };
    });
  },

  requestDeliveryAcceptance: (projectId, actorId) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId)!;

    const request: DeliveryAcceptanceRequest = {
      id: `acc-${Date.now()}`,
      projectId,
      projectKey: project.key,
      projectName: project.name,
      mode: project.mode,
      requestedBy: actorId,
      requestedAt: new Date().toISOString(),
      lastCheckInPercent: project.lastProgressPercent,
      checklist: [
        { id: `c-1`, text: "All deliverables verified and signed off", checked: false },
        { id: `c-2`, text: "Automated regression tests passed in staging", checked: false },
        { id: `c-3`, text: "Zero critical blockers or security defects", checked: false },
      ],
      waivers: [],
      status: "PENDING",
    };

    set((state) => ({
      acceptanceRequests: [request, ...state.acceptanceRequests],
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, deliveryReviewRequested: true } : p
      ),
    }));

    return request;
  },

  decideDeliveryAcceptance: (requestId, decision, actorId, reason) => {
    set((state) => {
      const req = state.acceptanceRequests.find((r) => r.id === requestId);
      if (!req) return state;

      const updatedRequests = state.acceptanceRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: decision,
              decisionBy: actorId,
              decisionAt: new Date().toISOString(),
              decisionReason: reason,
            }
          : r
      );

      const updatedProjects = state.projects.map((p) =>
        p.id === req.projectId
          ? {
              ...p,
              lifecycle: decision === "ACCEPTED" ? ("DELIVERED" as ProjectLifecycle) : p.lifecycle,
              deliveryAcceptedAt: decision === "ACCEPTED" ? new Date().toISOString() : undefined,
              deliveryAcceptedBy: decision === "ACCEPTED" ? actorId : undefined,
            }
          : p
      );

      return {
        acceptanceRequests: updatedRequests,
        projects: updatedProjects,
      };
    });
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  createSupportTicket: (ticketData) => {
    const newTicket: SupportTicket = {
      ...ticketData,
      id: `tkt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      supportTickets: [newTicket, ...state.supportTickets],
    }));
  },

  updateTicketStatus: (ticketId, status) => {
    set((state) => ({
      supportTickets: state.supportTickets.map((t) =>
        t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t
      ),
    }));
  },

  retryWebhookDelivery: (deliveryId) => {
    set((state) => ({
      webhookLogs: state.webhookLogs.map((w) =>
        w.deliveryId === deliveryId
          ? {
              ...w,
              status: "DELIVERED",
              statusCode: 200,
              attemptCount: w.attemptCount + 1,
            }
          : w
      ),
    }));
  },

  resetToInitialFixtures: () => {
    set({
      projects: SEEDED_PROJECTS,
      workItems: SEEDED_WORK_ITEMS,
      baselines: SEEDED_BASELINES,
      snapshots: SEEDED_SNAPSHOTS,
      checkIns: SEEDED_CHECKINS,
      repositories: SEEDED_REPOSITORIES,
      gitEvents: SEEDED_GIT_EVENTS,
      notifications: SEEDED_NOTIFICATIONS,
      supportTickets: SEEDED_SUPPORT_TICKETS,
      incidents: SEEDED_INCIDENTS,
      webhookLogs: SEEDED_WEBHOOK_LOGS,
      auditLogs: SEEDED_AUDIT_LOGS,
      acceptanceRequests: SEEDED_ACCEPTANCE_REQUESTS,
    });
  },
}));
