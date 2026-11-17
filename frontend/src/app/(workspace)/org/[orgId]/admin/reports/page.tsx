"use client";

import React from "react";

import { OrgReportsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminReportsPage() {
  return (
    <OrgPage family="admin" title="Reports & exports">
      <OrgReportsContent />
    </OrgPage>
  );
}
