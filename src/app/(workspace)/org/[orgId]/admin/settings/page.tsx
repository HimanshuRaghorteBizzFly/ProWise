"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Admin Workspace Settings" breadcrumb={[{ label: "Admin", href: `/org/${orgId}/admin` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Workspace Administration</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Configure defaults for projects, automated git linking, and member permissions</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <Button size="sm" onClick={() => toast.success("Settings updated")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
