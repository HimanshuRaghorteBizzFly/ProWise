"use client";

import React from "react";

import { OrgReportsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerReportsPage() {
  return (
    <OrgPage family="owner" title="Reports & exports">
      <OrgReportsContent />
    </OrgPage>
  );
}
