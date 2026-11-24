import { redirect } from "next/navigation";

// Admins cannot change organization settings; old links land on Roles & Permissions.
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/admin/roles-permissions`);
}
