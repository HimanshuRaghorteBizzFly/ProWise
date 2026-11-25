"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ReviewQueueView } from "@/components/flow/ReviewViews";

/** Review queue: work waiting for this approver's decision (only projects where they were chosen). */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return <ReviewQueueView orgId={orgId} panel="reviewer" />;
}
