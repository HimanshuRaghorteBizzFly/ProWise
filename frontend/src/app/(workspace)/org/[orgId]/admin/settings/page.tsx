import { redirect } from "next/navigation";

// Admin settings are replaced by the Access Map. Approved redirect (Gate 2); the route is kept so old links still work.
export default function AdminSettingsRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/access`);
}
