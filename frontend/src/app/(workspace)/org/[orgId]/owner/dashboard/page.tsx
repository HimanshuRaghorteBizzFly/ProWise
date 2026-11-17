"use client";

import React from "react";

import { OrgDashboardContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerDashboardPage() {
  return (
    <OrgPage family="owner" title="Dashboard">
      <OrgDashboardContent family="owner" />
    </OrgPage>
  );
}
