"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InvitationDetailView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Invitation detail, resend and revoke (task 1.2, real API). */
export default function OwnerInvitationPage() {
  const params = useParams();
  return (
    <OrgGate family="owner" need="member.invite">
      <InvitationDetailView family="owner" inviteId={(params?.inviteId as string) ?? ""} />
    </OrgGate>
  );
}
