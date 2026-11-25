"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PmProgressListView } from "@/components/flow/PmProgressViews";

/** Progress of every project the PM can see: one card each (paginated, search, filter, sort). */
export default function Page() {
  const params = useParams();
  return <PmProgressListView orgId={(params?.orgId as string) || ""} />;
}
