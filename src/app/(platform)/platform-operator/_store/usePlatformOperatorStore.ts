"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/safe-storage";
import { useAuthStore } from "@/store/auth-store";
import {
  AnnouncementDraft,
  ApiEndpointMetric,
  BackupSnapshot,
  EmailDeliveryRecord,
  EmailTemplateDraft,
  GitHubAppInstallation,
  InvoiceDeliveryItem,
  MaintenanceWindow,
  OperationalAlertRule,
  OperatorAccountSettings,
  OperatorActivityLog,
  OperatorIncident,
  OperatorIntegrationItem,
  OperatorLogCategory,
  OperatorTicket,
  OrgServiceHealth,
  PaymentFailureItem,
  SmtpHealthStatus,
  SubscriptionRecord,
  SupportAccessRequestItem,
  SyncJobItem,
  SystemServiceMetric,
  WebhookDeliveryItem,
} from "../_types";
import {
  SEED_ACCESS_REQUESTS,
  SEED_ALERTS,
  SEED_ANNOUNCEMENT_DRAFTS,
  SEED_API_ENDPOINTS,
  SEED_BACKUPS,
  SEED_EMAIL_DELIVERIES,
  SEED_EMAIL_DRAFTS,
  SEED_GH_MONITORING,
  SEED_INTEGRATIONS_HEALTH,
  SEED_INVOICE_DELIVERIES,
  SEED_MAINTENANCE_WINDOWS,
  SEED_OPERATOR_ACCOUNT,
  SEED_OPERATOR_INCIDENTS,
  SEED_OPERATOR_LOGS,
  SEED_OPERATOR_TICKETS,
  SEED_ORG_SERVICE_HEALTH,
  SEED_PAYMENT_FAILURES,
  SEED_SMTP_HEALTH,
  SEED_SUBSCRIPTION_STATUS,
  SEED_SYNC_JOBS,
  SEED_SYSTEM_METRICS,
  SEED_WEBHOOK_DELIVERIES,
} from "../_data/seed";

interface PlatformOperatorStoreState {
  orgHealth: OrgServiceHealth[];
  systemMetrics: SystemServiceMetric[];
  incidents: OperatorIncident[];
  tickets: OperatorTicket[];
  accessRequests: SupportAccessRequestItem[];
  integrations: OperatorIntegrationItem[];
  githubApps: GitHubAppInstallation[];
  webhooks: WebhookDeliveryItem[];
  syncJobs: SyncJobItem[];
  apiEndpoints: ApiEndpointMetric[];
  emailDeliveries: EmailDeliveryRecord[];
  smtpHealth: SmtpHealthStatus;
  emailDrafts: EmailTemplateDraft[];
  announcementDrafts: AnnouncementDraft[];
  subscriptions: SubscriptionRecord[];
  paymentFailures: PaymentFailureItem[];
  invoiceDeliveries: InvoiceDeliveryItem[];
  backups: BackupSnapshot[];
  maintenanceWindows: MaintenanceWindow[];
  alerts: OperationalAlertRule[];
  activityLogs: OperatorActivityLog[];
  accountSettings: OperatorAccountSettings;
  sidebarCollapsed: boolean;
  lastTelemetryTickAt: string;
  operatorProfile: any | null;
  setOperatorProfile: (profile: any) => void;

  setSidebarCollapsed: (collapsed: boolean) => void;
  tickLiveDemoMetrics: () => void;

  // Alerts -> Incidents -> Tickets
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  createIncidentFromAlert: (alertId: string) => OperatorIncident | null;

  createIncident: (input: {
    title: string;
    summary: string;
    severity: OperatorIncident["severity"];
    priority: OperatorIncident["priority"];
    assignedTo: string;
    affectedService: string;
  }) => OperatorIncident;
  updateIncident: (id: string, updates: Partial<OperatorIncident>, note?: string) => void;
  escalateIncident: (id: string) => void;
  createTicketFromIncident: (incidentId: string) => OperatorTicket | null;

  createTicket: (input: {
    orgId: string;
    orgName: string;
    subject: string;
    description: string;
    category: OperatorTicket["category"];
    priority: OperatorTicket["priority"];
    assignee: string;
    requesterEmail: string;
  }) => OperatorTicket;
  updateTicket: (id: string, updates: Partial<OperatorTicket>) => void;
  addTicketComment: (ticketId: string, message: string) => void;

  // Access Requests
  submitAccessRequest: (input: {
    orgId: string;
    orgName: string;
    ticketRef: string;
    scope: SupportAccessRequestItem["scope"];
    reason: string;
    durationHours: number;
  }) => void;
  revokeAccessRequest: (id: string) => void;

  // Integrations, GitHub, Webhooks, Sync Jobs
  runIntegrationDiagnostic: (id: string) => void;
  toggleIntegrationPause: (id: string) => void;
  syncGitHubInstallation: (id: string) => void;
  toggleGitHubPause: (id: string) => void;
  retryWebhookEvent: (id: string) => string;
  retryAllFailedWebhooks: () => number;
  retrySyncJob: (id: string) => void;
  toggleSyncJobPause: (id: string) => void;

  // Communication Operations
  checkSmtpHealth: () => void;
  resendEmailDelivery: (id: string) => void;
  createEmailDraft: (input: {
    name: string;
    category: EmailTemplateDraft["category"];
    subject: string;
    headline: string;
    bodyText: string;
    ctaLabel: string;
  }) => void;
  updateEmailDraft: (id: string, updates: Partial<EmailTemplateDraft>) => void;
  deleteEmailDraft: (id: string) => void;
  submitEmailDraftForApproval: (id: string) => void;

  createAnnouncementDraft: (input: {
    title: string;
    audience: AnnouncementDraft["audience"];
    type: AnnouncementDraft["type"];
    message: string;
    proposedScheduleAt: string;
  }) => void;
  updateAnnouncementDraft: (id: string, updates: Partial<AnnouncementDraft>) => void;
  deleteAnnouncementDraft: (id: string) => void;
  submitAnnouncementDraftForApproval: (id: string) => void;

  // Billing Operations
  updateSubscriptionNote: (id: string, supportNote: string) => void;
  retryPaymentFailure: (id: string, simulateSuccess: boolean) => void;
  escalatePaymentFailure: (id: string) => void;
  requestInvoiceResend: (id: string) => void;

  // System Operations
  triggerManualBackup: (scope: BackupSnapshot["scope"]) => void;
  requestBackupRestore: (id: string, reason: string) => void;
  createMaintenanceWindow: (input: {
    title: string;
    affectedArea: string;
    impactLevel: MaintenanceWindow["impactLevel"];
    scheduledStart: string;
    durationMinutes: number;
    notifyCustomers: boolean;
    notes?: string;
  }) => void;
  updateMaintenanceWindow: (id: string, updates: Partial<MaintenanceWindow>) => void;

  // Org Service Status check & Cross-Workflow Connections + Bulk Actions
  runOrgHealthProbe: (orgId: string) => void;
  bulkRunOrgHealthProbes: (orgIds: string[]) => number;
  escalateTicketToIncident: (ticketId: string) => OperatorIncident | null;
  createIncidentFromApiError: (endpointId: string) => OperatorIncident | null;
  createIncidentFromService: (serviceId: string) => OperatorIncident | null;
  bulkAcknowledgeAlerts: (ids: string[]) => number;
  bulkResolveAlerts: (ids: string[]) => number;
  bulkResolveIncidents: (ids: string[]) => number;
  bulkResolveTickets: (ids: string[]) => number;
  bulkRevokeAccessRequests: (ids: string[]) => number;
  bulkRetryWebhooks: (ids: string[]) => number;
  bulkRetrySyncJobs: (ids: string[]) => number;
  bulkResendEmails: (ids: string[]) => number;
  bulkSubmitEmailDrafts: (ids: string[]) => number;
  bulkDeleteEmailDrafts: (ids: string[]) => number;
  bulkSubmitAnnouncementDrafts: (ids: string[]) => number;
  bulkDeleteAnnouncementDrafts: (ids: string[]) => number;
  bulkRetryPaymentFailures: (ids: string[]) => number;
  bulkResendInvoices: (ids: string[]) => number;
  deleteMaintenanceWindow: (id: string) => void;

