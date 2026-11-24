<<<<<<< HEAD
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
=======
import { redirect } from "next/navigation";

/** Folded into the Developer workspace: this old URL now opens the page that holds the same real data. */
export default function Page({ params }: { params: { orgId: string; projectId: string; taskId?: string } }) {
  redirect(`/org/${params.orgId}/developer/projects/${params.projectId}/structured`);
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
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
