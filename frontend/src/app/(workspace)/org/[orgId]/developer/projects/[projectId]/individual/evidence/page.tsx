"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function IndividualProjectEvidencePage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;

  return (
    <PanelLayout title="Project Evidence & PRs" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Evidence" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Artifacts and PR links attached to check-ins for this project.</p>
      </Card>
    </PanelLayout>
  );
}
