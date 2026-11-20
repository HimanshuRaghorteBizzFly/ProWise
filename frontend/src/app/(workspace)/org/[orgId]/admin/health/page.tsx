"use client";

import React from "react";

import { OrgHealthContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminHealthPage() {
  return (
    <OrgPage family="admin" title="Health & risks">
      <OrgHealthContent family="admin" />
    </OrgPage>
  );
}
