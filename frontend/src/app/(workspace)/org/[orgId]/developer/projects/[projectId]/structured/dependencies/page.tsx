"use client";

import { previewEnabled } from "@/lib/permissions";
import { BlockersView, BlockerDetailView, DependenciesPageView } from "@/components/work/DependencyViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

function PreviewStructuredDependenciesPage() {
  return (
    <PanelLayout title="Task Dependencies" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Dependencies" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Finish-to-Start dependencies blocking tasks from entering IN_PROGRESS.</p>
      </Card>
    </PanelLayout>
  );
}

/** Task 3.4: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function StructuredDependenciesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  if (previewEnabled()) return <PreviewStructuredDependenciesPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <DependenciesPageView projectId={(params?.projectId as string) ?? ""} crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </RequireAnyKey>
  );
}
