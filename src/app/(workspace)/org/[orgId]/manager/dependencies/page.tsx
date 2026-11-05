"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default function ManagerDependenciesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Finish-to-Start Dependencies" breadcrumb={[{ label: "Manager", href: `/org/${orgId}/manager` }, { label: "Dependencies" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Work Item Predecessor Constraints</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Explicit Finish-to-Start dependencies enforce sequential delivery within projects</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">CRM-101 (Predecessor) must reach DONE before CRM-102 can enter IN_PROGRESS.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
