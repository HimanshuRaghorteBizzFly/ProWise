import { redirect } from "next/navigation";

// The old Activity URL keeps working and opens the dashboard.
export default function AdminActivityRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/dashboard`);
}
