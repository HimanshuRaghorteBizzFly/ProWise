import { redirect } from "next/navigation";

// Health is shown on Projects Overview for admins.
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/projects`);
}
