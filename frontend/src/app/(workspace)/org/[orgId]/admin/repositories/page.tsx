import { redirect } from "next/navigation";

// Repositories are part of Integrations (GitHub). Approved redirect (Gate 2); the route is kept so old links still work.
export default function AdminRepositoriesRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/integrations`);
}
