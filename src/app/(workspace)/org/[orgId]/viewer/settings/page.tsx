"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function ViewerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Viewer Preferences" breadcrumb={[{ label: "Viewer", href: `/org/${orgId}/viewer` }, { label: "Settings" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Read-only stakeholder settings and email digest subscription options.</p>
      </Card>
    </PanelLayout>
  );
}
