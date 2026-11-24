"use client";

import { previewEnabled } from "@/lib/permissions";
import { ProgressListView, ProjectProgressPageView } from "@/components/work/ReviewViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

function PreviewStructuredBaselineProgressPage() {
  return (
    <PanelLayout title="Baseline Leaf Progress" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Progress" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Sum(Done Leaf Weights) / Total Approved Baseline Weights formula progress.</p>
      </Card>
    </PanelLayout>
  );
}

/** Task 3.5: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function StructuredBaselineProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  if (previewEnabled()) return <PreviewStructuredBaselineProgressPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProjectProgressPageView projectId={(params?.projectId as string) ?? ""} crumbs={[{ label: "Developer", href: home }, { label: "Progress", href: `${home}/progress` }]}
        back={{ href: `${home}/progress`, label: "Back to progress" }} />
    </RequireAnyKey>
  );
}
