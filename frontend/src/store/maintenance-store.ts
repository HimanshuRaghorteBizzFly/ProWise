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

const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem[] = [];

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
      platformWideMaintenanceActive: false,
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
      name: "prowise-maintenance-store-v3",
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
