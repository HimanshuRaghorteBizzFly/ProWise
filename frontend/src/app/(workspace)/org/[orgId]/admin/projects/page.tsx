"use client";

import React from "react";

import { OrgProjectsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminProjectsPage() {
  return (
    <OrgPage family="admin" title="Projects portfolio">
      <OrgProjectsContent family="admin" />
    </OrgPage>
  );
}
