"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DeveloperSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Developer Settings" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Developer Preferences</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Notification dispatch preferences and timezone settings</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Button size="sm" onClick={() => toast.success("Preferences updated")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
