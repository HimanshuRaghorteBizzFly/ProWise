"use client";

import React from "react";

import { OrgAccessContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerAccessPage() {
  return (
    <OrgPage family="owner" title="Access Map">
      <OrgAccessContent family="owner" />
    </OrgPage>
  );
}
