"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InvitationsListView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Invitations (task 1.2, real API). */
export default function AdminInvitationsPage() {
  return (
    <OrgGate family="admin" need="member.invite">
      <InvitationsListView family="admin" />
    </OrgGate>
  );
}
