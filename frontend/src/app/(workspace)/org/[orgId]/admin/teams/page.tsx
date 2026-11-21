"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamsListView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Teams (task 1.2, real API). */
export default function AdminTeamsPage() {
  return (
    <OrgGate family="admin" need="team.manage">
      <TeamsListView family="admin" />
    </OrgGate>
  );
}
