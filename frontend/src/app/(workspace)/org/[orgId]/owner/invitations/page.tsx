"use client";

import React from "react";

import { OrgInvitationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerInvitationsPage() {
  return (
    <OrgPage family="owner" title="Invitations">
      <OrgInvitationsContent />
    </OrgPage>
  );
}
