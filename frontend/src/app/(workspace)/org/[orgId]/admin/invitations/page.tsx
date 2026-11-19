"use client";

import React from "react";

import { OrgInvitationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminInvitationsPage() {
  return (
    <OrgPage family="admin" title="Invitations">
      <OrgInvitationsContent family="admin" />
    </OrgPage>
  );
}
