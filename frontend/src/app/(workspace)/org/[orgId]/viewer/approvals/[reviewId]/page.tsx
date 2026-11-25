"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ReviewDetailView } from "@/components/flow/ReviewViews";

/** Review page: task (or Solo submission), points, note, commits, images, history; approve or request changes. */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const reviewId = (params?.reviewId as string) || "";
  return <ReviewDetailView orgId={orgId} panel="viewer" reviewRef={reviewId} />;
}
