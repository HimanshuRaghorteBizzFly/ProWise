import { redirect } from "next/navigation";

/** Folded into the Developer workspace; keep this legacy URL working. */
export default function Page({ params }: { params: { orgId: string; projectId: string; taskId?: string } }) {
  redirect(`/org/${params.orgId}/developer/blockers`);
}
