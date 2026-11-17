"use client";

import React from "react";

import { OrgMembersContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminMembersPage() {
  return (
    <OrgPage family="admin" title="Members">
      <OrgMembersContent family="admin" />
    </OrgPage>
  );
}
