"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, FolderKanban, GitBranch, ShieldAlert, Users } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { OrgNotification } from "@/mocks/org-console";
import { AdminButton, EmptyStateView, PageFrame, SegmentTabs, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, timeAgo, useOrgHref } from "@/components/org-console/OrgUI";
import { cn } from "@/lib/utils";

const KIND: Record<OrgNotification["kind"], { icon: React.ElementType; cls: string }> = {
  SECURITY: { icon: ShieldAlert, cls: "bg-rose-500/12 text-rose-600 dark:text-rose-400" },
  MEMBER: { icon: Users, cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
  PROJECT: { icon: FolderKanban, cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  INTEGRATION: { icon: GitBranch, cls: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400" },
  BILLING_FREE: { icon: Bell, cls: "bg-slate-500/12 text-slate-600" },
};

export default function OwnerNotificationsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const all = useOrgConsoleStore((s) => s.notifications);
  const markRead = useOrgConsoleStore((s) => s.markNotificationRead);
  const markAll = useOrgConsoleStore((s) => s.markAllNotificationsRead);
  const [tab, setTab] = useState<"UNREAD" | "ALL">("UNREAD");
  const items = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = items.filter((n) => tab === "ALL" || !n.read);

  return (
    <OrgGate family="owner">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Notifications" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Notifications"
        description="Security, people, project and integration alerts for the organization."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<AdminButton variant="outline" onClick={markAll} disabled={!items.some((n) => !n.read)}><CheckCheck className="w-3.5 h-3.5" /> Mark all read</AdminButton>}
      >
        <SegmentTabs<"UNREAD" | "ALL"> value={tab} onChange={setTab} options={[{ value: "UNREAD", label: "Unread", count: items.filter((n) => !n.read).length }, { value: "ALL", label: "All", count: items.length }]} />
        {rows.length === 0 ? (
          <SurfaceCard><EmptyStateView icon={BellOff} title="You're all caught up" description="New alerts will appear here." /></SurfaceCard>
        ) : (
          <div className="space-y-2.5">
            {rows.map((n) => {
              const k = KIND[n.kind];
              return (
                <Link key={n.id} href={href(n.link)} onClick={() => markRead(n.id)} className="block rounded-xl">
                  <SurfaceCard className={cn("p-4 flex items-start gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", !n.read && "border-l-4 border-l-blue-500")}>
                    <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", k.cls)}><k.icon className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</p><span className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(n.at)}</span></div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{n.body}</p>
                    </div>
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
