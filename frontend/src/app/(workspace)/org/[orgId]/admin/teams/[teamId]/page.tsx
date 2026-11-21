"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamDetailView } from "@/components/org-console/ApiPeopleViews";

/** Admin · Team detail, members and lead (task 1.2, real API). */
export default function AdminTeamPage() {
  const params = useParams();
  return (
    <OrgGate family="admin" need="team.manage">
      <TeamDetailView family="admin" teamId={(params?.teamId as string) ?? ""} />
    </OrgGate>
  );
}