  // Account & Settings
  updateAccountSettings: (updates: Partial<OperatorAccountSettings>) => void;
  setOperatorDepartment: (department: string) => void;
  setActiveOperatorProfile: (operator: {
    id: string;
    name: string;
    email: string;
    department: string;
    shiftName?: string;
    mfaEnabled?: boolean;
    roleTitle?: string;
  }) => void;
  changeOperatorPassword: () => void;
  toggleOperatorMfa: (method?: OperatorAccountSettings["mfaMethod"]) => void;
  resetOperatorDemoData: () => void;
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

function appendLog(
  logs: OperatorActivityLog[],
  entry: {
    category: OperatorLogCategory;
    action: string;
    summary: string;
    actorName?: string;
    target?: string;
    severity?: OperatorActivityLog["severity"];
  }
): OperatorActivityLog[] {
  return [
    {
      id: uid("olog"),
      category: entry.category,
      action: entry.action,
      summary: entry.summary,
      actorName: entry.actorName || "Alex Rivera",
      target: entry.target,
      severity: entry.severity || "Info",
      timestamp: nowIso(),
    },
    ...logs,
  ].slice(0, 200);
}

export const usePlatformOperatorStore = create<PlatformOperatorStoreState>()(
  persist(
    (set, get) => ({
      operatorProfile: null,
      setOperatorProfile: (profile: any) => set({ operatorProfile: profile }),
      orgHealth: [],
      systemMetrics: [
        {
          id: "srv-api",
          serviceName: "Core API Gateway",
          category: "API & Compute",
          status: "Operational",
          cpuPct: 18,
          memoryPct: 42,
          latencyMs: 14,
          uptime30d: "99.99%",
          queueDepth: 0,
          dbConnectionsPct: 24,
          note: "Operating nominally across all regions.",
          updatedAt: nowIso(),
        },
        {
          id: "srv-db",
          serviceName: "PostgreSQL Production Cluster",
          category: "Database & Cache",
          status: "Operational",
          cpuPct: 22,
          memoryPct: 46,
          latencyMs: 6,
          uptime30d: "100.0%",
          queueDepth: 0,
          dbConnectionsPct: 32,
          note: "WAL archiving active, connections within pool limit.",
          updatedAt: nowIso(),
        },
      ],
      incidents: [],
      tickets: [],
      accessRequests: [],
      integrations: [
        {
          id: "int-github",
          name: "GitHub App Integration",
          category: "Source Control",
          status: "Healthy",
          errorRatePct: 0.0,
          avgLatencyMs: 42,
          failureCount24h: 0,
          lastDiagnosticSummary: "Webhook delivery nominal. All HMAC signatures valid.",
          lastCheckAt: nowIso(),
        },
        {
          id: "int-stripe",
          name: "Stripe Payment Gateway",
          category: "Billing & Payments",
          status: "Healthy",
          errorRatePct: 0.0,
          avgLatencyMs: 85,
          failureCount24h: 0,
          lastDiagnosticSummary: "Payment intents and webhooks operating normally.",
          lastCheckAt: nowIso(),
        },
        {
          id: "int-smtp",
          name: "Transactional Mail Relay",
          category: "Email Relay",
          status: "Healthy",
          errorRatePct: 0.0,
          avgLatencyMs: 65,
          failureCount24h: 0,
          lastDiagnosticSummary: "SMTP handshake and delivery active. Zero queue backlog.",
          lastCheckAt: nowIso(),
        },
      ],
      githubApps: [],
      webhooks: [],
      syncJobs: [],
      apiEndpoints: [
        {
          id: "ep-auth",
          endpointLabel: "POST /v1/auth/login",
          serviceArea: "Authentication",
          avgLatencyMs: 48,
          p95LatencyMs: 95,
          requestsPerMin: 120,
          errorRatePct: 0.0,
          status: "Normal",
          topIssueSummary: "Nominal response times and zero auth errors.",
        },
        {
          id: "ep-projects",
          endpointLabel: "GET /v1/projects",
          serviceArea: "Workspaces",
          avgLatencyMs: 32,
          p95LatencyMs: 70,
          requestsPerMin: 280,
          errorRatePct: 0.0,
          status: "Normal",
          topIssueSummary: "Cache hit ratio 94.2%. Response times nominal.",
        },
      ],
      emailDeliveries: [],
      smtpHealth: {
        providerLabel: "Primary Transactional Mail Relay",
        connectionState: "Healthy",
        inboxPlacementPct: 99.8,
        bounceRatePct: 0.0,
        dailySent: 0,
        dailyQuota: 50000,
        lastCheckedAt: nowIso(),
        checks: [
          { label: "Mail Relay Connection", passed: true, detail: "Relay server responding normally." },
          { label: "Domain Sender Verification", passed: true, detail: "SPF and DKIM active." },
          { label: "Queue Backlog", passed: true, detail: "0 messages waiting." },
        ],
      },
      emailDrafts: [],
      announcementDrafts: [],
      subscriptions: [],
      paymentFailures: [],
      invoiceDeliveries: [],
      backups: [
        {
          id: "bk-wal",
          snapshotCode: "SNAP-WAL-001",
          scope: "Primary Database",
          sizeGb: 12.4,
          status: "Verified",
          durationSec: 45,
          region: "us-east-1",
          retentionDays: 30,
          restoreStatus: "None",
          createdAt: nowIso(),
        },
      ],
      maintenanceWindows: [],
      alerts: [],
      activityLogs: [],
      accountSettings: {
        name: "Platform Director",
        roleTitle: "Lead Platform Operator",
        email: "main.operator@prowise.io",
        department: "Platform Operations",
        shiftName: "Executive Operations Lead",
        activeOperatorId: "op-main-1",
        timezone: "UTC",
        autoRefreshSeconds: 30,
        mfaEnabled: true,
        mfaMethod: "Authenticator App",
        passwordUpdatedAt: nowIso(),
        compactTables: false,
        notifications: {
          criticalAlerts: true,
          incidentAssignments: true,
          webhookFailures: true,
          slaWarnings: true,
          approvalDecisions: true,
        },
      },
      sidebarCollapsed: false,
      lastTelemetryTickAt: nowIso(),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      tickLiveDemoMetrics: () =>
        set((state) => {
          const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
          const delta = (step: number) => Math.round((Math.random() - 0.5) * 2 * step);
          return {
            lastTelemetryTickAt: nowIso(),
            systemMetrics: state.systemMetrics.map((m) => ({
              ...m,
              cpuPct: clamp(m.cpuPct + delta(4), 12, 92),
              memoryPct: clamp(m.memoryPct + delta(3), 25, 88),
              latencyMs: clamp(m.latencyMs + delta(8), 2, 320),
              queueDepth: m.queueDepth === 0 ? 0 : clamp(m.queueDepth + delta(5), 1, 140),
              updatedAt: nowIso(),
            })),
            apiEndpoints: state.apiEndpoints.map((ep) => ({
              ...ep,
              requestsPerMin: clamp(ep.requestsPerMin + delta(18), 15, 650),
              avgLatencyMs: clamp(ep.avgLatencyMs + delta(6), 20, 350),
            })),
          };
        }),

      acknowledgeAlert: (alertId) =>
        set((state) => {
          const target = state.alerts.find((a) => a.id === alertId);
          return {
            alerts: state.alerts.map((a) =>
              a.id === alertId
                ? { ...a, status: "Acknowledged", acknowledgedBy: state.accountSettings.name }
                : a
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Acknowledged Alert",
              summary: `Acknowledged "${target?.title || alertId}".`,
              actorName: state.accountSettings.name,
              target: target?.affectedTarget,
            }),
          };
        }),

      resolveAlert: (alertId) =>
        set((state) => {
          const target = state.alerts.find((a) => a.id === alertId);
          return {
            alerts: state.alerts.map((a) =>
              a.id === alertId
                ? {
                    ...a,
                    status: "Resolved",
                    acknowledgedBy: a.acknowledgedBy || state.accountSettings.name,
                  }
                : a
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Resolved Alert",
              summary: `Marked alert "${target?.title || alertId}" as resolved.`,
              actorName: state.accountSettings.name,
              target: target?.affectedTarget,
            }),
          };
        }),

      createIncidentFromAlert: (alertId) => {
        const state = get();
        const alert = state.alerts.find((a) => a.id === alertId);
        if (!alert) return null;
        const nextNum = 2050 + state.incidents.length;
        const created: OperatorIncident = {
          id: uid("inc"),
          code: `INC-${nextNum}`,
          title: alert.title,
          summary: `Escalated from alert threshold: ${alert.thresholdSummary}. Affected area: ${alert.affectedTarget}.`,
          severity: alert.severity === "Critical" ? "Critical" : alert.severity === "Warning" ? "Major" : "Minor",
          priority: alert.severity === "Critical" ? "Urgent" : alert.severity === "Warning" ? "High" : "Medium",
          status: "Investigating",
          assignedTo: state.accountSettings.name,
          affectedService: alert.affectedTarget,
          escalatedToSuperAdmin: false,
          linkedAlertId: alert.id,
          timeline: [
            {
              id: uid("tl"),
              at: nowIso(),
              actor: state.accountSettings.name,
              note: `Converted system alert "${alert.title}" into an active operational incident.`,
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          incidents: [created, ...state.incidents],
          alerts: state.alerts.map((a) =>
            a.id === alert.id
              ? {
                  ...a,
                  status: "Acknowledged",
                  acknowledgedBy: state.accountSettings.name,
                  linkedIncidentId: created.id,
                }
              : a
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Created Incident from Alert",
            summary: `Opened ${created.code} from alert "${alert.title}".`,
            actorName: state.accountSettings.name,
            target: created.affectedService,
            severity: "Warning",
          }),
        });
        return created;
      },

      createIncident: (input) => {
        const state = get();
        const nextNum = 2050 + state.incidents.length;
        const created: OperatorIncident = {
          id: uid("inc"),
          code: `INC-${nextNum}`,
          title: input.title,
          summary: input.summary,
          severity: input.severity,
          priority: input.priority,
          status: "Open",
          assignedTo: input.assignedTo,
          affectedService: input.affectedService,
          escalatedToSuperAdmin: false,
          timeline: [
            {
              id: uid("tl"),
              at: nowIso(),
              actor: state.accountSettings.name,
              note: `Incident declared and assigned to ${input.assignedTo}.`,
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          incidents: [created, ...state.incidents],
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Declared Operational Incident",
            summary: `Created ${created.code}: ${created.title} (${created.severity}).`,
            actorName: state.accountSettings.name,
            target: created.affectedService,
            severity: created.severity === "Critical" ? "Critical" : "Warning",
          }),
        });
        return created;
      },

      updateIncident: (id, updates, note) =>
        set((state) => {
          const target = state.incidents.find((i) => i.id === id);
          const nextIncidents = state.incidents.map((inc) => {
            if (inc.id !== id) return inc;
            const entry = note
              ? [
                  {
                    id: uid("tl"),
                    at: nowIso(),
                    actor: state.accountSettings.name,
                    note,
                  },
                  ...inc.timeline,
                ]
              : inc.timeline;
            return {
              ...inc,
              ...updates,
              timeline: entry,
              updatedAt: nowIso(),
            };
          });
          const nextAlerts =
            updates.status === "Resolved" && target?.linkedAlertId
              ? state.alerts.map((a) =>
                  a.id === target.linkedAlertId ? { ...a, status: "Resolved" as const } : a
                )
              : state.alerts;

          return {
            incidents: nextIncidents,
            alerts: nextAlerts,
            activityLogs: appendLog(state.activityLogs, {
              category: "Incident",
              action: `Updated Incident ${target?.code || ""}`,
              summary: note || `Updated status to ${updates.status || target?.status}.`,
              actorName: state.accountSettings.name,
              target: target?.affectedService,
            }),
          };
        }),

      escalateIncident: (id) =>
        set((state) => {
          const target = state.incidents.find((i) => i.id === id);
          return {
            incidents: state.incidents.map((inc) =>
              inc.id === id
                ? {
                    ...inc,
                    escalatedToSuperAdmin: true,
                    priority: "Urgent",
                    timeline: [
                      {
                        id: uid("tl"),
                        at: nowIso(),
                        actor: state.accountSettings.name,
                        note: "Escalated incident to Super Admin governance queue.",
                      },
                      ...inc.timeline,
                    ],
                    updatedAt: nowIso(),
                  }
                : inc
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Incident",
              action: "Escalated Incident to Super Admin",
              summary: `Escalated ${target?.code || id} ("${target?.title || ""}") for executive visibility.`,
              actorName: state.accountSettings.name,
              target: target?.affectedService,
              severity: "Critical",
            }),
          };
        }),

