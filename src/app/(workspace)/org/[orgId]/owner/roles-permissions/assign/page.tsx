"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { AssignRoleView } from "@/components/org-console/ApiRoleViews";

/** Owner · Assign role (task 1.3): grant at ORG or PROJECT scope, list and revoke a member's grants. */
export default function OwnerAssignRolePage() {
  return (
    <OrgGate family="owner" need="role.manage">
      <AssignRoleView family="owner" />
    </OrgGate>
  );
}
