"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MembersListView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Members and needs-owner handover items (task 1.2, real API). */
export default function OwnerMembersPage() {
  return (
    <OrgGate family="owner" need="role.manage">
      <MembersListView family="owner" />
    </OrgGate>
  );
}
