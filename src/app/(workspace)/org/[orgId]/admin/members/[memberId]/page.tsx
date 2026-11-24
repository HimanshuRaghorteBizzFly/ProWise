"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MemberDetailView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Member role and status (task 1.2, real API). */
export default function AdminMemberPage() {
  const params = useParams();
  return (
    <OrgGate family="admin" need="role.manage">
      <MemberDetailView family="admin" memberId={(params?.memberId as string) ?? ""} />
    </OrgGate>
  );
}
