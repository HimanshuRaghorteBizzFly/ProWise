"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ReviewQueueView } from "@/components/flow/ReviewViews";

/** Work submitted by developers in the PM's projects, waiting to be accepted or rejected. */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return <ReviewQueueView orgId={orgId} panel="manager" />;
}
