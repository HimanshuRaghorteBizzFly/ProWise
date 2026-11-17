"use client";

import React from "react";

import { OrgNotificationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerNotificationsPage() {
  return (
    <OrgPage family="owner" title="Notifications">
      <OrgNotificationsContent family="owner" />
    </OrgPage>
  );
}
