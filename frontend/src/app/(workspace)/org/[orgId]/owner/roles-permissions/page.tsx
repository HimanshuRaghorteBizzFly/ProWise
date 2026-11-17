"use client";

import React from "react";

import { OrgRolesContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerRolesPermissionsPage() {
  return (
    <OrgPage family="owner" title="Roles & permissions">
      <OrgRolesContent />
    </OrgPage>
  );
}
