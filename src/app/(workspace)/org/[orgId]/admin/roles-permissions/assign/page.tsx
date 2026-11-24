"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { AssignRoleView } from "@/components/org-console/ApiRoleViews";

/** Admin · Assign role (task 1.3): grant at ORG or PROJECT scope, list and revoke a member's grants. */
export default function AdminAssignRolePage() {
  return (
    <OrgGate family="admin" need="role.manage">
      <AssignRoleView family="admin" />
    </OrgGate>
  );
}
