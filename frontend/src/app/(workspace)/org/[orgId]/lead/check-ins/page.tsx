"use client";

import { useParams } from "next/navigation";

import { ApprovalQueueView } from "@/components/progress/CheckInViews";

/** Task 2.2: Team Lead approval queue (real API). Approve or reject inline; no popups. */
export default function LeadCheckInApprovalsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  return <ApprovalQueueView orgId={orgId} crumbs={[{ label: "Team Lead", href: home }]} back={{ href: home, label: "Back to dashboard" }} />;
}
