"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/safe-storage";
import {
  MaintenanceAuditLog,
  MaintenanceChecklistStep,
  MaintenanceCustomerBanner,
  MaintenanceExecutionNote,
  MaintenanceImpactLevel,
  MaintenanceScope,
  MaintenanceServiceArea,
  MaintenanceStatus,
  MaintenanceWindowItem,
} from "../types/maintenance";

const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem[] = [
  {
    id: "mnt-84",
    trackingCode: "MNT-2026-084",
    title: "EU & US Webhook Gateway Consumer Ingress Patch",
    reason: "Applying hotfix for Redis consumer pod concurrency lag to eliminate 45-second delivery jitter.",
    scope: "PLATFORM_WIDE",
    impactLevel: "Brief Slowdown",
    affectedServices: [
      "Webhook Delivery & Ingestion",
      "Background Worker Queues",
      "GitHub Repository Sync",
    ],
    scheduledStart: "2026-11-13T10:00:00Z",
    scheduledEnd: "2026-11-13T10:45:00Z",
    actualStart: "2026-11-13T10:00:00Z",
    durationMinutes: 45,
    timezone: "UTC",
    status: "IN_PROGRESS",
    isEmergency: true,
    emergencyOverrideBy: "Arthur Pendelton (Super Admin)",
    requestedBy: "Jordan Mercer",
    requestedByEmail: "operator@prowise.io",
    requestedAt: "2026-11-13T09:40:00Z",
    reviewedBy: "Arthur Pendelton",
    reviewedAt: "2026-11-13T09:50:00Z",
    customerNoticeMessage:
      "ProWise is applying an urgent zero-downtime performance patch to the webhook consumer cluster. Webhook delivery may experience brief transit latency.",
    estimatedRestorationTime: "10:45 UTC (approximately 15 minutes remaining)",
    notifyCustomers: true,
    bannerActive: true,
    progressPct: 60,
    serviceRestorationChecks: [
      {
        id: "chk-1",
        label: "Drain pending Redis ingestion queue buffers",
        completed: true,
        checkedAt: "2026-11-13T10:05:00Z",
        checkedBy: "Jordan Mercer",
      },
      {
        id: "chk-2",
        label: "Deploy patched consumer gateway container v2.14.2",
        completed: true,
        checkedAt: "2026-11-13T10:15:00Z",
        checkedBy: "Jordan Mercer",
      },
      {
        id: "chk-3",
        label: "Run automated synthetic webhook delivery check",
        completed: false,
      },
      {
        id: "chk-4",
        label: "Confirm p99 webhook transit latency < 150ms",
        completed: false,
      },
    ],
    executionNotes: [
      {
        id: "nt-1",
        author: "Arthur Pendelton",
        role: "Super Administrator",
        note: "Authorized emergency maintenance override due to 3 tenant escalation tickets regarding clinical webhook delays.",
        timestamp: "2026-11-13T09:50:00Z",
      },
      {
        id: "nt-2",
        author: "Jordan Mercer",
        role: "Platform Operator",
        note: "Queue drained. Container deployment rolling out across 3 worker replicas.",
        timestamp: "2026-11-13T10:15:00Z",
      },
    ],
    auditLogs: [
      {
        id: "aud-84-1",
        action: "Emergency Maintenance Requested",
        actor: "Jordan Mercer (Platform Operator)",
        timestamp: "2026-11-13T09:40:00Z",
        details: "Requested expedited patch for webhook ingestion queue backlog.",
      },
      {
        id: "aud-84-2",
        action: "Super Admin Emergency Approval",
        actor: "Arthur Pendelton (Super Admin)",
        timestamp: "2026-11-13T09:50:00Z",
        details: "Approved immediate execution with customer banner notification.",
      },
      {
        id: "aud-84-3",
        action: "Maintenance Window Started",
        actor: "Jordan Mercer (Platform Operator)",
        timestamp: "2026-11-13T10:00:00Z",
        details: "Status transitioned to IN_PROGRESS. Customer banner active.",
      },
    ],
    createdAt: "2026-11-13T09:40:00Z",
    updatedAt: "2026-11-13T10:15:00Z",
  },
  {
    id: "mnt-85",
    trackingCode: "MNT-2026-085",
    title: "CloudPulse Commerce Dedicated Redis Cluster Migration",
    reason:
      "Migrating CloudPulse tenant cache partition to high-throughput isolated cluster to prevent webhook signature verification timeouts on flash sales.",
    scope: "ORGANIZATION_SPECIFIC",
    targetOrgId: "org-cloudpulse",
    targetOrgName: "CloudPulse Commerce",
    impactLevel: "Brief Slowdown",
    affectedServices: [
      "Core Web API",
      "Database & Storage",
      "Webhook Delivery & Ingestion",
    ],
    scheduledStart: "2026-11-14T03:00:00Z",
    scheduledEnd: "2026-11-14T03:30:00Z",
    durationMinutes: 30,
    timezone: "Australia/Sydney",
    status: "PENDING_APPROVAL",
    isEmergency: false,
    requestedBy: "Alex Rivera",
    requestedByEmail: "alex.rivera@prowise.io",
    requestedAt: "2026-11-13T08:15:00Z",
    customerNoticeMessage:
      "CloudPulse Commerce workspace cache is undergoing scheduled partition migration. Order checkouts and analytics remain online.",
    estimatedRestorationTime: "03:30 UTC",
    notifyCustomers: true,
    bannerActive: false,
    progressPct: 0,
    serviceRestorationChecks: [
      {
        id: "chk-85-1",
        label: "Snapshot existing CloudPulse tenant key partition",
        completed: false,
      },
      {
        id: "chk-85-2",
        label: "Sync memory keys to dedicated Redis cluster",
        completed: false,
      },
      {
        id: "chk-85-3",
        label: "Cut over tenant connection router endpoint",
        completed: false,
      },
      {
        id: "chk-85-4",
        label: "Verify zero checkout drop rate for 10 minutes",
        completed: false,
      },
    ],
    executionNotes: [
      {
        id: "nt-85-1",
        author: "Alex Rivera",
        role: "Platform Operator",
        note: "Submitted after recurring ticket SUP-1045 investigation. Low-traffic 03:00 UTC window chosen per tenant agreement.",
        timestamp: "2026-11-13T08:15:00Z",
      },
    ],
    auditLogs: [
      {
        id: "aud-85-1",
        action: "Maintenance Request Submitted",
        actor: "Alex Rivera (Platform Operator)",
        timestamp: "2026-11-13T08:15:00Z",
        details: "Submitted request for Super Admin approval for CloudPulse Commerce.",
      },
    ],
    createdAt: "2026-11-13T08:15:00Z",
    updatedAt: "2026-11-13T08:15:00Z",
  },
  {
    id: "mnt-82",
    trackingCode: "MNT-2026-082",
    title: "PostgreSQL Primary Read-Replica Kernel Upgrade & Index Rebuild",
    reason: "Applying kernel security patches and re-indexing analytics query tables.",
    scope: "PLATFORM_WIDE",
    impactLevel: "No Downtime",
    affectedServices: [
      "Database & Storage",
      "Reporting & Telemetry",
    ],
    scheduledStart: "2026-11-15T02:00:00Z",
    scheduledEnd: "2026-11-15T02:30:00Z",
    durationMinutes: 30,
    timezone: "UTC",
    status: "SCHEDULED",
    isEmergency: false,
    requestedBy: "Priya Nair",
    requestedByEmail: "priya.nair@prowise.io",
    requestedAt: "2026-11-11T14:00:00Z",
    reviewedBy: "Arthur Pendelton",
    reviewedAt: "2026-11-11T16:30:00Z",
    customerNoticeMessage:
      "Scheduled database replica maintenance. Primary workspace workflows are unaffected; historical CSV reporting may experience slight delays.",
    estimatedRestorationTime: "02:30 UTC",
    notifyCustomers: true,
    bannerActive: false,
    progressPct: 0,
    serviceRestorationChecks: [
      {
        id: "chk-82-1",
        label: "Verify replication lag < 50ms before failover",
        completed: false,
      },
      {
        id: "chk-82-2",
        label: "Rebuild B-tree indexes on delivery_events table",
        completed: false,
      },
      {
        id: "chk-82-3",
        label: "Warm read cache and verify p95 analytics latency",
        completed: false,
      },
    ],
    executionNotes: [
      {
        id: "nt-82-1",
        author: "Arthur Pendelton",
        role: "Super Administrator",
        note: "Approved for Sunday morning low-traffic window. Notify customers on Friday.",
        timestamp: "2026-11-11T16:30:00Z",
      },
    ],
    auditLogs: [
      {
        id: "aud-82-1",
        action: "Maintenance Requested",
        actor: "Priya Nair (Operator)",
        timestamp: "2026-11-11T14:00:00Z",
      },
      {
        id: "aud-82-2",
        action: "Maintenance Approved by Super Admin",
        actor: "Arthur Pendelton (Super Admin)",
        timestamp: "2026-11-11T16:30:00Z",
        details: "Approved for execution on Nov 15, 02:00 UTC.",
      },
    ],
    createdAt: "2026-11-11T14:00:00Z",
    updatedAt: "2026-11-11T16:30:00Z",
  },
  {
    id: "mnt-79",
    trackingCode: "MNT-2026-079",
    title: "Q4 OAuth Certificate Rollover & Identity SSO Key Rotation",
    reason: "Annual cryptographic key rotation for SAML 2.0 and OAuth 2.1 token signing.",
    scope: "PLATFORM_WIDE",
    impactLevel: "No Downtime",
    affectedServices: [
      "Authentication & Single Sign-On",
      "Core Web API",
    ],
    scheduledStart: "2026-11-08T01:00:00Z",
    scheduledEnd: "2026-11-08T01:25:00Z",
    actualStart: "2026-11-08T01:00:00Z",
    actualEnd: "2026-11-08T01:20:00Z",
    durationMinutes: 25,
    timezone: "UTC",
    status: "COMPLETED",
    isEmergency: false,
    requestedBy: "Sophia Rossi",
    requestedAt: "2026-11-05T10:00:00Z",
    reviewedBy: "Arthur Pendelton",
    reviewedAt: "2026-11-05T14:00:00Z",
    customerNoticeMessage: "Zero-downtime identity certificate rollover.",
    estimatedRestorationTime: "01:25 UTC",
    notifyCustomers: false,
    bannerActive: false,
    progressPct: 100,
    serviceRestorationChecks: [
      {
        id: "chk-79-1",
        label: "Publish dual-signed JWKS cert bundle",
        completed: true,
        checkedAt: "2026-11-08T01:05:00Z",
        checkedBy: "Sophia Rossi",
      },
      {
        id: "chk-79-2",
        label: "Validate SAML assertions on test tenant realms",
        completed: true,
        checkedAt: "2026-11-08T01:15:00Z",
        checkedBy: "Sophia Rossi",
      },
      {
        id: "chk-79-3",
        label: "Deprecate expired key version from active rotation",
        completed: true,
        checkedAt: "2026-11-08T01:20:00Z",
        checkedBy: "Sophia Rossi",
      },
    ],
    executionNotes: [
      {
        id: "nt-79-1",
        author: "Sophia Rossi",
        role: "Platform Operator",
        note: "All 12 enterprise tenant IdP connections validated cleanly with 0 auth errors.",
        timestamp: "2026-11-08T01:20:00Z",
      },
    ],
    completionReport: {
      summary: "Dual-signed JWKS keys successfully activated. Zero customer authentication failures.",
      verifiedBy: "Sophia Rossi (Trust & Compliance Operator)",
      actualDowntimeMinutes: 0,
      completedAt: "2026-11-08T01:20:00Z",
    },
    auditLogs: [
      { id: "aud-79-1", action: "Requested", actor: "Sophia Rossi", timestamp: "2026-11-05T10:00:00Z" },
      { id: "aud-79-2", action: "Approved", actor: "Arthur Pendelton", timestamp: "2026-11-05T14:00:00Z" },
      { id: "aud-79-3", action: "Started", actor: "Sophia Rossi", timestamp: "2026-11-08T01:00:00Z" },
      { id: "aud-79-4", action: "Completed & Verified", actor: "Sophia Rossi", timestamp: "2026-11-08T01:20:00Z" },
    ],
    createdAt: "2026-11-05T10:00:00Z",
    updatedAt: "2026-11-08T01:20:00Z",
  },
  {
    id: "mnt-80",
    trackingCode: "MNT-2026-080",
    title: "Legacy Deliverables Archive Sharding",
    reason: "Partitioning archived deliverable attachments into cold storage tiers.",
    scope: "PLATFORM_WIDE",
    impactLevel: "Planned Downtime",
    affectedServices: ["Database & Storage"],
    scheduledStart: "2026-11-06T04:00:00Z",
    scheduledEnd: "2026-11-06T05:00:00Z",
    durationMinutes: 60,
    timezone: "UTC",
    status: "CANCELLED",
    isEmergency: false,
    cancellationReason: "Postponed to avoid overlap with tenant fiscal quarter-end reporting freezes.",
    requestedBy: "Liam Chen",
    requestedAt: "2026-11-03T11:00:00Z",
    reviewedBy: "Arthur Pendelton",
    reviewedAt: "2026-11-04T09:00:00Z",
    customerNoticeMessage: "Archive maintenance cancelled.",
    estimatedRestorationTime: "N/A",
    notifyCustomers: false,
    bannerActive: false,
    progressPct: 0,
    serviceRestorationChecks: [],
    executionNotes: [
      {
        id: "nt-80-1",
        author: "Arthur Pendelton",
        role: "Super Administrator",
        note: "Cancelled per customer feedback regarding quarterly compliance lock.",
        timestamp: "2026-11-05T08:00:00Z",
      },
    ],
    auditLogs: [
      { id: "aud-80-1", action: "Requested", actor: "Liam Chen", timestamp: "2026-11-03T11:00:00Z" },
      { id: "aud-80-2", action: "Cancelled", actor: "Arthur Pendelton (Super Admin)", timestamp: "2026-11-05T08:00:00Z" },
    ],
    createdAt: "2026-11-03T11:00:00Z",
    updatedAt: "2026-11-05T08:00:00Z",
  },
];

