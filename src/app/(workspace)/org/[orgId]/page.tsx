import { redirect } from "next/navigation";

export default function OrgIndexPage({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  if (!orgId || orgId === "viewer") {
    redirect("/select-workspace");
  }
  redirect(`/org/${orgId}/viewer/dashboard`);
}
