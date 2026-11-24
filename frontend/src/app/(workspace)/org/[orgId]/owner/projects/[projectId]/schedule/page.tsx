"use client";

import { useParams } from "next/navigation";

import { ProjectScheduleView, RequireAnyKey } from "@/components/calendar/CalendarViews";

/** Task 2.3: a project's check-in cadence, due dates and history (the server decides which projects are readable). */
export default function ProjectSchedulePage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/owner`;
  const projectId = (params?.projectId as string) ?? "";
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProjectScheduleView projectId={projectId}
        crumbs={[{ label: "Owner", href: home }, { label: "All projects", href: `${home}/projects` }, { label: "Project", href: `${home}/projects/${projectId}` }]}
        back={{ href: `${home}/projects/${projectId}`, label: "Back to project" }} />
    </RequireAnyKey>
  );
}
