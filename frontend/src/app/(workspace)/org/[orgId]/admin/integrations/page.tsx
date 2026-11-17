"use client";

import React from "react";

import { OrgIntegrationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminIntegrationsPage() {
  return (
    <OrgPage family="admin" title="Integrations (GitHub)">
      <OrgIntegrationsContent family="admin" />
    </OrgPage>
  );
}