interface MaintenanceStoreState {
  maintenanceWindows: MaintenanceWindowItem[];
  platformWideMaintenanceActive: boolean;
  activeOrgMaintenanceIds: string[];

  // Request & Lifecycle Actions
  requestMaintenance: (input: {
    title: string;
    reason: string;
    scope: MaintenanceScope;
    targetOrgId?: string;
    targetOrgName?: string;
    impactLevel: MaintenanceImpactLevel;
    affectedServices: MaintenanceServiceArea[];
    scheduledStart: string;
    scheduledEnd: string;
    durationMinutes?: number;
    timezone?: string;
    customerNoticeMessage?: string;
    estimatedRestorationTime?: string;
    notifyCustomers?: boolean;
    isEmergency?: boolean;
    requestedBy: string;
    requestedByEmail?: string;
  }) => MaintenanceWindowItem;

  editMaintenance: (id: string, updates: Partial<MaintenanceWindowItem>) => void;

  approveMaintenance: (
    id: string,
    reviewerName: string,
    notes?: string
  ) => { ok: boolean; error?: string };

  rejectMaintenance: (
    id: string,
    reviewerName: string,
    reason: string
  ) => { ok: boolean; error?: string };

  cancelMaintenance: (
    id: string,
    actorName: string,
    reason: string
  ) => { ok: boolean; error?: string };

