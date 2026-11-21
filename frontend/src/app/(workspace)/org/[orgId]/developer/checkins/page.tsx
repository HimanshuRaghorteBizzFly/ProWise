"use client";

import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { MyCheckInProjectsView } from "@/components/progress/CheckInViews";

/** Task 2.2: the developer's Individual projects with their approved figure (real API, replaces the mock list). */
export default function DeveloperCheckInsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  return (
    <PanelLayout title="Check-ins">
      <MyCheckInProjectsView orgId={orgId} crumbs={[{ label: "Developer", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </PanelLayout>
  );
}
