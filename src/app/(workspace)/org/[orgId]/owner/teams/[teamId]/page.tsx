"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { TeamDetailView } from "@/components/org-console/ApiPeopleViews";

/** Owner · Team detail, members and lead (task 1.2, real API). */
export default function OwnerTeamPage() {
  const params = useParams();
  return (
    <OrgGate family="owner" need="team.manage">
      <TeamDetailView family="owner" teamId={(params?.teamId as string) ?? ""} />
    </OrgGate>
  );
}
