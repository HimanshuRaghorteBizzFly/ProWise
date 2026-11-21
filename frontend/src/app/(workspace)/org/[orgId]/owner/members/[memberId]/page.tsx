"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MemberDetailView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Member role and status (task 1.2, real API). */
export default function OwnerMemberPage() {
  const params = useParams();
  return (
    <OrgGate family="owner" need="role.manage">
      <MemberDetailView family="owner" memberId={(params?.memberId as string) ?? ""} />
    </OrgGate>
  );
}
