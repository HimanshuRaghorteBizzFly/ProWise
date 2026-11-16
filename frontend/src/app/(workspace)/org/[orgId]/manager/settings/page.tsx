"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ManagerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Project Manager Settings" breadcrumb={[{ label: "Manager", href: `/org/${orgId}/manager` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Manager Preferences</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Default cadence, grace day warnings, and reminder notifications</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Button size="sm" onClick={() => toast.success("Preferences saved")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
