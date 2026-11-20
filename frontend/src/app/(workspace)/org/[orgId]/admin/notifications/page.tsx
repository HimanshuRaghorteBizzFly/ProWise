import { redirect } from "next/navigation";

// Admin activity alerts live in Audit Activity.
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/audit-logs`);
}
