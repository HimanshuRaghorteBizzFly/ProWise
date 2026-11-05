"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorAnnouncementDraftsPage() {
  return (
    <PanelLayout title="Announcement Drafts" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Drafts" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Drafted Platform Banners</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Maintenance announcements in preparation</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">0 announcement drafts in progress.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
