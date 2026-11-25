"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { HandoverResolveView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Assign an owner to a handover item (task 1.2, real API). */
export default function OwnerHandoverPage() {
  const params = useParams();
  return (
    <OrgGate family="owner" need="member.disable">
      <HandoverResolveView family="owner" itemId={(params?.itemId as string) ?? ""} />
    </OrgGate>
  );
}
