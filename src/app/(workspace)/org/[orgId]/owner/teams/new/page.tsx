"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamNewView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Create a team (task 1.2, real API). */
export default function OwnerNewTeamPage() {
  return (
    <OrgGate family="owner" need="team.manage">
      <TeamNewView family="owner" />
    </OrgGate>
  );
}
