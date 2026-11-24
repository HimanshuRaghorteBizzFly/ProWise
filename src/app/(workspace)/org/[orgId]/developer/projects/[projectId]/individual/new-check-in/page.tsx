"use client";

import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { CheckInFormView } from "@/components/progress/CheckInViews";

/** Task 2.2: the accountable developer's check-in form (a page, not a popup). Submissions start pending. */
export default function IndividualNewCheckInPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const projectId = (params?.projectId as string) || "";
  const progress = `/org/${orgId}/developer/projects/${encodeURIComponent(projectId)}/individual/check-ins`;
  return (
    <PanelLayout title="New check-in">
      <CheckInFormView projectId={projectId}
        crumbs={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Check-ins", href: `/org/${orgId}/developer/checkins` }]}
        back={{ href: progress, label: "Back to progress" }} />
    </PanelLayout>
  );
}
