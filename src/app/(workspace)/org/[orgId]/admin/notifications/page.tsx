import { redirect } from "next/navigation";

// The old URL keeps working and opens the dashboard.
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/dashboard`);
}
