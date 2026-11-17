"use client";

import React from "react";

import { OrgDashboardContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminDashboardPage() {
  return (
    <OrgPage family="admin" title="Dashboard">
      <OrgDashboardContent family="admin" />
    </OrgPage>
  );
}
