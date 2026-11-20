"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { RolesListView } from "@/components/org-console/ApiRoleViews";

/** Admin · Roles & permissions (task 1.3): role ladder from GET /v1/organizations/{org}/roles. */
export default function AdminRolesPermissionsPage() {
  return (
    <OrgGate family="admin" need="role.manage">
      <RolesListView family="admin" />
    </OrgGate>
  );
}
