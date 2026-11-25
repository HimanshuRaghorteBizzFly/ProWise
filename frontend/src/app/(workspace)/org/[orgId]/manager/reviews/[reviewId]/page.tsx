"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ReviewDetailView } from "@/components/flow/ReviewViews";

/** One submission: task, points, note, commits, images, history. Accept, or reject with a reason. */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const reviewId = (params?.reviewId as string) || "";
  return <ReviewDetailView orgId={orgId} panel="manager" reviewRef={reviewId} />;
}