      createTicketFromIncident: (incidentId) => {
        const state = get();
        const inc = state.incidents.find((i) => i.id === incidentId);
        if (!inc) return null;
        const nextNum = 5106 + state.tickets.length;
        const ticket: OperatorTicket = {
          id: uid("tkt"),
          ticketNumber: `SUP-${nextNum}`,
          orgId: "org-vanguard",
          orgName: "Affected Enterprise Tenant",
          subject: `Follow-up for ${inc.code}: ${inc.title}`,
          description: inc.summary,
          category: "Performance",
          priority: inc.severity === "Critical" ? "Critical" : inc.severity === "Major" ? "High" : "Medium",
          status: "Open",
          assignee: inc.assignedTo,
          requesterEmail: "operations-followup@prowise.io",
          slaMinutesRemaining: 120,
          slaState: "On Track",
          linkedIncidentId: inc.id,
          comments: [
            {
              id: uid("cmt"),
              author: state.accountSettings.name,
              roleLabel: "Platform Operator",
              message: `Created linked follow-up ticket from ${inc.code}.`,
              createdAt: nowIso(),
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          tickets: [ticket, ...state.tickets],
          incidents: state.incidents.map((item) =>
            item.id === inc.id ? { ...item, linkedTicketId: ticket.id } : item
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Support",
            action: "Linked Ticket Created",
            summary: `Created ${ticket.ticketNumber} from incident ${inc.code}.`,
            actorName: state.accountSettings.name,
            target: ticket.orgName,
          }),
        });
        return ticket;
      },

