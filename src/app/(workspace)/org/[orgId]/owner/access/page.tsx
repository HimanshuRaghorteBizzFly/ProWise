import { redirect } from "next/navigation";

// Access Map was removed; Roles & Permissions replaces it. The route is kept so old links still work.
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/owner/roles-permissions`);
}
