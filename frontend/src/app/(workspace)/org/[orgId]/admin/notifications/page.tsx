"use client";

import React from "react";

import { OrgNotificationsContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminNotificationsPage() {
  return (
    <OrgPage family="admin" title="Notifications">
      <OrgNotificationsContent family="admin" />
    </OrgPage>
  );
}
