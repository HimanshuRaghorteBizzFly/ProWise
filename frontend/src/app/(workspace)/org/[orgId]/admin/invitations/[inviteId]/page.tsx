"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InvitationDetailView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Invitation detail, resend and revoke (task 1.2, real API). */
export default function AdminInvitationPage() {
  const params = useParams();
  return (
    <OrgGate family="admin" need="member.invite">
      <InvitationDetailView family="admin" inviteId={(params?.inviteId as string) ?? ""} />
    </OrgGate>
  );
}
