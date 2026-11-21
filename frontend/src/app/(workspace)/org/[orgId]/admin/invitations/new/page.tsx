"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { InviteMemberView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Invite a member (task 1.2, real API). */
export default function AdminInviteMemberPage() {
  return (
    <OrgGate family="admin" need="member.invite">
      <InviteMemberView family="admin" />
    </OrgGate>
  );
}
