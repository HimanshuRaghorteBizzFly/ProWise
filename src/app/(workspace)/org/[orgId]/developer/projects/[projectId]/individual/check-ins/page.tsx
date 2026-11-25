"use client";

import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProjectProgressView } from "@/components/progress/CheckInViews";

/** Task 2.2: approved figure, the pending entry (separately) and the full history, on the real API. */
export default function IndividualCheckInsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const projectId = (params?.projectId as string) || "";
  const list = `/org/${orgId}/developer/checkins`;
  return (
    <PanelLayout title="Progress">
      <ProjectProgressView projectId={projectId}
        crumbs={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Check-ins", href: list }]}
        back={{ href: list, label: "Back to check-ins" }}
        submitHref={`/org/${orgId}/developer/projects/${encodeURIComponent(projectId)}/individual/new-check-in`} />
    </PanelLayout>
  );
}
