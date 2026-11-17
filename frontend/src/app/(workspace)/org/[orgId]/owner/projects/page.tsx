"use client";

import React from "react";

import { OrgProjectsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerProjectsPage() {
  return (
    <OrgPage family="owner" title="Projects portfolio">
      <OrgProjectsContent />
    </OrgPage>
  );
}
