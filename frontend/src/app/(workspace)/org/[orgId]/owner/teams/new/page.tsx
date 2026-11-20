"use client";

import React from "react";
import { UsersRound } from "lucide-react";
import { PageFrame, Panel, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { TeamForm } from "@/components/org-console/TeamForm";

export default function OwnerNewTeamPage() {
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad(250);
  return (
    <OrgGate family="owner" need="team.manage">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Teams", href: href("teams") }, { label: "New team" }]}
        back={{ href: href("teams"), label: "Back to teams" }}
        title="Create a team"
        description="Pick a lead and the people who belong to it."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <Panel title="Team" icon={UsersRound} iconTone="violet"><TeamForm family="owner" /></Panel>
      </PageFrame>
    </OrgGate>
  );
}
