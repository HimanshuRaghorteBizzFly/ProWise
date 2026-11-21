"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamsListView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Teams (task 1.2, real API). */
export default function OwnerTeamsPage() {
  return (
    <OrgGate family="owner" need="team.manage">
      <TeamsListView family="owner" />
    </OrgGate>
  );
}
