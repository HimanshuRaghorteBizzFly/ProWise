"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MemberDisableView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Disable a member with handover (task 1.2, real API). */
export default function OwnerDisableMemberPage() {
  const params = useParams();
  return (
    <OrgGate family="owner" need="member.disable">
      <MemberDisableView family="owner" memberId={(params?.memberId as string) ?? ""} />
    </OrgGate>
  );
}
