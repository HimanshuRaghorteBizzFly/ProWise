"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function LeadReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Peer Reviews" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Reviews" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Peer Code & Work Item Reviews</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Technical lead verification of submitted revisions</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">0 pending lead review sign-offs.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
