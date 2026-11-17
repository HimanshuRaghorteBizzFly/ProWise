"use client";

import React from "react";

import { OrgRolesContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminRolesPermissionsPage() {
  return (
    <OrgPage family="admin" title="Roles & permissions">
      <OrgRolesContent />
    </OrgPage>
  );
}
