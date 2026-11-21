import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/safe-storage";
import { useAuthStore } from "@/store/auth-store";
import {
  ViewerProject,
  ViewerTask,
  ViewerMilestone,
  ViewerMember,
  ViewerCalendarEvent,
  ViewerFileItem,
  ViewerActivityItem,
  ViewerNotificationItem,
  ViewerUserSettings,
} from "../_types";
import {
  DEFAULT_VIEWER_SETTINGS,
  SEEDED_VIEWER_NOTIFICATIONS,
} from "../_data/seed";
import {
  getViewerProjects,
  getViewerTasks,
  getViewerMilestones,
  getViewerMembers,
  getViewerCalendarEvents,
  getViewerFiles,
  getViewerActivity,
  generateProgressCsv,
  generateMilestonesJson,
  assertReadOnly,
} from "../_services/viewer-service";
import { toast } from "sonner";

interface ViewerState {
  orgId: string;
  setOrgId: (orgId: string) => void;

  // Search and Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  selectedStatus: string;
  setSelectedStatus: (s: string) => void;
  selectedPriority: string;
  setSelectedPriority: (p: string) => void;
  selectedMode: string;
  setSelectedMode: (m: string) => void;

  // Modals & Detail Drawers
  selectedProject: ViewerProject | null;
  setSelectedProject: (p: ViewerProject | null) => void;
  selectedTask: ViewerTask | null;
  setSelectedTask: (t: ViewerTask | null) => void;
  selectedFile: ViewerFileItem | null;
  setSelectedFile: (f: ViewerFileItem | null) => void;
  selectedEvent: ViewerCalendarEvent | null;
  setSelectedEvent: (e: ViewerCalendarEvent | null) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;

  // Notifications
  notifications: ViewerNotificationItem[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // User Profile Settings
  userSettings: ViewerUserSettings;
  updateUserSettings: (updates: Partial<ViewerUserSettings>) => void;

  // Permitted Exports
  exportProgressReport: () => void;
  exportMilestoneAudit: () => void;
  downloadPermittedFile: (file: ViewerFileItem) => void;

  // Rejection check for mutations
  rejectMutationAttempt: (actionName: string) => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set, get) => ({
      orgId: "org-acme",
      setOrgId: (orgId) => set({ orgId }),

      searchQuery: "",
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      selectedProjectId: "ALL",
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
      selectedStatus: "ALL",
      setSelectedStatus: (selectedStatus) => set({ selectedStatus }),
      selectedPriority: "ALL",
      setSelectedPriority: (selectedPriority) => set({ selectedPriority }),
      selectedMode: "ALL",
      setSelectedMode: (selectedMode) => set({ selectedMode }),

      selectedProject: null,
      setSelectedProject: (selectedProject) => set({ selectedProject }),
      selectedTask: null,
      setSelectedTask: (selectedTask) => set({ selectedTask }),
      selectedFile: null,
      setSelectedFile: (selectedFile) => set({ selectedFile }),
      selectedEvent: null,
      setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
      isSearchModalOpen: false,
      setIsSearchModalOpen: (isSearchModalOpen) => set({ isSearchModalOpen }),

      notifications: SEEDED_VIEWER_NOTIFICATIONS,
      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      userSettings: DEFAULT_VIEWER_SETTINGS,
      updateUserSettings: (updates) =>
        set((state) => {
          const updated = { ...state.userSettings, ...updates };
          if (updates.displayName) {
            try {
              const authState = useAuthStore.getState();
              if (authState?.currentUser) {
                authState.setCurrentUser({
                  ...authState.currentUser,
                  name: updates.displayName,
                });
              }
            } catch {
              // ignore if auth store unavailable
            }
          }
          return { userSettings: updated };
        }),

      exportProgressReport: () => {
        const { orgId } = get();
        const csvData = generateProgressCsv(orgId);
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `prowise-progress-report-${orgId}-${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Progress CSV report generated and downloaded.");
      },

      exportMilestoneAudit: () => {
        const { orgId } = get();
        const jsonData = generateMilestonesJson(orgId);
        const blob = new Blob([jsonData], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `prowise-milestone-compliance-${orgId}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Milestone Compliance JSON audit generated and downloaded.");
      },

      downloadPermittedFile: (file) => {
        if (file.isRestricted || !file.permittedDownload) {
          toast.error("403 Forbidden: Restricted file. Viewer role lacks clearance for system credentials.");
          return;
        }

        const currentName = get().userSettings.displayName || "Jordan Lee";
        const watermarkedContent = `/* PROWISE CONFIDENTIAL - AUTHORIZED READ-ONLY COPY */\n/* Generated for: ${currentName} (Viewer) */\n/* Date: ${new Date().toISOString()} */\n\n${file.previewContent}`;
        const mimeType = file.format === "json" ? "application/json" : "text/plain";
        const blob = new Blob([watermarkedContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", file.name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${file.name}`);
      },

      rejectMutationAttempt: (actionName) => {
        try {
          assertReadOnly(actionName);
        } catch (err: any) {
          toast.error(err.message || "403 Forbidden: Action not permitted in Read-Only mode.");
        }
      },
    }),
    {
      name: "prowise-viewer-storage",
      storage: safeJSONStorage,
      skipHydration: true,
      partialize: (state) => ({
        userSettings: state.userSettings,
      }),
    }
  )
);
