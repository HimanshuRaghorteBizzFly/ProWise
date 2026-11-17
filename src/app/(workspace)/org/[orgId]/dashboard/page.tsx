import { redirect } from "next/navigation";

export default function OrgDashboardPage({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId || "org-acme";
  if (orgId === "viewer") {
    redirect("/org/org-acme/viewer/dashboard");
  }
  redirect(`/org/${orgId}/viewer/dashboard`);
}
