"use client";

import React from "react";

import { OrgAuditContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminAuditLogsPage() {
  return (
    <OrgPage family="admin" title="Audit & security">
      <OrgAuditContent family="admin" />
    </OrgPage>
  );
}
