"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { RolesListView } from "@/components/org-console/ApiRoleViews";

/** Owner · Roles & permissions (task 1.3): role ladder from GET /v1/organizations/{org}/roles. */
export default function OwnerRolesPermissionsPage() {
  return (
    <OrgGate family="owner" need="role.manage">
      <RolesListView family="owner" />
    </OrgGate>
  );
}
