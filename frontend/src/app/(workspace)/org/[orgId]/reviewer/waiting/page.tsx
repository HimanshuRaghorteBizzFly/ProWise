import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Waiting reviews" homeHref={`/org/${encodeURIComponent(params.orgId)}/reviewer`} homeLabel="Back to dashboard" />;
}
