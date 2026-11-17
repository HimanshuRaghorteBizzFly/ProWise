"use client";

import React from "react";

import { OrgAccessContent, OrgPage } from "@/components/owner/OrgPages";

export default function AdminAccessPage() {
  return (
    <OrgPage family="admin" title="Access Map">
      <OrgAccessContent family="admin" />
    </OrgPage>
  );
}
