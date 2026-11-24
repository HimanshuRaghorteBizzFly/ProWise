"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InvitationsListView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Invitations (task 1.2, real API). */
export default function OwnerInvitationsPage() {
  return (
    <OrgGate family="owner" need="member.invite">
      <InvitationsListView family="owner" />
    </OrgGate>
  );
}
