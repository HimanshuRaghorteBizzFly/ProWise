"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TransferOwnershipView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Transfer ownership (task 1.2): owner only, explicit confirmation, exactly one owner kept. */
export default function OwnerTransferOwnershipPage() {
  return (
    <OrgGate family="owner" need="org.ownership.transfer">
      <TransferOwnershipView />
    </OrgGate>
  );
}
