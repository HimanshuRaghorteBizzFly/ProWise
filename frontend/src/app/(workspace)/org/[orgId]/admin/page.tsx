import { redirect } from "next/navigation";

// Legacy admin overview replaced by the dashboard. Approved redirect (Gate 2); the route is kept so old links still work.
export default function AdminRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/dashboard`);
}
