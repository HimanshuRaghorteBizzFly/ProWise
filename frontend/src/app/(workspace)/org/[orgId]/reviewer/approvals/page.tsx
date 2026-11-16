"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { WorkItemReview } from "@/types";

export default function ReviewerApprovalsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);
  const approved = reviews.filter((r: WorkItemReview) => r.decision === "APPROVED");

  return (
    <PanelLayout title="Approved Work Items" breadcrumb={[{ label: "QA Reviewer", href: `/org/${orgId}/reviewer` }, { label: "Approvals" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Approved Revisions</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Items that passed quality criteria and checklist validation</p>
        </div>
        <div className="space-y-2">
          {approved.map((a: WorkItemReview) => (

            <Card key={a.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs flex justify-between">
              <span className="font-semibold">Review: {a.id} (rev {a.submittedRevision})</span>
              <span className="text-green-600 font-bold">APPROVED</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
