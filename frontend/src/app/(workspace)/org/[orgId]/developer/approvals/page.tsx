"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ReviewQueueView } from "@/components/flow/ReviewViews";

/** Review queue: work waiting for this approver's decision (only projects where they were chosen). */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return <PanelLayout title="Approvals"><ReviewQueueView orgId={orgId} panel="developer" /></PanelLayout>;
}
