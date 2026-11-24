"use client";

import { useParams } from "next/navigation";

import { WorkTypesView } from "@/components/work/WorkViews";

/** Task 3.1 (T19): organization work types. */
export default function WorkTypesPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/owner`;
  return <WorkTypesView crumbs={[{ label: "Owner", href: home }]} back={{ href: `${home}/projects`, label: "Back to projects" }} />;
}
