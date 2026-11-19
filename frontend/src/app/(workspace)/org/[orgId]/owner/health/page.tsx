"use client";

import React from "react";

import { OrgHealthContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerHealthPage() {
  return (
    <OrgPage family="owner" title="Health & risks">
      <OrgHealthContent family="owner" />
    </OrgPage>
  );
}
