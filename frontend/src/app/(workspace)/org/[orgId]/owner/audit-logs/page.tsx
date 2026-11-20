"use client";

import React from "react";

import { OrgAuditContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerAuditLogsPage() {
  return (
    <OrgPage family="owner" title="Audit & security">
      <OrgAuditContent family="owner" />
    </OrgPage>
  );
}
