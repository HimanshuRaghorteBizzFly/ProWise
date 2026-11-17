"use client";

import React from "react";

import { OrgTeamsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerTeamsPage() {
  return (
    <OrgPage family="owner" title="Teams">
      <OrgTeamsContent />
    </OrgPage>
  );
}
