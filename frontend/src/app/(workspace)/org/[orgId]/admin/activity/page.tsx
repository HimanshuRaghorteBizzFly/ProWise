import { redirect } from "next/navigation";

// Activity is part of Audit & security. Approved redirect (Gate 2); the route is kept so old links still work.
export default function AdminActivityRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/audit-logs`);
}