      createTicket: (input) => {
        const state = get();
        const nextNum = 5106 + state.tickets.length;
        const slaMap = { Critical: 60, High: 120, Medium: 240, Low: 480 };
        const ticket: OperatorTicket = {
          id: uid("tkt"),
          ticketNumber: `SUP-${nextNum}`,
          orgId: input.orgId,
          orgName: input.orgName,
          subject: input.subject,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: "Open",
          assignee: input.assignee,
          requesterEmail: input.requesterEmail,
          slaMinutesRemaining: slaMap[input.priority],
          slaState: "On Track",
          comments: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          tickets: [ticket, ...state.tickets],
          activityLogs: appendLog(state.activityLogs, {
            category: "Support",
            action: "Created Support Ticket",
            summary: `Opened ${ticket.ticketNumber} for ${ticket.orgName}: ${ticket.subject}.`,
            actorName: state.accountSettings.name,
            target: ticket.orgName,
          }),
        });
        return ticket;
      },

      updateTicket: (id, updates) =>
        set((state) => {
          const target = state.tickets.find((t) => t.id === id);
          return {
            tickets: state.tickets.map((t) =>
              t.id === id
                ? {
                    ...t,
                    ...updates,
                    slaState: updates.status === "Resolved" ? "On Track" : updates.slaState || t.slaState,
                    updatedAt: nowIso(),
                  }
                : t
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Support",
              action: `Updated Ticket ${target?.ticketNumber || ""}`,
              summary: `Ticket updated (${updates.status || target?.status || "modified"}).`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      addTicketComment: (ticketId, message) =>
        set((state) => {
          const target = state.tickets.find((t) => t.id === ticketId);
          return {
            tickets: state.tickets.map((t) =>
              t.id === ticketId
                ? {
                    ...t,
                    comments: [
                      ...t.comments,
                      {
                        id: uid("cmt"),
                        author: state.accountSettings.name,
                        roleLabel: state.accountSettings.roleTitle,
                        message,
                        createdAt: nowIso(),
                      },
                    ],
                    updatedAt: nowIso(),
                  }
                : t
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Support",
              action: `Added Reply on ${target?.ticketNumber || "Ticket"}`,
              summary: message.slice(0, 90),
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      submitAccessRequest: (input) =>
        set((state) => {
          const item: SupportAccessRequestItem = {
            id: uid("req"),
            orgId: input.orgId,
            orgName: input.orgName,
            ticketRef: input.ticketRef,
            scope: input.scope,
            reason: input.reason,
            durationHours: input.durationHours,
            status: "Pending Approval",
            requestedAt: nowIso(),
          };
          return {
            accessRequests: [item, ...state.accessRequests],
            activityLogs: appendLog(state.activityLogs, {
              category: "Support",
              action: "Submitted Support Access Request",
              summary: `Requested ${input.durationHours}h ${input.scope} access for ${input.orgName} (${input.ticketRef}).`,
              actorName: state.accountSettings.name,
              target: input.orgName,
            }),
          };
        }),

      revokeAccessRequest: (id) =>
        set((state) => {
          const target = state.accessRequests.find((r) => r.id === id);
          return {
            accessRequests: state.accessRequests.map((r) =>
              r.id === id ? { ...r, status: "Revoked" } : r
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Support",
              action: "Revoked Support Access Window",
              summary: `Ended active temporary access to ${target?.orgName || id} (${target?.ticketRef || ""}).`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
              severity: "Warning",
            }),
          };
        }),

      runIntegrationDiagnostic: (id) =>
        set((state) => {
          const target = state.integrations.find((i) => i.id === id);
          return {
            integrations: state.integrations.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: i.status === "Paused" ? "Paused" : "Healthy",
                    errorRatePct: i.status === "Paused" ? i.errorRatePct : 0.1,
                    failureCount24h: i.status === "Paused" ? i.failureCount24h : 0,
                    lastDiagnosticSummary: "Diagnostic ping completed: connection responding cleanly (simulated).",
                    lastCheckAt: nowIso(),
                  }
                : i
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: "Ran Integration Diagnostic",
              summary: `Verified connection health for ${target?.name || id}.`,
              actorName: state.accountSettings.name,
              target: target?.name,
            }),
          };
        }),

      toggleIntegrationPause: (id) =>
        set((state) => {
          const target = state.integrations.find((i) => i.id === id);
          const nextPaused = target?.status !== "Paused";
          return {
            integrations: state.integrations.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: nextPaused ? "Paused" : "Healthy",
                    lastDiagnosticSummary: nextPaused
                      ? "Non-critical background sync paused by operator."
                      : "Resumed normal monitoring and sync operations.",
                    lastCheckAt: nowIso(),
                  }
                : i
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: nextPaused ? "Paused Integration Sync" : "Resumed Integration Sync",
              summary: `${nextPaused ? "Paused" : "Resumed"} ${target?.name || id}.`,
              actorName: state.accountSettings.name,
              target: target?.name,
              severity: "Warning",
            }),
          };
        }),

      syncGitHubInstallation: (id) =>
        set((state) => {
          const target = state.githubApps.find((g) => g.id === id);
          return {
            githubApps: state.githubApps.map((g) =>
              g.id === id
                ? {
                    ...g,
                    syncState: "Synced",
                    webhookHealth: "Healthy",
                    lastErrorSummary: undefined,
                    lastSyncedAt: nowIso(),
                  }
                : g
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: "Triggered GitHub Repository Sync",
              summary: `Completed catch-up sync for ${target?.orgName || id} (@${target?.githubAccount || ""}).`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      toggleGitHubPause: (id) =>
        set((state) => {
          const target = state.githubApps.find((g) => g.id === id);
          const nextPaused = target?.syncState !== "Paused";
          return {
            githubApps: state.githubApps.map((g) =>
              g.id === id
                ? {
                    ...g,
                    syncState: nextPaused ? "Paused" : "Synced",
                    webhookHealth: nextPaused ? "Retrying" : "Healthy",
                    lastSyncedAt: nowIso(),
                  }
                : g
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: nextPaused ? "Paused GitHub App Sync" : "Resumed GitHub App Sync",
              summary: `${nextPaused ? "Paused" : "Resumed"} GitHub installation for ${target?.orgName || id}.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
              severity: "Warning",
            }),
          };
        }),

      retryWebhookEvent: (id) => {
        const state = get();
        const target = state.webhooks.find((w) => w.id === id);
        const jobCode = `JOB-${311 + state.syncJobs.length}`;
        const newJob: SyncJobItem = {
          id: uid("job"),
          jobCode,
          name: `Webhook Replay — ${target?.eventTitle || "Event"}`,
          queue: "Webhook Ingestion",
          orgName: target?.orgName || "Platform",
          status: "Completed",
          processedCount: 1,
          totalCount: 1,
          retries: (target?.attempts || 0) + 1,
          lastRunAt: nowIso(),
          note: `Replayed ${target?.referenceId || id} cleanly via sync queue.`,
        };

        set({
          webhooks: state.webhooks.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status: "Delivered",
                  httpStatus: 200,
                  attempts: w.attempts + 1,
                  latencyMs: 94,
                  friendlyReason: `Replayed cleanly via ${jobCode} (simulated).`,
                  syncedJobCode: jobCode,
                }
              : w
          ),
          syncJobs: [newJob, ...state.syncJobs],
          activityLogs: appendLog(state.activityLogs, {
            category: "Integration",
            action: "Retried Failed Webhook & Synced",
            summary: `Replayed ${target?.referenceId || id} for ${target?.orgName || "tenant"} via ${jobCode}.`,
            actorName: state.accountSettings.name,
            target: target?.orgName,
          }),
        });
        return jobCode;
      },

      retryAllFailedWebhooks: () => {
        const state = get();
        const failing = state.webhooks.filter((w) => w.status === "Failed" || w.status === "Retrying");
        if (failing.length === 0) return 0;
        const jobCode = `JOB-${311 + state.syncJobs.length}`;
        const batchJob: SyncJobItem = {
          id: uid("job"),
          jobCode,
          name: `Bulk Failed Event Replay (${failing.length} events)`,
          queue: "Webhook Ingestion",
          orgName: "Multiple Organizations",
          status: "Completed",
          processedCount: failing.length,
          totalCount: failing.length,
          retries: 1,
          lastRunAt: nowIso(),
          note: "All queued failed webhook events replayed without duplicates.",
        };
        set({
          webhooks: state.webhooks.map((w) =>
            w.status === "Failed" || w.status === "Retrying"
              ? {
                  ...w,
                  status: "Delivered",
                  httpStatus: 200,
                  attempts: w.attempts + 1,
                  latencyMs: 88,
                  friendlyReason: `Delivered cleanly during batch replay ${jobCode} (simulated).`,
                  syncedJobCode: jobCode,
                }
              : w
          ),
          syncJobs: [batchJob, ...state.syncJobs],
          activityLogs: appendLog(state.activityLogs, {
            category: "Integration",
            action: "Batch Replayed Failed Webhooks",
            summary: `Replayed ${failing.length} failed/retrying event(s) via ${jobCode}.`,
            actorName: state.accountSettings.name,
          }),
        });
        return failing.length;
      },

      retrySyncJob: (id) =>
        set((state) => {
          const target = state.syncJobs.find((j) => j.id === id);
          return {
            syncJobs: state.syncJobs.map((j) =>
              j.id === id
                ? {
                    ...j,
                    status: "Completed",
                    processedCount: j.totalCount,
                    retries: j.retries + 1,
                    lastRunAt: nowIso(),
                    note: "Manual operator retry succeeded (simulated).",
                  }
                : j
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: "Retried Sync Job",
              summary: `Retried ${target?.jobCode || id} (${target?.name || ""}) and completed all items.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      toggleSyncJobPause: (id) =>
        set((state) => {
          const target = state.syncJobs.find((j) => j.id === id);
          const willPause = target?.status !== "Paused";
          return {
            syncJobs: state.syncJobs.map((j) =>
              j.id === id
                ? {
                    ...j,
                    status: willPause ? "Paused" : "Running",
                    lastRunAt: nowIso(),
                  }
                : j
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Integration",
              action: willPause ? "Paused Sync Queue Job" : "Resumed Sync Queue Job",
              summary: `${willPause ? "Paused" : "Resumed"} ${target?.jobCode || id}.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
              severity: "Warning",
            }),
          };
        }),

      checkSmtpHealth: () =>
        set((state) => ({
          smtpHealth: {
            ...state.smtpHealth,
            connectionState: "Healthy",
            lastCheckedAt: nowIso(),
            checks: [
              {
                label: "Mail Relay Connection",
                passed: true,
                detail: "Verified healthy response from transactional mail relay (simulated).",
              },
              {
                label: "Domain Sender Verification",
                passed: true,
                detail: "SPF and DKIM sender alignment verified.",
              },
              {
                label: "Queue Backlog",
                passed: true,
                detail: "Queue draining cleanly within normal latency bounds.",
              },
            ],
          },
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Checked SMTP Relay Health",
            summary: "Ran automated email relay connection check; all checks passed (simulated).",
            actorName: state.accountSettings.name,
          }),
        })),

      resendEmailDelivery: (id) =>
        set((state) => {
          const target = state.emailDeliveries.find((e) => e.id === id);
          return {
            emailDeliveries: state.emailDeliveries.map((e) =>
              e.id === id
                ? {
                    ...e,
                    status: "Delivered",
                    bounceReason: undefined,
                    timestamp: nowIso(),
                  }
                : e
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Requeued Bounced Email",
              summary: `Re-dispatched ${target?.messageRef || id} to ${target?.recipient || "recipient"} (simulated).`,
              actorName: state.accountSettings.name,
              target: target?.recipient,
            }),
          };
        }),

      createEmailDraft: (input) =>
        set((state) => {
          const draft: EmailTemplateDraft = {
            id: uid("edr"),
            ...input,
            status: "Draft",
            updatedAt: nowIso(),
          };
          return {
            emailDrafts: [draft, ...state.emailDrafts],
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Created Email Template Draft",
              summary: `Created draft "${draft.name}".`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      updateEmailDraft: (id, updates) =>
        set((state) => ({
          emailDrafts: state.emailDrafts.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: nowIso() } : d
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Updated Email Draft",
            summary: `Edited template draft ${updates.name || id}.`,
            actorName: state.accountSettings.name,
          }),
        })),

      deleteEmailDraft: (id) =>
        set((state) => {
          const target = state.emailDrafts.find((d) => d.id === id);
          return {
            emailDrafts: state.emailDrafts.filter((d) => d.id !== id),
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Deleted Email Draft",
              summary: `Removed draft "${target?.name || id}".`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      submitEmailDraftForApproval: (id) =>
        set((state) => {
          const target = state.emailDrafts.find((d) => d.id === id);
          return {
            emailDrafts: state.emailDrafts.map((d) =>
              d.id === id
                ? { ...d, status: "Submitted for Approval", updatedAt: nowIso() }
                : d
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Submitted Email Draft for Approval",
              summary: `Sent "${target?.name || id}" to Super Admin for final approval and publishing.`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      createAnnouncementDraft: (input) =>
        set((state) => {
          const draft: AnnouncementDraft = {
            id: uid("adr"),
            ...input,
            status: "Draft",
            updatedAt: nowIso(),
          };
          return {
            announcementDrafts: [draft, ...state.announcementDrafts],
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Created Announcement Draft",
              summary: `Drafted announcement proposal "${draft.title}".`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      updateAnnouncementDraft: (id, updates) =>
        set((state) => ({
          announcementDrafts: state.announcementDrafts.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: nowIso() } : a
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Updated Announcement Draft",
            summary: `Updated announcement proposal ${updates.title || id}.`,
            actorName: state.accountSettings.name,
          }),
        })),

      deleteAnnouncementDraft: (id) =>
        set((state) => {
          const target = state.announcementDrafts.find((a) => a.id === id);
          return {
            announcementDrafts: state.announcementDrafts.filter((a) => a.id !== id),
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Deleted Announcement Draft",
              summary: `Deleted proposal "${target?.title || id}".`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      submitAnnouncementDraftForApproval: (id) =>
        set((state) => {
          const target = state.announcementDrafts.find((a) => a.id === id);
          return {
            announcementDrafts: state.announcementDrafts.map((a) =>
              a.id === id
                ? { ...a, status: "Submitted for Approval", updatedAt: nowIso() }
                : a
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Communication",
              action: "Submitted Announcement for Approval",
              summary: `Submitted "${target?.title || id}" to Super Admin for schedule review and publish.`,
              actorName: state.accountSettings.name,
            }),
          };
        }),

      updateSubscriptionNote: (id, supportNote) =>
        set((state) => {
          const target = state.subscriptions.find((s) => s.id === id);
          return {
            subscriptions: state.subscriptions.map((s) =>
              s.id === id ? { ...s, supportNote } : s
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Billing",
              action: "Updated Subscription Support Note",
              summary: `Updated support note for ${target?.orgName || id}.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      retryPaymentFailure: (id, simulateSuccess) =>
        set((state) => {
          const target = state.paymentFailures.find((p) => p.id === id);
          return {
            paymentFailures: state.paymentFailures.map((p) =>
              p.id === id
                ? {
                    ...p,
                    retryCount: p.retryCount + 1,
                    retryStatus: simulateSuccess ? "Retried — Succeeded" : "Retried — Failed",
                  }
                : p
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Billing",
              action: simulateSuccess ? "Payment Retry Succeeded" : "Payment Retry Failed",
              summary: `Triggered payment retry for ${target?.refCode || id} (${target?.orgName || ""}): ${
                simulateSuccess ? "settled (simulated)" : "still declined (simulated)"
              }.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
              severity: simulateSuccess ? "Info" : "Warning",
            }),
          };
        }),

      escalatePaymentFailure: (id) =>
        set((state) => {
          const target = state.paymentFailures.find((p) => p.id === id);
          return {
            paymentFailures: state.paymentFailures.map((p) =>
              p.id === id
                ? {
                    ...p,
                    retryStatus: "Escalated to Super Admin",
                    escalatedAt: nowIso(),
                  }
                : p
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Billing",
              action: "Escalated Payment Failure",
              summary: `Escalated ${target?.refCode || id} for ${target?.orgName || "tenant"} to Super Admin billing governance.`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
              severity: "Critical",
            }),
          };
        }),

      requestInvoiceResend: (id) =>
        set((state) => {
          const target = state.invoiceDeliveries.find((inv) => inv.id === id);
          return {
            invoiceDeliveries: state.invoiceDeliveries.map((inv) =>
              inv.id === id
                ? {
                    ...inv,
                    deliveryStatus: "Delivered",
                    resendCount: inv.resendCount + 1,
                    lastSentAt: nowIso(),
                    failureNote: undefined,
                  }
                : inv
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "Billing",
              action: "Resent Invoice PDF Notice",
              summary: `Resent ${target?.invoiceNumber || id} to ${target?.recipientEmail || ""} (simulated).`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      triggerManualBackup: (scope) =>
        set((state) => {
          const code = `SNAP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
            Math.floor(1000 + Math.random() * 9000)
          )}`;
          const snap: BackupSnapshot = {
            id: uid("bak"),
            snapshotCode: code,
            scope,
            sizeGb: scope === "Workspace Attachments" ? 18.4 : scope === "Primary Database" ? 6.5 : 2.0,
            status: "Verified",
            durationSec: 120,
            region: "Multi-Region Vault",
            retentionDays: scope === "Audit Archive" ? 365 : 30,
            restoreStatus: "None",
            createdAt: nowIso(),
            note: "On-demand operator verification snapshot completed cleanly (simulated).",
          };
          return {
            backups: [snap, ...state.backups],
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Triggered On-Demand Backup",
              summary: `Completed verified ${scope} snapshot (${code}).`,
              actorName: state.accountSettings.name,
              target: scope,
            }),
          };
        }),

      requestBackupRestore: (id, reason) =>
        set((state) => {
          const target = state.backups.find((b) => b.id === id);
          return {
            backups: state.backups.map((b) =>
              b.id === id
                ? {
                    ...b,
                    restoreStatus: "Restore Requested",
                    note: `Restore requested: ${reason}`,
                  }
                : b
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Submitted Restore Request",
              summary: `Requested recovery validation from ${target?.snapshotCode || id} (requires Super Admin sign-off).`,
              actorName: state.accountSettings.name,
              target: target?.scope,
              severity: "Critical",
            }),
          };
        }),

      createMaintenanceWindow: (input) =>
        set((state) => {
          const item: MaintenanceWindow = {
            id: uid("mnt"),
            ...input,
            status: "Scheduled",
          };
          return {
            maintenanceWindows: [item, ...state.maintenanceWindows],
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Scheduled Maintenance Window",
              summary: `Scheduled "${item.title}" (${item.durationMinutes} min, ${item.impactLevel}).`,
              actorName: state.accountSettings.name,
              target: item.affectedArea,
            }),
          };
        }),

      updateMaintenanceWindow: (id, updates) =>
        set((state) => {
          const target = state.maintenanceWindows.find((m) => m.id === id);
          return {
            maintenanceWindows: state.maintenanceWindows.map((m) =>
              m.id === id ? { ...m, ...updates } : m
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Updated Maintenance Window",
              summary: `Updated "${target?.title || id}" to ${updates.status || target?.status}.`,
              actorName: state.accountSettings.name,
              target: target?.affectedArea,
            }),
          };
        }),

      runOrgHealthProbe: (orgId) =>
        set((state) => {
          const target = state.orgHealth.find((o) => o.id === orgId);
          return {
            orgHealth: state.orgHealth.map((o) =>
              o.id === orgId
                ? {
                    ...o,
                    status: o.status === "Degraded" ? "Elevated" : "Operational",
                    avgResponseMs: Math.max(48, Math.round(o.avgResponseMs * 0.85)),
                    lastCheckedAt: nowIso(),
                  }
                : o
            ),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Verified Tenant Health Probe",
              summary: `Completed service health check for ${target?.orgName || orgId} (simulated).`,
              actorName: state.accountSettings.name,
              target: target?.orgName,
            }),
          };
        }),

      bulkRunOrgHealthProbes: (orgIds) => {
        const state = get();
        const setIds = new Set(orgIds);
        const count = state.orgHealth.filter((o) => setIds.has(o.id)).length;
        if (count === 0) return 0;
        set({
          orgHealth: state.orgHealth.map((o) =>
            setIds.has(o.id)
              ? {
                  ...o,
                  status: o.status === "Degraded" ? "Elevated" : "Operational",
                  avgResponseMs: Math.max(48, Math.round(o.avgResponseMs * 0.85)),
                  lastCheckedAt: nowIso(),
                }
              : o
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "System",
            action: "Bulk Health Probe Verified",
            summary: `Ran service health probes across ${count} selected organization(s).`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      escalateTicketToIncident: (ticketId) => {
        const state = get();
        const ticket = state.tickets.find((t) => t.id === ticketId);
        if (!ticket) return null;
        if (ticket.linkedIncidentId) {
          return state.incidents.find((i) => i.id === ticket.linkedIncidentId) || null;
        }
        const nextNum = 2050 + state.incidents.length;
        const created: OperatorIncident = {
          id: uid("inc"),
          code: `INC-${nextNum}`,
          title: `[Ticket ${ticket.ticketNumber}] ${ticket.subject}`,
          summary: `Escalated from customer ticket (${ticket.orgName}): ${ticket.description}`,
          severity: ticket.priority === "Critical" ? "Critical" : "Major",
          priority: ticket.priority === "Critical" ? "Urgent" : "High",
          status: "Investigating",
          assignedTo: ticket.assignee || state.accountSettings.name,
          affectedService: `${ticket.category} — ${ticket.orgName}`,
          escalatedToSuperAdmin: false,
          linkedTicketId: ticket.id,
          timeline: [
            {
              id: uid("tl"),
              at: nowIso(),
              actor: state.accountSettings.name,
              note: `Opened incident directly from support ticket ${ticket.ticketNumber}.`,
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          incidents: [created, ...state.incidents],
          tickets: state.tickets.map((t) =>
            t.id === ticket.id
              ? { ...t, status: "Escalated", linkedIncidentId: created.id, updatedAt: nowIso() }
              : t
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Escalated Ticket to Incident",
            summary: `Created ${created.code} from ticket ${ticket.ticketNumber} (${ticket.orgName}).`,
            actorName: state.accountSettings.name,
            target: ticket.ticketNumber,
            severity: "Warning",
          }),
        });
        return created;
      },

      createIncidentFromApiError: (endpointId) => {
        const state = get();
        const ep = state.apiEndpoints.find((e) => e.id === endpointId);
        if (!ep) return null;
        const nextNum = 2050 + state.incidents.length;
        const created: OperatorIncident = {
          id: uid("inc"),
          code: `INC-${nextNum}`,
          title: `Elevated Latency & Error Rate — ${ep.endpointLabel}`,
          summary: `${ep.serviceArea} reporting ${ep.errorRatePct}% error rate (${ep.avgLatencyMs}ms avg / ${ep.p95LatencyMs}ms p95). Issue: ${ep.topIssueSummary}`,
          severity: ep.status === "Degraded" ? "Critical" : "Major",
          priority: ep.status === "Degraded" ? "Urgent" : "High",
          status: "Investigating",
          assignedTo: state.accountSettings.name,
          affectedService: ep.serviceArea,
          escalatedToSuperAdmin: false,
          timeline: [
            {
              id: uid("tl"),
              at: nowIso(),
              actor: state.accountSettings.name,
              note: `Opened from API Error Monitoring for ${ep.endpointLabel}.`,
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          incidents: [created, ...state.incidents],
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Declared Incident from API Monitor",
            summary: `Created ${created.code} for ${ep.endpointLabel}.`,
            actorName: state.accountSettings.name,
            target: ep.serviceArea,
            severity: "Warning",
          }),
        });
        return created;
      },

      createIncidentFromService: (serviceId) => {
        const state = get();
        const svc = state.systemMetrics.find((m) => m.id === serviceId);
        if (!svc) return null;
        const nextNum = 2050 + state.incidents.length;
        const created: OperatorIncident = {
          id: uid("inc"),
          code: `INC-${nextNum}`,
          title: `Service Degradation — ${svc.serviceName}`,
          summary: `${svc.serviceName} (${svc.category}) reported CPU ${svc.cpuPct}%, Memory ${svc.memoryPct}%, Latency ${svc.latencyMs}ms, Queue depth ${svc.queueDepth}. Note: ${svc.note}`,
          severity: svc.status === "Degraded" ? "Critical" : "Major",
          priority: svc.status === "Degraded" ? "Urgent" : "High",
          status: "Investigating",
          assignedTo: state.accountSettings.name,
          affectedService: svc.serviceName,
          escalatedToSuperAdmin: false,
          timeline: [
            {
              id: uid("tl"),
              at: nowIso(),
              actor: state.accountSettings.name,
              note: `Opened directly from System Monitoring (${svc.serviceName}).`,
            },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({
          incidents: [created, ...state.incidents],
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Opened Incident from System Monitor",
            summary: `Opened ${created.code} for ${svc.serviceName}.`,
            actorName: state.accountSettings.name,
            target: svc.serviceName,
            severity: "Warning",
          }),
        });
        return created;
      },

      bulkAcknowledgeAlerts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.alerts.filter((a) => setIds.has(a.id) && a.status === "Active").length;
        if (count === 0) return 0;
        set({
          alerts: state.alerts.map((a) =>
            setIds.has(a.id) && a.status === "Active"
              ? { ...a, status: "Acknowledged", acknowledgedBy: state.accountSettings.name }
              : a
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "System",
            action: "Bulk Acknowledged Alerts",
            summary: `Acknowledged ${count} operational alert(s).`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkResolveAlerts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.alerts.filter((a) => setIds.has(a.id) && a.status !== "Resolved").length;
        if (count === 0) return 0;
        set({
          alerts: state.alerts.map((a) =>
            setIds.has(a.id) && a.status !== "Resolved"
              ? { ...a, status: "Resolved", acknowledgedBy: a.acknowledgedBy || state.accountSettings.name }
              : a
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "System",
            action: "Bulk Resolved Alerts",
            summary: `Marked ${count} operational alert(s) as Resolved.`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkResolveIncidents: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.incidents.filter((i) => setIds.has(i.id) && i.status !== "Resolved").length;
        if (count === 0) return 0;
        set({
          incidents: state.incidents.map((inc) =>
            setIds.has(inc.id) && inc.status !== "Resolved"
              ? {
                  ...inc,
                  status: "Resolved",
                  updatedAt: nowIso(),
                  timeline: [
                    {
                      id: uid("tl"),
                      at: nowIso(),
                      actor: state.accountSettings.name,
                      note: "Resolved via bulk incident triage action.",
                    },
                    ...inc.timeline,
                  ],
                }
              : inc
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Incident",
            action: "Bulk Resolved Incidents",
            summary: `Marked ${count} incident(s) as Resolved.`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkResolveTickets: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.tickets.filter((t) => setIds.has(t.id) && t.status !== "Resolved").length;
        if (count === 0) return 0;
        set({
          tickets: state.tickets.map((t) =>
            setIds.has(t.id) && t.status !== "Resolved"
              ? { ...t, status: "Resolved", updatedAt: nowIso() }
              : t
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Support",
            action: "Bulk Resolved Support Tickets",
            summary: `Closed ${count} support ticket(s) as Resolved.`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkRevokeAccessRequests: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.accessRequests.filter(
          (r) => setIds.has(r.id) && (r.status === "Approved" || r.status === "Pending Approval")
        ).length;
        if (count === 0) return 0;
        set({
          accessRequests: state.accessRequests.map((r) =>
            setIds.has(r.id) && (r.status === "Approved" || r.status === "Pending Approval")
              ? { ...r, status: "Revoked" }
              : r
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Support",
            action: "Bulk Revoked Access Requests",
            summary: `Revoked ${count} support access session(s)/request(s).`,
            actorName: state.accountSettings.name,
            severity: "Warning",
          }),
        });
        return count;
      },

      bulkRetryWebhooks: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.webhooks.filter((w) => setIds.has(w.id) && w.status !== "Delivered");
        if (targets.length === 0) return 0;
        targets.forEach((t) => state.retryWebhookEvent(t.id));
        return targets.length;
      },

      bulkRetrySyncJobs: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.syncJobs.filter((j) => setIds.has(j.id) && j.status !== "Completed");
        if (targets.length === 0) return 0;
        targets.forEach((j) => state.retrySyncJob(j.id));
        return targets.length;
      },

      bulkResendEmails: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.emailDeliveries.filter(
          (e) => setIds.has(e.id) && (e.status === "Bounced" || e.status === "Failed" || e.status === "Deferred")
        );
        if (targets.length === 0) return 0;
        targets.forEach((e) => state.resendEmailDelivery(e.id));
        return targets.length;
      },

      bulkSubmitEmailDrafts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.emailDrafts.filter(
          (d) => setIds.has(d.id) && (d.status === "Draft" || d.status === "Changes Requested")
        );
        if (targets.length === 0) return 0;
        set({
          emailDrafts: state.emailDrafts.map((d) =>
            setIds.has(d.id) && (d.status === "Draft" || d.status === "Changes Requested")
              ? { ...d, status: "Submitted for Approval", updatedAt: nowIso() }
              : d
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Bulk Submitted Email Drafts",
            summary: `Submitted ${targets.length} email draft(s) for Super Admin approval.`,
            actorName: state.accountSettings.name,
          }),
        });
        return targets.length;
      },

      bulkDeleteEmailDrafts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.emailDrafts.filter((d) => setIds.has(d.id)).length;
        if (count === 0) return 0;
        set({
          emailDrafts: state.emailDrafts.filter((d) => !setIds.has(d.id)),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Bulk Deleted Email Drafts",
            summary: `Removed ${count} operator email draft(s).`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkSubmitAnnouncementDrafts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.announcementDrafts.filter(
          (a) => setIds.has(a.id) && (a.status === "Draft" || a.status === "Changes Requested")
        );
        if (targets.length === 0) return 0;
        set({
          announcementDrafts: state.announcementDrafts.map((a) =>
            setIds.has(a.id) && (a.status === "Draft" || a.status === "Changes Requested")
              ? { ...a, status: "Submitted for Approval", updatedAt: nowIso() }
              : a
          ),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Bulk Submitted Announcement Drafts",
            summary: `Submitted ${targets.length} announcement proposal(s) for Super Admin review.`,
            actorName: state.accountSettings.name,
          }),
        });
        return targets.length;
      },

      bulkDeleteAnnouncementDrafts: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const count = state.announcementDrafts.filter((a) => setIds.has(a.id)).length;
        if (count === 0) return 0;
        set({
          announcementDrafts: state.announcementDrafts.filter((a) => !setIds.has(a.id)),
          activityLogs: appendLog(state.activityLogs, {
            category: "Communication",
            action: "Bulk Deleted Announcement Drafts",
            summary: `Deleted ${count} announcement draft(s).`,
            actorName: state.accountSettings.name,
          }),
        });
        return count;
      },

      bulkRetryPaymentFailures: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.paymentFailures.filter(
          (p) => setIds.has(p.id) && p.retryStatus !== "Retried — Succeeded"
        );
        if (targets.length === 0) return 0;
        targets.forEach((p) => state.retryPaymentFailure(p.id, true));
        return targets.length;
      },

      bulkResendInvoices: (ids) => {
        const state = get();
        const setIds = new Set(ids);
        const targets = state.invoiceDeliveries.filter((i) => setIds.has(i.id));
        if (targets.length === 0) return 0;
        targets.forEach((i) => state.requestInvoiceResend(i.id));
        return targets.length;
      },

      deleteMaintenanceWindow: (id) =>
        set((state) => {
          const target = state.maintenanceWindows.find((m) => m.id === id);
          return {
            maintenanceWindows: state.maintenanceWindows.filter((m) => m.id !== id),
            activityLogs: appendLog(state.activityLogs, {
              category: "System",
              action: "Removed Maintenance Window",
              summary: `Deleted maintenance record "${target?.title || id}".`,
              actorName: state.accountSettings.name,
              target: target?.affectedArea,
            }),
          };
        }),

      updateAccountSettings: (updates) =>
        set((state) => ({
          accountSettings: { ...state.accountSettings, ...updates },
          activityLogs: appendLog(state.activityLogs, {
            category: "Account",
            action: "Updated Operator Preferences",
            summary: "Updated profile or alert/refresh preferences.",
            actorName: updates.name || state.accountSettings.name,
          }),
        })),

      setOperatorDepartment: (department) =>
        set((state) => ({
          accountSettings: { ...state.accountSettings, department },
          activityLogs: appendLog(state.activityLogs, {
            category: "Account",
            action: "Changed Operational Department",
            summary: `Shifted active operator department context to ${department}.`,
            actorName: state.accountSettings.name,
          }),
        })),

      setActiveOperatorProfile: (operator) =>
        set((state) => ({
          accountSettings: {
            ...state.accountSettings,
            activeOperatorId: operator.id,
            name: operator.name,
            email: operator.email,
            department: operator.department,
            shiftName: operator.shiftName || state.accountSettings.shiftName,
            mfaEnabled: operator.mfaEnabled ?? state.accountSettings.mfaEnabled,
            roleTitle: operator.roleTitle || `${operator.department} Operator`,
          },
          activityLogs: appendLog(state.activityLogs, {
            category: "Account",
            action: "Switched Operator Account Context",
            summary: `Signed in as ${operator.name} (${operator.department}).`,
            actorName: operator.name,
          }),
        })),

      changeOperatorPassword: () =>
        set((state) => ({
          accountSettings: { ...state.accountSettings, passwordUpdatedAt: nowIso() },
          activityLogs: appendLog(state.activityLogs, {
            category: "Account",
            action: "Rotated Operator Password",
            summary: "Completed password rotation check (simulated local state).",
            actorName: state.accountSettings.name,
            severity: "Warning",
          }),
        })),

      toggleOperatorMfa: (method) =>
        set((state) => {
          const nextEnabled = !state.accountSettings.mfaEnabled;
          const nextMethod = method || state.accountSettings.mfaMethod;
          return {
            accountSettings: {
              ...state.accountSettings,
              mfaEnabled: nextEnabled,
              mfaMethod: nextMethod,
            },
            activityLogs: appendLog(state.activityLogs, {
              category: "Account",
              action: nextEnabled ? "Enabled Operator 2FA" : "Disabled Operator 2FA",
              summary: nextEnabled
                ? `Enabled two-factor authentication using ${nextMethod}.`
                : "Turned off two-factor authentication.",
              actorName: state.accountSettings.name,
              severity: "Warning",
            }),
          };
        }),

      resetOperatorDemoData: () =>
        set({
          orgHealth: [],
          systemMetrics: [
            {
              id: "srv-api",
              serviceName: "Core API Gateway",
              category: "API & Compute",
              status: "Operational",
              cpuPct: 18,
              memoryPct: 42,
              latencyMs: 14,
              uptime30d: "99.99%",
              queueDepth: 0,
              dbConnectionsPct: 24,
              note: "Operating nominally across all regions.",
              updatedAt: nowIso(),
            },
            {
              id: "srv-db",
              serviceName: "PostgreSQL Production Cluster",
              category: "Database & Cache",
              status: "Operational",
              cpuPct: 22,
              memoryPct: 46,
              latencyMs: 6,
              uptime30d: "100.0%",
              queueDepth: 0,
              dbConnectionsPct: 32,
              note: "WAL archiving active, connections within pool limit.",
              updatedAt: nowIso(),
            },
          ],
          incidents: [],
          tickets: [],
          accessRequests: [],
          integrations: [
            {
              id: "int-github",
              name: "GitHub App Integration",
              category: "Source Control",
              status: "Healthy",
              errorRatePct: 0.0,
              avgLatencyMs: 42,
              failureCount24h: 0,
              lastDiagnosticSummary: "Webhook delivery nominal. All HMAC signatures valid.",
              lastCheckAt: nowIso(),
            },
            {
              id: "int-stripe",
              name: "Stripe Payment Gateway",
              category: "Billing & Payments",
              status: "Healthy",
              errorRatePct: 0.0,
              avgLatencyMs: 85,
              failureCount24h: 0,
              lastDiagnosticSummary: "Payment intents and webhooks operating normally.",
              lastCheckAt: nowIso(),
            },
            {
              id: "int-smtp",
              name: "Transactional Mail Relay",
              category: "Email Relay",
              status: "Healthy",
              errorRatePct: 0.0,
              avgLatencyMs: 65,
              failureCount24h: 0,
              lastDiagnosticSummary: "SMTP handshake and delivery active. Zero queue backlog.",
              lastCheckAt: nowIso(),
            },
          ],
          githubApps: [],
          webhooks: [],
          syncJobs: [],
          apiEndpoints: [
            {
              id: "ep-auth",
              endpointLabel: "POST /v1/auth/login",
              serviceArea: "Authentication",
              avgLatencyMs: 48,
              p95LatencyMs: 95,
              requestsPerMin: 120,
              errorRatePct: 0.0,
              status: "Normal",
              topIssueSummary: "Nominal response times and zero auth errors.",
            },
            {
              id: "ep-projects",
              endpointLabel: "GET /v1/projects",
              serviceArea: "Workspaces",
              avgLatencyMs: 32,
              p95LatencyMs: 70,
              requestsPerMin: 280,
              errorRatePct: 0.0,
              status: "Normal",
              topIssueSummary: "Cache hit ratio 94.2%. Response times nominal.",
            },
          ],
          emailDeliveries: [],
          smtpHealth: {
            providerLabel: "Primary Transactional Mail Relay",
            connectionState: "Healthy",
            inboxPlacementPct: 99.8,
            bounceRatePct: 0.0,
            dailySent: 0,
            dailyQuota: 50000,
            lastCheckedAt: nowIso(),
            checks: [
              { label: "Mail Relay Connection", passed: true, detail: "Relay server responding normally." },
              { label: "Domain Sender Verification", passed: true, detail: "SPF and DKIM active." },
              { label: "Queue Backlog", passed: true, detail: "0 messages waiting." },
            ],
          },
          emailDrafts: [],
          announcementDrafts: [],
          subscriptions: [],
          paymentFailures: [],
          invoiceDeliveries: [],
          backups: [
            {
              id: "bk-wal",
              snapshotCode: "SNAP-WAL-001",
              scope: "Primary Database",
              sizeGb: 12.4,
              status: "Verified",
              durationSec: 45,
              region: "us-east-1",
              retentionDays: 30,
              restoreStatus: "None",
              createdAt: nowIso(),
            },
          ],
          maintenanceWindows: [],
          alerts: [],
          activityLogs: [],
          accountSettings: {
            name: "Platform Director",
            roleTitle: "Lead Platform Operator",
            email: "main.operator@prowise.io",
            department: "Platform Operations",
            shiftName: "Executive Operations Lead",
            activeOperatorId: "op-main-1",
            timezone: "UTC",
            autoRefreshSeconds: 30,
            mfaEnabled: true,
            mfaMethod: "Authenticator App",
            passwordUpdatedAt: nowIso(),
            compactTables: false,
            notifications: {
              criticalAlerts: true,
              incidentAssignments: true,
              webhookFailures: true,
              slaWarnings: true,
              approvalDecisions: true,
            },
          },
          lastTelemetryTickAt: nowIso(),
        }),
    }),
    {
      name: "prowise-platform-operator-store-v3",
      storage: safeJSONStorage,
      skipHydration: true,
    }
  )
);

export type OperatorPermission =
  | "incidents.manage"
  | "tickets.manage"
  | "access.request"
  | "integrations.manage"
  | "communications.draft"
  | "billing.triage"
  | "system.manage"
  | "settings.manage"
  | "governance.super_admin_only";

const OPERATOR_ALLOWED_PERMISSIONS = new Set<OperatorPermission>([
  "incidents.manage",
  "tickets.manage",
  "access.request",
  "integrations.manage",
  "communications.draft",
  "billing.triage",
  "system.manage",
  "settings.manage",
]);

/**
 * Returns permission checks enforcing the Platform Operator delegated scope.
 * Operators handle day-to-day incidents, tickets, retries, drafts, and triage,
 * while Super Admin-only governance decisions remain locked unless explicitly granted.
 */
export function useOperatorPermissions() {
  const currentRole = useAuthStore((s) => s.currentRole);
  const can = (permission: OperatorPermission) => {
    if (currentRole === "SUPER_ADMIN") return true;
    if (currentRole !== "PLATFORM_OPERATOR") return false;
    return OPERATOR_ALLOWED_PERMISSIONS.has(permission);
  };
  return {
    currentRole,
    can,
    isOperatorScope: currentRole === "PLATFORM_OPERATOR",
  };
}


