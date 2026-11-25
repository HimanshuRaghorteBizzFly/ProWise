import { redirect } from "next/navigation";

// The old URL keeps working and opens the dashboard (Integrations is not available yet).
export default function AdminRepositoriesRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/dashboard`);
}
