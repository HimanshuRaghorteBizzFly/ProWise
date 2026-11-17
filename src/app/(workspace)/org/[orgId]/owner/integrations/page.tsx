"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Webhook } from "lucide-react";
import { toast } from "sonner";

export default function OwnerIntegrationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Integrations" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Integrations" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Connected Developer Tools</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">GitHub App connections, repository sync, and outgoing webhooks</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <div>
              <h4 className="text-sm font-semibold">GitHub Organization App</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">Installed on 4 repositories • Sync active</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Configuring GitHub App...")}>Configure</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
