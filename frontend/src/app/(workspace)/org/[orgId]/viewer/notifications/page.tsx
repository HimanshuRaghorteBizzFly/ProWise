"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useNotificationStore } from "@/store/notification-store";

export default function ViewerNotificationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { notifications } = useNotificationStore();

  return (
    <PanelLayout title="Viewer Updates" breadcrumb={[{ label: "Viewer", href: `/org/${orgId}/viewer` }, { label: "Notifications" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Project Updates Feed</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Announcements, status reports, and milestone publications</p>
        </div>
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
              <span className="font-semibold text-primary-600">{n.title}</span>
              <p className="text-[var(--color-text-secondary)] mt-0.5">{n.message}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
