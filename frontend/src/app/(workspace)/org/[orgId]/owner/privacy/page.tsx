"use client";

import React from "react";

import { OrgPrivacyContent, OrgPage } from "@/components/owner/OrgPages";

export default function OwnerPrivacyPage() {
  return (
    <OrgPage family="owner" title="Data & privacy">
      <OrgPrivacyContent />
    </OrgPage>
  );
}
