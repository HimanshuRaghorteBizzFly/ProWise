"use client";

<<<<<<< HEAD
import { useParams } from "next/navigation";
import { ProgressListView, ProjectProgressPageView } from "@/components/work/ReviewViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

/** Task 3.5 (real API). */
export default function TeamLeadProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProgressListView crumbs={[{ label: "Team Lead", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </RequireAnyKey>
  );
=======
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${params.orgId}/lead`);
>>>>>>> 29db595 (Initial ProWise project upload)
}