  startMaintenance: (
    id: string,
    actorName: string
  ) => { ok: boolean; error?: string };

  toggleServiceCheck: (
    windowId: string,
    checkId: string,
    actorName: string
  ) => void;

  addExecutionNote: (
    windowId: string,
    note: string,
    author: string,
    role: "Platform Operator" | "Super Administrator" | "System"
  ) => void;

  completeMaintenance: (
    id: string,
    report: { summary: string; verifiedBy: string }
  ) => { ok: boolean; error?: string };

  emergencyOverrideActivate: (input: {
    title: string;
    reason: string;
    scope: MaintenanceScope;
    targetOrgId?: string;
    targetOrgName?: string;
    impactLevel: MaintenanceImpactLevel;
    affectedServices: MaintenanceServiceArea[];
    customerNoticeMessage: string;
    estimatedRestorationTime: string;
    durationMinutes?: number;
    adminName: string;
  }) => MaintenanceWindowItem;

  emergencyStop: (
    id: string,
    actorName: string,
    reason: string
  ) => { ok: boolean; error?: string };

  updateCustomerNotice: (
    id: string,
    message: string,
    estimatedRestorationTime: string
  ) => void;

  // Direct toggle helpers for Super Admin
  togglePlatformWideMaintenance: (
    enable: boolean,
    adminName: string,
    reason?: string
  ) => void;

