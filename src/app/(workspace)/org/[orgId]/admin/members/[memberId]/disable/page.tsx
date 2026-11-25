"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MemberDisableView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Disable a member with handover (task 1.2, real API). */
export default function AdminDisableMemberPage() {
  const params = useParams();
  return (
    <OrgGate family="admin" need="member.disable">
      <MemberDisableView family="admin" memberId={(params?.memberId as string) ?? ""} />
    </OrgGate>
  );
}
