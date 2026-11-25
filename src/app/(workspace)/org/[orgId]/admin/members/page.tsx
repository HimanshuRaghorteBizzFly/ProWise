"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { MembersListView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Members and needs-owner handover items (task 1.2, real API). */
export default function AdminMembersPage() {
  return (
    <OrgGate family="admin" need="role.manage">
      <MembersListView family="admin" />
    </OrgGate>
  );
}
