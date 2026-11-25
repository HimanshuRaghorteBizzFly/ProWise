"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminButton, EmptyStateView, PageFrame, Panel, SegmentTabs, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useDevMutation, useDevNotifications } from "@/components/developer/useDeveloperData";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { developerApi, type DeveloperNotification } from "@/lib/developer-api";

/** Only same-app links are followed from a notification; anything else is shown as plain text. */
function safeTarget(url?: string): string | null {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

export default function DeveloperNotificationsPage() {
  const orgId = useOrgId();
  const home = `/org/${orgId}/developer/dashboard`;
  const list = useDevNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const markOne = useDevMutation((id: string) => developerApi.markNotificationRead(id));
  const markAll = useDevMutation((_: void) => developerApi.markAllNotificationsRead());

  const items: DeveloperNotification[] = list.kind === "ready" ? list.data : [];
  const unread = items.filter((n) => !n.read).length;
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <PanelLayout title="Notifications">
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "Notifications" }]}
        title="Notifications"
        description="Assignments, review decisions, blockers and deadlines that involve you."
        actions={
          <AdminButton
            variant="outline"
            size="sm"
            disabled={unread === 0 || markAll.isPending}
            isLoading={markAll.isPending}
            onClick={() =>
              markAll.mutate(undefined, {
                onSuccess: () => toast.success("All notifications marked as read."),
                onError: (e) => toast.error(changeError(e)),
              })
            }
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
          </AdminButton>
        }
      >
        <DevGate state={list} what="Notifications" back={{ href: home, label: "Back to dashboard" }}>
          {() => (
            <Panel title="Inbox" icon={Bell}>
              <div className="mb-3">
                <SegmentTabs
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "All", count: items.length },
                    { value: "unread", label: "Unread", count: unread },
                  ]}
                />
              </div>
              {shown.length === 0 ? (
                <EmptyStateView
                  icon={Bell}
                  title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
                  description="New activity on your work will appear here."
                />
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {shown.map((n) => {
                    const target = safeTarget(n.targetUrl);
                    return (
                      <li key={n.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {!n.read && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{n.title}</span>
                            {n.category && <StatusBadge label={n.category} tone="neutral" />}
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)]">{n.message}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {dateTimeText(n.createdAt)}
                            {target && (
                              <>
                                {" · "}
                                <Link href={target} className="text-blue-600 hover:underline dark:text-blue-400">
                                  Open
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                        {!n.read && (
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            disabled={markOne.isPending}
                            onClick={() => markOne.mutate(n.id, { onError: (e) => toast.error(changeError(e)) })}
                          >
                            Mark read
                          </AdminButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </DevGate>
      </PageFrame>
    </PanelLayout>
  );
}
