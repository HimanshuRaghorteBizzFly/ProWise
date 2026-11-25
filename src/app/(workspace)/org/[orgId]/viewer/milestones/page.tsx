import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

/** No live API backs this Viewer module yet; it is hidden from navigation until one ships. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Milestones" homeHref={`/org/${encodeURIComponent(params.orgId)}/viewer/dashboard`} />;
}
