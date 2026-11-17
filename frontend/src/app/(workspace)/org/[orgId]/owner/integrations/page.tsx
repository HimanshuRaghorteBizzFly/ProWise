"use client";

import React from "react";

import { OrgIntegrationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerIntegrationsPage() {
  return (
    <OrgPage family="owner" title="Integrations (GitHub)">
      <OrgIntegrationsContent family="owner" />
    </OrgPage>
  );
}
