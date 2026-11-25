"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { HandoverResolveView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Assign an owner to a handover item (task 1.2, real API). */
export default function AdminHandoverPage() {
  const params = useParams();
  return (
    <OrgGate family="admin" need="member.disable">
      <HandoverResolveView family="admin" itemId={(params?.itemId as string) ?? ""} />
    </OrgGate>
  );
}
