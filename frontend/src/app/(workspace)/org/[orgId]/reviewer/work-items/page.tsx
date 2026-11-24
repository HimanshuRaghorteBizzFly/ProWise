import { redirect } from "next/navigation";

export default function Page({ params }: { params: { orgId: string } }) {
  redirect(`/org/${params.orgId}/reviewer`);
}
