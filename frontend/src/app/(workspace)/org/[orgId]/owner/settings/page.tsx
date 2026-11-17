import { redirect } from "next/navigation";

// Organization settings live at /owner/organization. Approved redirect (Gate 2); the route is kept so old links still work.
export default function OwnerSettingsRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/org/${encodeURIComponent(params.orgId)}/owner/organization`);
}
