"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  ShieldAlert,
  FolderGit2,
} from "lucide-react";
import { developerApi, DeveloperNotification } from "@/lib/developer-api";
import { useNotificationStore } from "@/store/notification-store";
import { toast } from "sonner";

export default function DeveloperNotificationsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { notifications: storeNotifications } = useNotificationStore();

  const [notifications, setNotifications] = useState<DeveloperNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    const res = await developerApi.getNotifications(unreadOnly);
    if (res && res.length > 0) {
      setNotifications(res);
    } else {
      // Mock fallback
      const mock: DeveloperNotification[] = [
        {
          id: "notif-1",
          userId: "usr-developer",
          category: "CHECKIN_DUE",
          title: "Weekly Check-in Due for FHIR Intake (SOLO-10)",
          message: "Weekly individual progress report is required by Friday 18:00 UTC.",
          targetUrl: `/org/${orgId}/developer/projects/proj-individual-solo/individual`,
          read: false,
          createdAt: "2026-11-18T08:00:00Z",
        },
        {
          id: "notif-2",
          userId: "usr-developer",
          category: "REVIEW_REQUESTED",
          title: "Code Review Assigned: PR #42 Drools Connector",
          message: "Sarah Jenkins requested your review on feature/drools-engine.",
          targetUrl: `/org/${orgId}/developer/reviews`,
          read: false,
          createdAt: "2026-11-18T10:15:00Z",
        },
        {
          id: "notif-3",
          userId: "usr-developer",
          category: "BLOCKER_RESOLVED",
          title: "Blocker Resolved on CDS Task #101",
          message: "Database credential provisioning unblocked your service connection.",
          targetUrl: `/org/${orgId}/developer/tasks`,
          read: true,
          createdAt: "2026-11-17T15:00:00Z",
        },
      ];
      setNotifications(mock);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    await developerApi.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    toast.success("Notification marked as read");
  };

  const handleMarkAllRead = async () => {
    await developerApi.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <PanelLayout
      title="Notifications"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Notifications" }]}
    >
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-app-text-primary">Activity &amp; Alerts</h2>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Assignment alerts, check-in reminders, review invitations, and blocker resolutions.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className="text-xs"
            >
              {unreadOnly ? "Show All" : "Unread Only"}
            </Button>
            {unreadCount > 0 && (
              <Button size="sm" onClick={handleMarkAllRead} className="text-xs">
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <Card className="p-12 text-center text-xs text-app-text-muted">
              You are all caught up! No notifications in this view.
            </Card>
          ) : (
            notifications.map((n) => (
              <Card
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  !n.read ? "border-l-4 border-l-blue-600 bg-blue-500/5" : "opacity-85"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-app-surface border border-app-border shrink-0 mt-0.5">
                    {n.category === "CHECKIN_DUE" ? (
                      <Clock className="w-4 h-4 text-amber-500" />
                    ) : n.category === "BLOCKER_RESOLVED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Bell className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-app-text-primary">{n.title}</span>
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {n.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-app-text-secondary">{n.message}</p>
                    <div className="text-[10px] text-app-text-muted pt-0.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-blue-600"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark Read
                    </Button>
                  )}
                  {n.targetUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => (window.location.href = n.targetUrl!)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </PanelLayout>
  );
}
