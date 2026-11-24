"use client";

<<<<<<< HEAD
import { useParams } from "next/navigation";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

/** Task 3.1 (real API). */
export default function ReviewerWorkItemsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/reviewer`;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <WorkItemsView crumbs={[{ label: "Reviewer", href: home }]} back={{ href: home, label: "Back to dashboard" }} title="Work items" />
    </RequireAnyKey>
  );
=======
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${params.orgId}/reviewer`);
>>>>>>> 29db595 (Initial ProWise project upload)
}
