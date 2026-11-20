"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { RoleCreateView } from "@/components/org-console/ApiRoleViews";

/** Admin · Create custom role (task 1.3). Toggles allow only keys the caller holds. */
export default function AdminCreateRolePage() {
  return (
    <OrgGate family="admin" need="role.manage">
      <RoleCreateView family="admin" />
    </OrgGate>
  );
}
