"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { RoleCreateView } from "@/components/org-console/ApiRoleViews";

/** Owner · Create custom role (task 1.3). Toggles allow only keys the caller holds. */
export default function OwnerCreateRolePage() {
  return (
    <OrgGate family="owner" need="role.manage">
      <RoleCreateView family="owner" />
    </OrgGate>
  );
}
