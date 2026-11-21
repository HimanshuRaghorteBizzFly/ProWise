"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamNewView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Create a team (task 1.2, real API). */
export default function AdminNewTeamPage() {
  return (
    <OrgGate family="admin" need="team.manage">
      <TeamNewView family="admin" />
    </OrgGate>
  );
}
