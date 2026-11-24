<<<<<<< HEAD
"use client";

import { previewEnabled } from "@/lib/permissions";
import { MyTasksView } from "@/components/work/ReviewViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TaskBoard } from "@/components/developer/TaskBoard";
import { useProjects } from "@/hooks/useProjects";

function PreviewStructuredMyTasksPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { workItems } = useProjects(orgId);
  const pItems = workItems.filter(w => w.projectId === projectId);

  return (
    <PanelLayout title="Structured Tasks" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Structured", href: `/org/${orgId}/developer/projects/${projectId}/structured` }, { label: "My Tasks" }]}>
      <TaskBoard workItems={pItems} projectId={projectId} />
    </PanelLayout>
  );
=======
import { redirect } from "next/navigation";

/** Folded into the Developer workspace: this old URL now opens the page that holds the same real data. */
export default function Page({ params }: { params: { orgId: string; projectId: string; taskId?: string } }) {
  redirect(`/org/${params.orgId}/developer/projects/${params.projectId}/structured`);
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function StructuredMyTasksPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  const projectId = (params?.projectId as string) ?? "";
  if (previewEnabled()) return <PreviewStructuredMyTasksPage />;
  return (
    <RequireAnyKey keys={["task.update"]} backHref={home}>
      <MyTasksView projectId={projectId} crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        itemHref={(task) => `${home}/projects/${projectId}/structured/tasks/${task.item.id}`} />
    </RequireAnyKey>
  );
}
