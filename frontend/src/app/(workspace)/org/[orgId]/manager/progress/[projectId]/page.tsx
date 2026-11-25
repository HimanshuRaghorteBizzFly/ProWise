"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PmProgressDetailView } from "@/components/flow/PmProgressViews";

/** One project's progress: progress ring with its method; Team tasks by phase, or Solo submissions and reviews. */
export default function Page() {
  const params = useParams();
  return <PmProgressDetailView orgId={(params?.orgId as string) || ""} projectId={(params?.projectId as string) || ""} />;
}
