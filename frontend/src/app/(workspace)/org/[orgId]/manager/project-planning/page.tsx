import { redirect } from "next/navigation";

export default function ManagerProjectPlanningPage({
  params,
}: {
  params: { orgId: string };
}) {
  redirect(`/org/${params.orgId}/manager/create-project`);
}
