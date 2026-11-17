"use client";

import React from "react";

import { OrgMembersContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerMembersPage() {
  return (
    <OrgPage family="owner" title="Members">
      <OrgMembersContent family="owner" />
    </OrgPage>
  );
}
