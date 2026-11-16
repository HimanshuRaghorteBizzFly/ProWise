"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { toast } from "sonner";

export default function OwnerWorkspacesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Workspaces" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Workspaces" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Organization Workspaces</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Segment portfolio units, engineering divisions, and subsidiaries</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create workspace modal...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Workspace
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Primary Delivery Hub</h4>
              <span className="text-[11px] text-[var(--color-text-secondary)]">Default workspace • 12 active projects</span>
            </div>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
