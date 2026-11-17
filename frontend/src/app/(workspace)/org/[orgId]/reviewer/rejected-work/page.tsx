"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { WorkItemReview } from "@/types";

export default function ReviewerRejectedWorkPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);
  const rejected = reviews.filter((r: WorkItemReview) => r.decision === "CHANGES_REQUESTED");

  return (
    <PanelLayout title="Changes Requested & Rejected Work" breadcrumb={[{ label: "QA Reviewer", href: `/org/${orgId}/reviewer` }, { label: "Rejected Work" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Rework Queue</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Mandatory feedback justifications provided when changes are requested</p>
        </div>
        <div className="space-y-2">
          {rejected.map((r: WorkItemReview) => (

            <Card key={r.id} className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/20 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Work Item Review {r.id}</span>
                <span className="text-amber-700 dark:text-amber-300">CHANGES REQUESTED</span>
              </div>
              <p className="text-[var(--color-text-secondary)]">Feedback: {r.feedbackReason}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
