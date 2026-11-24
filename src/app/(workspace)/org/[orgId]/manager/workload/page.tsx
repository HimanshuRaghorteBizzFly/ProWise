import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Team workload" homeHref={`/org/${encodeURIComponent(params.orgId)}/manager`} homeLabel="Back to dashboard" />;
}
