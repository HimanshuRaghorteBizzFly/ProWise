import { redirect } from "next/navigation";

/** Folded into the Developer workspace: this old URL now opens the page that holds the same real data. */
export default function Page({ params }: { params: { orgId: string; projectId: string; taskId?: string } }) {
  redirect(`/org/${params.orgId}/developer/blockers`);
}
