"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function DeveloperEvidencePage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Verification Evidence" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Evidence" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Artifacts & Review Evidence</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Pull request links, test reports, and design artifacts submitted with check-ins</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All uploaded evidence artifacts are linked to corresponding check-in audits and reviews.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
