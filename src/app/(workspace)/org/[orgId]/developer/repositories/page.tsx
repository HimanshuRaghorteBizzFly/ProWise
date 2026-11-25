import { redirect } from "next/navigation";

/** Folded into the 11 Developer destinations; the old URL keeps working. */
export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${params.orgId}/developer/github`);
}
