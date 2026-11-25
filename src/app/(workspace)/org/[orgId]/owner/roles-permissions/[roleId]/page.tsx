"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { RoleDetailView } from "@/components/org-console/ApiRoleViews";

/** Owner · Role detail and edit (task 1.3): toggles, holders and revoke. Templates are read-only. */
export default function OwnerRolePage() {
  const { roleId } = useParams<{ roleId: string }>();
  return (
    <OrgGate family="owner" need="role.manage">
      <RoleDetailView family="owner" roleId={roleId} />
    </OrgGate>
  );
}
