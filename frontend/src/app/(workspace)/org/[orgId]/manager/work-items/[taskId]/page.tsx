"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ReviewDetailView } from "@/components/flow/ReviewViews";

/** Task detail for the PM: points, note, evidence, commits, history; accept or reject when it waits for review. */
export default function Page() {
  const params = useParams();
  return <ReviewDetailView orgId={(params?.orgId as string) || ""} panel="manager" reviewRef={(params?.taskId as string) || ""} context="task" />;
}
