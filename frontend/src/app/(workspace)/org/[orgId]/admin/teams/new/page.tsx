"use client";

import React from "react";
import { UsersRound } from "lucide-react";
import { PageFrame, Panel, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { TeamForm } from "@/components/org-console/TeamForm";

export default function AdminNewTeamPage() {
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad(250);
  return (
    <OrgGate family="admin" need="team.manage">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Teams", href: href("teams") }, { label: "New team" }]}
        back={{ href: href("teams"), label: "Back to teams" }}
        title="Create a team"
        description="Name the team, choose a lead and add members."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <Panel title="Team" icon={UsersRound} iconTone="violet"><TeamForm family="admin" /></Panel>
      </PageFrame>
    </OrgGate>
  );
}
