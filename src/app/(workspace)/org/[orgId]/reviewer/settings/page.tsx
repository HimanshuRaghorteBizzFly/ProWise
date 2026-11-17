"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ReviewerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="QA Preferences" breadcrumb={[{ label: "QA Reviewer", href: `/org/${orgId}/reviewer` }, { label: "Settings" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
        <h3 className="font-semibold text-sm">Reviewer Settings</h3>
        <Button size="sm" onClick={() => toast.success("Settings saved")}>Save Preferences</Button>
      </Card>
    </PanelLayout>
  );
}
