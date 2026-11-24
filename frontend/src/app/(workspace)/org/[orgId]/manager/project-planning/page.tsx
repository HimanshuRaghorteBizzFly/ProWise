"use client";

import { useParams } from "next/navigation";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

/** Task 3.1 (real API). */
export default function ProjectPlanningPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProjectPlanningView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        projectHref={(id) => `${home}/projects/${id}`} />
    </RequireAnyKey>
  );
}