  toggleOrgMaintenance: (
    orgId: string,
    orgName: string,
    enable: boolean,
    adminName: string,
    reason?: string
  ) => void;

  // Simulation & checks
  isOrganizationInMaintenance: (orgId: string) => {
    inMaintenance: boolean;
    window?: MaintenanceWindowItem;
  };
  getActiveBanner: () => MaintenanceCustomerBanner | null;
  resetDemoData: () => void;
}

export const useMaintenanceStore = create<MaintenanceStoreState>()(
  persist(
    (set, get) => ({
      maintenanceWindows: SEED_MAINTENANCE_ITEMS,
      platformWideMaintenanceActive: true, // mnt-84 is active
      activeOrgMaintenanceIds: [],

      requestMaintenance: (input) => {
        const now = new Date().toISOString();
        const codeNum = 80 + get().maintenanceWindows.length + 1;
        const code = `MNT-2026-0${codeNum}`;
        const dur =
          input.durationMinutes ||
          Math.max(
            15,
            Math.round(
              (new Date(input.scheduledEnd).getTime() -
                new Date(input.scheduledStart).getTime()) /
                60000
            )
          );

        const newWindow: MaintenanceWindowItem = {
          id: `mnt-${Date.now()}`,
          trackingCode: code,
          title: input.title.trim(),
          reason: input.reason.trim(),
          scope: input.scope,
          targetOrgId: input.targetOrgId,
          targetOrgName: input.targetOrgName,
          impactLevel: input.impactLevel,
          affectedServices: input.affectedServices,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          durationMinutes: dur,
          timezone: input.timezone || "UTC",
          status: "PENDING_APPROVAL",
          isEmergency: Boolean(input.isEmergency),
          requestedBy: input.requestedBy,
          requestedByEmail: input.requestedByEmail,
          requestedAt: now,
          customerNoticeMessage:
            input.customerNoticeMessage ||
            `Planned maintenance is scheduled for ${input.title}. Services may experience brief disruptions.`,
          estimatedRestorationTime:
            input.estimatedRestorationTime || "Within scheduled window",
          notifyCustomers:
            input.notifyCustomers !== undefined ? input.notifyCustomers : true,
          bannerActive: false,
          progressPct: 0,
          serviceRestorationChecks: input.affectedServices.map((svc, idx) => ({
            id: `chk-${Date.now()}-${idx}`,
            label: `Verify health and latency of ${svc}`,
            completed: false,
          })),
          executionNotes: [
            {
              id: `nt-${Date.now()}`,
              author: input.requestedBy,
              role: "Platform Operator",
              note: `Maintenance request created and submitted for Super Admin review.${
                input.isEmergency ? " [FLAGGED AS EMERGENCY REQUEST]" : ""
              }`,
              timestamp: now,
            },
          ],
          auditLogs: [
            {
              id: `aud-${Date.now()}`,
              action: input.isEmergency
                ? "Emergency Maintenance Requested"
                : "Maintenance Request Submitted",
              actor: `${input.requestedBy} (Platform Operator)`,
              timestamp: now,
              details: `Scope: ${input.scope}${
                input.targetOrgName ? ` (${input.targetOrgName})` : ""
              }, Impact: ${input.impactLevel}`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          maintenanceWindows: [newWindow, ...state.maintenanceWindows],
        }));

        return newWindow;
      },

      editMaintenance: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          maintenanceWindows: state.maintenanceWindows.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: now } : m
          ),
        }));
      },

      approveMaintenance: (id, reviewerName, notes) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };
        if (target.status !== "PENDING_APPROVAL") {
          return { ok: false, error: `Cannot approve window with status "${target.status}".` };
        }

        const now = new Date().toISOString();
        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Maintenance Window Approved",
          actor: `${reviewerName} (Super Admin)`,
          timestamp: now,
          details: notes || "Approved for authorized execution as scheduled.",
        };

        const execNote: MaintenanceExecutionNote = {
          id: `nt-${Date.now()}`,
          author: reviewerName,
          role: "Super Administrator",
          note: `Approved schedule. ${notes || "Operator is authorized to commence during scheduled start."}`,
          timestamp: now,
        };

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "SCHEDULED",
                  reviewedBy: reviewerName,
                  reviewedAt: now,
                  executionNotes: [...m.executionNotes, execNote],
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
        }));

        return { ok: true };
      },

      rejectMaintenance: (id, reviewerName, reason) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };

        const now = new Date().toISOString();
        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Maintenance Request Rejected",
          actor: `${reviewerName} (Super Admin)`,
          timestamp: now,
          details: `Rejection reason: ${reason}`,
        };

        const execNote: MaintenanceExecutionNote = {
          id: `nt-${Date.now()}`,
          author: reviewerName,
          role: "Super Administrator",
          note: `Request rejected: ${reason}`,
          timestamp: now,
        };

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "REJECTED",
                  reviewedBy: reviewerName,
                  reviewedAt: now,
                  rejectionReason: reason,
                  executionNotes: [...m.executionNotes, execNote],
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
        }));

        return { ok: true };
      },

      cancelMaintenance: (id, actorName, reason) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };

        const now = new Date().toISOString();
        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Maintenance Window Cancelled",
          actor: actorName,
          timestamp: now,
          details: reason,
        };

        const wasActive = target.status === "IN_PROGRESS";
        const isPlatform = target.scope === "PLATFORM_WIDE";

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "CANCELLED",
                  cancellationReason: reason,
                  bannerActive: false,
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
          platformWideMaintenanceActive:
            wasActive && isPlatform ? false : s.platformWideMaintenanceActive,
          activeOrgMaintenanceIds:
            wasActive && target.targetOrgId
              ? s.activeOrgMaintenanceIds.filter((oid) => oid !== target.targetOrgId)
              : s.activeOrgMaintenanceIds,
        }));

        return { ok: true };
      },

      startMaintenance: (id, actorName) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };

        if (
          target.status !== "SCHEDULED" &&
          target.status !== "APPROVED" &&
          !target.isEmergency
        ) {
          return {
            ok: false,
            error: `Cannot start maintenance. Window must be in SCHEDULED status (Current: ${target.status}). Super Admin approval required.`,
          };
        }

        const now = new Date().toISOString();
        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Maintenance Window Started",
          actor: actorName,
          timestamp: now,
          details: `Active maintenance commenced. Customer notification: ${target.notifyCustomers ? "Enabled" : "Disabled"}`,
        };

        const isPlatform = target.scope === "PLATFORM_WIDE";

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "IN_PROGRESS",
                  actualStart: now,
                  bannerActive: target.notifyCustomers,
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
          platformWideMaintenanceActive: isPlatform
            ? true
            : s.platformWideMaintenanceActive,
          activeOrgMaintenanceIds:
            !isPlatform && target.targetOrgId
              ? Array.from(new Set([...s.activeOrgMaintenanceIds, target.targetOrgId]))
              : s.activeOrgMaintenanceIds,
        }));

        return { ok: true };
      },

      toggleServiceCheck: (windowId, checkId, actorName) => {
        const now = new Date().toISOString();
        set((state) => ({
          maintenanceWindows: state.maintenanceWindows.map((m) => {
            if (m.id !== windowId) return m;

            const updatedChecks = m.serviceRestorationChecks.map((chk) => {
              if (chk.id !== checkId) return chk;
              const nextVal = !chk.completed;
              return {
                ...chk,
                completed: nextVal,
                checkedAt: nextVal ? now : undefined,
                checkedBy: nextVal ? actorName : undefined,
              };
            });

            const completedCount = updatedChecks.filter((c) => c.completed).length;
            const pct = Math.round((completedCount / Math.max(1, updatedChecks.length)) * 100);

            return {
              ...m,
              serviceRestorationChecks: updatedChecks,
              progressPct: pct,
              updatedAt: now,
            };
          }),
        }));
      },

      addExecutionNote: (windowId, note, author, role) => {
        const now = new Date().toISOString();
        const newNote: MaintenanceExecutionNote = {
          id: `nt-${Date.now()}`,
          author,
          role,
          note: note.trim(),
          timestamp: now,
        };

        set((state) => ({
          maintenanceWindows: state.maintenanceWindows.map((m) =>
            m.id === windowId
              ? {
                  ...m,
                  executionNotes: [...m.executionNotes, newNote],
                  updatedAt: now,
                }
              : m
          ),
        }));
      },

      completeMaintenance: (id, report) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };

        const now = new Date().toISOString();
        const startMillis = target.actualStart
          ? new Date(target.actualStart).getTime()
          : new Date(target.scheduledStart).getTime();
        const downtimeMin = Math.max(
          1,
          Math.round((new Date(now).getTime() - startMillis) / 60000)
        );

        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Maintenance Completed & Verified",
          actor: report.verifiedBy,
          timestamp: now,
          details: report.summary,
        };

        const isPlatform = target.scope === "PLATFORM_WIDE";

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "COMPLETED",
                  actualEnd: now,
                  bannerActive: false,
                  progressPct: 100,
                  serviceRestorationChecks: m.serviceRestorationChecks.map((c) => ({
                    ...c,
                    completed: true,
                    checkedAt: c.checkedAt || now,
                    checkedBy: c.checkedBy || report.verifiedBy,
                  })),
                  completionReport: {
                    summary: report.summary,
                    verifiedBy: report.verifiedBy,
                    actualDowntimeMinutes: downtimeMin,
                    completedAt: now,
                  },
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
          platformWideMaintenanceActive: isPlatform
            ? false
            : s.platformWideMaintenanceActive,
          activeOrgMaintenanceIds:
            !isPlatform && target.targetOrgId
              ? s.activeOrgMaintenanceIds.filter((oid) => oid !== target.targetOrgId)
              : s.activeOrgMaintenanceIds,
        }));

        return { ok: true };
      },

      emergencyOverrideActivate: (input) => {
        const now = new Date().toISOString();
        const codeNum = 80 + get().maintenanceWindows.length + 1;
        const code = `MNT-2026-0${codeNum}`;
        const dur = input.durationMinutes || 60;
        const endIso = new Date(Date.now() + dur * 60000).toISOString();

        const newWindow: MaintenanceWindowItem = {
          id: `mnt-em-${Date.now()}`,
          trackingCode: code,
          title: `EMERGENCY: ${input.title.trim()}`,
          reason: input.reason.trim(),
          scope: input.scope,
          targetOrgId: input.targetOrgId,
          targetOrgName: input.targetOrgName,
          impactLevel: input.impactLevel,
          affectedServices: input.affectedServices,
          scheduledStart: now,
          scheduledEnd: endIso,
          actualStart: now,
          durationMinutes: dur,
          timezone: "UTC",
          status: "IN_PROGRESS",
          isEmergency: true,
          emergencyOverrideBy: input.adminName,
          requestedBy: input.adminName,
          requestedAt: now,
          reviewedBy: input.adminName,
          reviewedAt: now,
          customerNoticeMessage: input.customerNoticeMessage.trim(),
          estimatedRestorationTime: input.estimatedRestorationTime.trim(),
          notifyCustomers: true,
          bannerActive: true,
          progressPct: 25,
          serviceRestorationChecks: input.affectedServices.map((svc, idx) => ({
            id: `chk-em-${Date.now()}-${idx}`,
            label: `Verify restoration of ${svc}`,
            completed: false,
          })),
          executionNotes: [
            {
              id: `nt-em-${Date.now()}`,
              author: input.adminName,
              role: "Super Administrator",
              note: `Direct Super Admin Emergency Override activated. Reason: ${input.reason}`,
              timestamp: now,
            },
          ],
          auditLogs: [
            {
              id: `aud-em-${Date.now()}`,
              action: "Emergency Override Activated",
              actor: `${input.adminName} (Super Admin)`,
              timestamp: now,
              details: `Direct immediate maintenance activation. Scope: ${input.scope}`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        const isPlatform = input.scope === "PLATFORM_WIDE";

        set((state) => ({
          maintenanceWindows: [newWindow, ...state.maintenanceWindows],
          platformWideMaintenanceActive: isPlatform
            ? true
            : state.platformWideMaintenanceActive,
          activeOrgMaintenanceIds:
            !isPlatform && input.targetOrgId
              ? Array.from(new Set([...state.activeOrgMaintenanceIds, input.targetOrgId]))
              : state.activeOrgMaintenanceIds,
        }));

        return newWindow;
      },

      emergencyStop: (id, actorName, reason) => {
        const state = get();
        const target = state.maintenanceWindows.find((m) => m.id === id);
        if (!target) return { ok: false, error: "Maintenance window not found." };

        const now = new Date().toISOString();
        const auditItem: MaintenanceAuditLog = {
          id: `aud-${Date.now()}`,
          action: "Emergency Stop Triggered",
          actor: actorName,
          timestamp: now,
          details: `Emergency halt: ${reason}. Services immediately restored.`,
        };

        const isPlatform = target.scope === "PLATFORM_WIDE";

        set((s) => ({
          maintenanceWindows: s.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "COMPLETED",
                  actualEnd: now,
                  bannerActive: false,
                  auditLogs: [...m.auditLogs, auditItem],
                  updatedAt: now,
                }
              : m
          ),
          platformWideMaintenanceActive: isPlatform
            ? false
            : s.platformWideMaintenanceActive,
          activeOrgMaintenanceIds:
            !isPlatform && target.targetOrgId
              ? s.activeOrgMaintenanceIds.filter((oid) => oid !== target.targetOrgId)
              : s.activeOrgMaintenanceIds,
        }));

        return { ok: true };
      },

      updateCustomerNotice: (id, message, estimatedRestorationTime) => {
        const now = new Date().toISOString();
        set((state) => ({
          maintenanceWindows: state.maintenanceWindows.map((m) =>
            m.id === id
              ? {
                  ...m,
                  customerNoticeMessage: message.trim(),
                  estimatedRestorationTime: estimatedRestorationTime.trim(),
                  updatedAt: now,
                }
              : m
          ),
        }));
      },

      togglePlatformWideMaintenance: (enable, adminName, reason) => {
        const state = get();
        const now = new Date().toISOString();

        if (enable) {
          // Find if there's already an in-progress platform window
          const existing = state.maintenanceWindows.find(
            (m) => m.scope === "PLATFORM_WIDE" && m.status === "IN_PROGRESS"
          );
          if (existing) {
            set({ platformWideMaintenanceActive: true });
            return;
          }
          // Create emergency active window
          get().emergencyOverrideActivate({
            title: "Platform-Wide Maintenance Lock",
            reason: reason || "Manual platform-wide maintenance toggle enabled by Super Admin.",
            scope: "PLATFORM_WIDE",
            impactLevel: "Brief Slowdown",
            affectedServices: ["Core Web API", "Background Worker Queues"],
            customerNoticeMessage: "ProWise is undergoing scheduled infrastructure maintenance. Services will resume shortly.",
            estimatedRestorationTime: "Estimated 30 minutes",
            adminName,
          });
        } else {
          // Halt any active platform-wide windows
          const active = state.maintenanceWindows.filter(
            (m) => m.scope === "PLATFORM_WIDE" && m.status === "IN_PROGRESS"
          );
          for (const win of active) {
            get().emergencyStop(win.id, adminName, reason || "Manual maintenance toggle disabled.");
          }
          set({ platformWideMaintenanceActive: false });
        }
      },

      toggleOrgMaintenance: (orgId, orgName, enable, adminName, reason) => {
        const state = get();
        if (enable) {
          const existing = state.maintenanceWindows.find(
            (m) => m.targetOrgId === orgId && m.status === "IN_PROGRESS"
          );
          if (existing) {
            set((s) => ({
              activeOrgMaintenanceIds: Array.from(new Set([...s.activeOrgMaintenanceIds, orgId])),
            }));
            return;
          }
          get().emergencyOverrideActivate({
            title: `Dedicated Maintenance Window: ${orgName}`,
            reason: reason || `Tenant-specific maintenance enabled for ${orgName}.`,
            scope: "ORGANIZATION_SPECIFIC",
            targetOrgId: orgId,
            targetOrgName: orgName,
            impactLevel: "Brief Slowdown",
            affectedServices: ["Database & Storage", "Webhook Delivery & Ingestion"],
            customerNoticeMessage: `${orgName} workspace is undergoing scheduled upgrades. Data remains safe.`,
            estimatedRestorationTime: "Estimated 20 minutes",
            adminName,
          });
        } else {
          const active = state.maintenanceWindows.filter(
            (m) => m.targetOrgId === orgId && m.status === "IN_PROGRESS"
          );
          for (const win of active) {
            get().emergencyStop(win.id, adminName, reason || "Tenant maintenance ended.");
          }
          set((s) => ({
            activeOrgMaintenanceIds: s.activeOrgMaintenanceIds.filter((id) => id !== orgId),
          }));
        }
      },

      isOrganizationInMaintenance: (orgId: string) => {
        const state = get();
        if (state.platformWideMaintenanceActive) {
          const win = state.maintenanceWindows.find(
            (m) => m.scope === "PLATFORM_WIDE" && m.status === "IN_PROGRESS"
          );
          return { inMaintenance: true, window: win };
        }
        if (state.activeOrgMaintenanceIds.includes(orgId)) {
          const win = state.maintenanceWindows.find(
            (m) => m.targetOrgId === orgId && m.status === "IN_PROGRESS"
          );
          return { inMaintenance: true, window: win };
        }
        return { inMaintenance: false };
      },

      getActiveBanner: () => {
        const state = get();
        const active = state.maintenanceWindows.find(
          (m) => m.status === "IN_PROGRESS" && m.bannerActive
        );
        if (!active) return null;
        return {
          enabled: true,
          trackingCode: active.trackingCode,
          title: active.title,
          message: active.customerNoticeMessage,
          estimatedRestorationTime: active.estimatedRestorationTime,
          scope: active.scope,
          targetOrgId: active.targetOrgId,
          targetOrgName: active.targetOrgName,
          affectedServices: active.affectedServices,
          impactLevel: active.impactLevel,
          isEmergency: active.isEmergency,
        };
      },

      resetDemoData: () => {
        set({
          maintenanceWindows: SEED_MAINTENANCE_ITEMS,
          platformWideMaintenanceActive: true,
          activeOrgMaintenanceIds: [],
        });
      },
    }),
    {
      name: "prowise-maintenance-store-v2",
      storage: safeJSONStorage,
      skipHydration: true,
      partialize: (state) => ({
        maintenanceWindows: state.maintenanceWindows,
        platformWideMaintenanceActive: state.platformWideMaintenanceActive,
        activeOrgMaintenanceIds: state.activeOrgMaintenanceIds,
      }),
    }
  )
);
