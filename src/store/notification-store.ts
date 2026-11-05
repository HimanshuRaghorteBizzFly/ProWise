import { create } from "zustand";
import { Notification } from "@/types";
import { INITIAL_NOTIFICATIONS } from "@/lib/mock-data";

interface NotificationStoreState {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  clearNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: INITIAL_NOTIFICATIONS,
  unreadCount: INITIAL_NOTIFICATIONS.filter((n: Notification) => !n.read).length,


  markAsRead: (id: string) =>
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  addNotification: (data) =>
    set((state) => {
      const newNotif: Notification = {
        ...data,
        id: `notif-${Date.now()}`,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newNotif, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  clearNotification: (id: string) =>
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),
}));
