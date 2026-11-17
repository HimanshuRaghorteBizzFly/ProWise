import { redirect } from "next/navigation";

// Legacy owner overview replaced by the dashboard. Approved redirect (Gate 2); the route is kept so old links still work.
export default function OwnerRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/owner/dashboard`);
}
