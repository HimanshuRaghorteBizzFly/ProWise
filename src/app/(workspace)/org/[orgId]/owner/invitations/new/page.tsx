"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InviteMemberView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Invite a member (task 1.2, real API). */
export default function OwnerInviteMemberPage() {
  return (
    <OrgGate family="owner" need="member.invite">
      <InviteMemberView family="owner" />
    </OrgGate>
  );
}
