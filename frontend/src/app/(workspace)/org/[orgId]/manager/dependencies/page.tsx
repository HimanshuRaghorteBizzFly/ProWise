"use client";

<<<<<<< HEAD
import { useParams } from "next/navigation";
import { BlockersView, BlockerDetailView, DependenciesPageView } from "@/components/work/DependencyViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

/** Task 3.4 (real API). */
export default function ManagerDependenciesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <DependenciesPageView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </RequireAnyKey>
  );
=======
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${params.orgId}/manager`);
>>>>>>> 29db595 (Initial ProWise project upload)
}
