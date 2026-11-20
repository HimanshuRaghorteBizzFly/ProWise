"use client";

import React from "react";

import { OrgTeamsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminTeamsPage() {
  return (
    <OrgPage family="admin" title="Teams">
      <OrgTeamsContent family="admin" />
    </OrgPage>
  );
}
