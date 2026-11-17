"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BellOff } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

export interface NotificationsViewProps {
  notifications: Notification[];
  source: "api" | "fixture";
}

const CATEGORY_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assignment",
  CHECK_IN_DUE: "Check-in due",
  REVIEW_REQUEST: "Review request",
  HEALTH_CHANGE: "Health change",
};

function formatUtc(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

export function NotificationsView({ notifications, source }: NotificationsViewProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = notifications.filter((notification) => !notification.read).length;
  const visible = filter === "unread" ? notifications.filter((notification) => !notification.read) : notifications;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Alerts for your membership in this organization. Only items you can still open are listed."
        simulationLabel={source === "fixture" ? "Sample data" : undefined}
        actions={
          <>
            <LaterActionButton>Mark all read</LaterActionButton>
            <LaterActionButton>Preferences</LaterActionButton>
            <OwnerLaterBadge task="5.2" />
          </>
        }
      />
      {notifications.length === 0 ? (
        <OwnerPageState state="empty" icon={BellOff} title="No notifications" description="You are all caught up." />
      ) : (
        <OwnerPanel
          title="Inbox"
          description={`${unread} unread of ${notifications.length}`}
          actions={
            <div role="group" aria-label="Filter notifications" className="inline-flex rounded-lg border border-app-border p-0.5">
              {(["all", "unread"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent",
                    filter === value ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "text-app-text-secondary hover:bg-app-hover",
                  )}
                >
                  {value === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
          }
        >
          {visible.length === 0 ? (
            <OwnerPageState state="empty" title="No unread notifications" description="Switch to All to see read items." />
          ) : (
            <ul className="divide-y divide-app-border">
              {visible.map((notification) => (
                <li key={notification.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={notification.targetUrl}
                    className="block rounded-lg p-2 -m-2 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={CATEGORY_LABELS[notification.category] ?? notification.category} tone="info" />
                      {!notification.read && <StatusBadge label="Unread" tone="warning" dot />}
                      <span className="ml-auto text-caption text-app-text-muted">{formatUtc(notification.createdAt)}</span>
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-app-text-primary">{notification.title}</span>
                    <span className="block text-sm text-app-text-secondary">{notification.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OwnerPanel>
      )}
    </div>
  );
}
